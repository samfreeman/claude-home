// ─── messaging channel ───────────────────────────────────────────────────────
//
// The human-bridge for unattended runs. `ask` sends a question and BLOCKS,
// polling for the reply inside one tool call — the "resume" is just the tool
// returning. Multi-turn discussion = the agent looping `ask`; each call is its
// own per-message window.
//
// D1 decided: Telegram Bot API. Its getUpdates long-poll IS our block-and-poll
// model, it's free, and receiving needs no webhook/public endpoint (no harness).
// The Messenger interface keeps the rest of the server channel-neutral so a
// Twilio / Android-gateway backend could drop in later unchanged.

export interface Messenger {
	// Send a one-way message.
	send(body: string): Promise<void>
	// Send a question, then block up to timeoutMs for the inbound reply.
	// Resolves with the reply text, or null on timeout (→ agent checkpoints + halts).
	ask(body: string, timeoutMs: number): Promise<string | null>
}

// Default ask window. Set safely BELOW the harness's max tool-call duration
// (V3 — exact ceiling still to be confirmed; tune via HWAG_ASK_TIMEOUT_MS).
export const DEFAULT_ASK_TIMEOUT_MS = Number(process.env.HWAG_ASK_TIMEOUT_MS) || 240000

// Telegram caps a single long-poll; loop sub-polls until the run window elapses.
const MAX_POLL_SECONDS = 50

// ─── Telegram ────────────────────────────────────────────────────────────────

async function tg(token: string, method: string, params: Record<string, unknown>): Promise<any> {
	const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params)
	})
	const json = await res.json() as any
	if (!json.ok)
		throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`)
	return json.result
}

export class TelegramMessenger implements Messenger {
	constructor(private token: string, private chatId: string) {}

	async send(body: string): Promise<void> {
		await tg(this.token, 'sendMessage', { chat_id: this.chatId, text: body })
	}

	async ask(body: string, timeoutMs: number): Promise<string | null> {
		// Establish a baseline so we only catch replies sent AFTER the question.
		let offset = await this.currentOffset()
		await this.send(body)
		const deadline = Date.now() + timeoutMs
		while (Date.now() < deadline) {
			const remainingS = Math.floor((deadline - Date.now()) / 1000)
			const perPoll = Math.max(1, Math.min(MAX_POLL_SECONDS, remainingS))
			const updates = await tg(this.token, 'getUpdates', { offset, timeout: perPoll }) as any[]
			for (const u of updates) {
				offset = u.update_id + 1   // confirm even non-matching updates
				const m = u.message
				if (m && typeof m.text == 'string' && String(m.chat?.id) == this.chatId)
					return m.text
			}
		}
		return null
	}

	// Highest existing update_id + 1, so pre-question chatter is skipped/confirmed.
	private async currentOffset(): Promise<number> {
		const updates = await tg(this.token, 'getUpdates', { timeout: 0 }) as any[]
		if (updates.length == 0)
			return 0
		return updates[updates.length - 1].update_id + 1
	}
}

// Stub used when Telegram isn't configured. `send` logs to stderr; `ask` waits
// out the timeout and returns null — so an unconfigured run degrades to "texted
// nobody, got no answer, halt cleanly for manual resume" rather than hanging.
export class StubMessenger implements Messenger {
	async send(body: string): Promise<void> {
		process.stderr.write(`[hwag:msg:stub] would send: ${body}\n`)
	}
	async ask(body: string, timeoutMs: number): Promise<string | null> {
		process.stderr.write(`[hwag:msg:stub] would ask (no channel configured, times out in ${timeoutMs}ms): ${body}\n`)
		await new Promise(r => setTimeout(r, timeoutMs))
		return null
	}
}

// Selects the channel from env. Telegram when both token + chat id are set,
// else the stub.
export function makeMessenger(): Messenger {
	const token = process.env.HWAG_TELEGRAM_TOKEN
	const chatId = process.env.HWAG_TELEGRAM_CHAT_ID
	if (token && chatId)
		return new TelegramMessenger(token, chatId)
	return new StubMessenger()
}

// ─── ask channel toggle ──────────────────────────────────────────────────────
//
// `ask` is delivery-agnostic across the SAME messenger transport:
//   - 'sms'     → message the human's phone (Telegram), away from keyboard.
//   - 'session' → ask the human in-session via MCP elicitation (nearby).
// ('sms' kept as the label for the away-channel even though the transport is
// Telegram — it's "reaches my phone".)
//
// The `/wag:hadr --ask:session` (and `/wag:hdev --ask:session`) switch sets
// HWAG_ASK_CHANNEL=session for the run.
export type AskChannel = 'sms' | 'session'

export function defaultChannel(): AskChannel {
	return process.env.HWAG_ASK_CHANNEL == 'session' ? 'session' : 'sms'
}

// In-session ask via MCP elicitation.
// TODO(V4): verify Claude Code surfaces MCP elicitation prompts, AND that it does
// so for a tool called from inside a spawned subagent. Confirm the elicitation API
// shape against @modelcontextprotocol/sdk ^1.9 before wiring — do NOT guess it.
// Until verified, this throws so a misconfigured 'session' run fails loudly.
export async function askInSession(_body: string, _timeoutMs: number): Promise<string | null> {
	throw new Error('ask channel "session" not yet wired — pending V4 (MCP elicitation support). Use channel "sms".')
}
