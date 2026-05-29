// ─── run command policy ──────────────────────────────────────────────────────
//
// The security core of hwag. Every `run` command passes through validateCommand()
// before execution. The guarantee is capability, not discipline: a denied command
// is never executed, regardless of what the agent intends.
//
// Three gates, in order:
//   1. No chaining / substitution — one command per call. This is what prevents
//      `git status && gh pr merge` from smuggling a denied command behind an
//      allowed one. (Mirrors the "never chain bash" rule.)
//   2. Denylist — forbidden patterns reject even if the family is allowed.
//   3. Allowlist — the command family must be explicitly permitted, or it's denied.
//
// hwag exposes NO merge tool and the denylist rejects `gh pr merge` / push-to-main,
// so an unattended run cannot merge or push to a protected branch by construction.

export type PolicyResult = { ok: true } | { ok: false, reason: string }

// Gate 1: any of these enables chaining, piping, redirection, or substitution —
// all of which would let a denied command ride in behind an allowed one.
const FORBIDDEN_METACHARS = ['&&', '||', ';', '|', '`', '$(', '${', '>', '<', '\n', '\r']

// Bare `&` (background) — checked separately so we don't trip on `&&` handling.
const BACKGROUND = /(^|[^&])&([^&]|$)/

// Gate 2: denied even when the family is allowlisted. Matched against the
// whitespace-normalised, lowercased command.
const DENY: { pattern: RegExp, reason: string }[] = [
	{ pattern: /^gh\s+pr\s+merge\b/, reason: 'PR merge is forbidden — merge is the human-gated step' },
	{ pattern: /^gh\s+\S+\s+delete\b/, reason: 'gh delete operations are forbidden' },
	{ pattern: /^git\s+push\b.*\b(origin\s+)?(main|master)\b/, reason: 'push to main/master is forbidden' },
	{ pattern: /\bpush\b.*(--force\b|-f\b|--force-with-lease\b)/, reason: 'force push is forbidden' },
	{ pattern: /^git\s+reset\s+--hard\b/, reason: 'git reset --hard is forbidden' },
	{ pattern: /^git\s+revert\b/, reason: 'git revert is forbidden' },
	{ pattern: /^git\s+clean\b.*-[a-z]*f/, reason: 'git clean -f is forbidden' },
	{ pattern: /\brm\s+-[a-z]*r/, reason: 'recursive rm is forbidden' },
	{ pattern: /^sudo\b/, reason: 'sudo is forbidden' }
]

// Gate 3: only these command families may run. First token (and, for git/gh, the
// subcommand shape) must match. Everything else is denied by default.
const ALLOW_PREFIXES: RegExp[] = [
	/^git\s+(status|log|diff|branch|add|commit|checkout|switch|fetch|pull|push|mv|stash|show|rev-parse|remote|restore|merge|init|tag)\b/,
	/^git\s+push\b/,                              // non-protected pushes (DENY catches main/master/force)
	/^gh\s+(pr|run|repo|workflow|api|auth|release)\b/,   // DENY catches pr merge / delete
	/^(npm|pnpm|yarn|bun)\b/,
	/^npx\b/,
	/^node\b/,
	/^(tsc|vitest|jest|eslint|prettier|biome)\b/
]

export function validateCommand(raw: string): PolicyResult {
	const cmd = raw.trim()
	if (cmd == '')
		return { ok: false, reason: 'empty command' }

	// Gate 1 — no chaining / substitution / redirection.
	for (const m of FORBIDDEN_METACHARS)
		if (cmd.includes(m))
			return { ok: false, reason: `command contains forbidden sequence "${m}" — run one command per call, no chaining` }
	if (BACKGROUND.test(cmd))
		return { ok: false, reason: 'background execution (&) is forbidden' }

	const norm = cmd.replace(/\s+/g, ' ').toLowerCase()

	// Gate 2 — denylist overrides allowlist.
	for (const d of DENY)
		if (d.pattern.test(norm))
			return { ok: false, reason: d.reason }

	// Gate 3 — must match an allowed family.
	for (const a of ALLOW_PREFIXES)
		if (a.test(norm))
			return { ok: true }

	return { ok: false, reason: `command not in allowlist: "${cmd.split(' ')[0]}" — hwag.run permits only git/gh/build/test tooling` }
}
