// WAG POC comments: the Vercel function that saves one comment to Dropbox as its own Markdown file.
// Development only — not part of the app, and not ported at the handoff. The Comment dialog
// (scripts/comments.js) posts { name, page, text } here as JSON. The procedure is
// ~/.claude/wag/workflows/poc.md (Step 6, Comments; the setup is Step 7).
//
// Dropbox: the project's own Dropbox app, <project>-poc, has app-folder access only, so "/" here is
// /Apps/<project>-poc/ in the owner's Dropbox, and it can reach nothing else. Its scope is
// files.content.write only. The app key, app secret and refresh token are in the Vercel project's
// environment variables — DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN — never in the
// page. Access tokens last about four hours, so each comment trades the refresh token for a fresh one.
//
// One file per comment, since Dropbox can't append and two comments at once would collide in one file.
// The name is the UTC time, sortable, with hyphens for colons (Windows), then the sender:
// 2026-10-30T23-50-12Z-andy.md. Two in the same second from the same person get renamed, not lost.

const clean = (value, max) =>
	String(value ?? '').trim().slice(0, max)

async function dropboxToken() {
	const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: process.env.DROPBOX_REFRESH_TOKEN ?? '',
			client_id: process.env.DROPBOX_APP_KEY ?? '',
			client_secret: process.env.DROPBOX_APP_SECRET ?? ''
		})
	})
	if (!r.ok)
		throw new Error(`Dropbox token: ${r.status} ${await r.text()}`)
	return (await r.json()).access_token
}

module.exports = async (req, res) => {
	if (req.method != 'POST')
		return res.status(405).json({ error: 'POST only.' })
	try {
		const body = typeof req.body == 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
		const name = clean(body.name, 60)
		const page = clean(body.page, 2000)
		const text = clean(body.text, 20000)
		if (!name || !text)
			return res.status(400).json({ error: 'A name and a comment are both needed.' })
		const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
		const who = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'someone'
		const path = `/${now.replace(/:/g, '-')}-${who}.md`
		const file = `# Comment\n\n- **Name:** ${name}\n- **Page:** ${page}\n- **Time:** ${now}\n\n${text}\n`
		const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${await dropboxToken()}`,
				'Content-Type': 'application/octet-stream',
				'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true })
			},
			body: Buffer.from(file, 'utf8')
		})
		if (!r.ok)
			throw new Error(`Dropbox upload: ${r.status} ${await r.text()}`)
		return res.status(200).json({ ok: true })
	}
	catch (e) {
		console.error(e)
		return res.status(502).json({ error: 'The comment did not save.' })
	}
}
