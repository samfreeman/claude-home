export function redirectAllowed(redirectUri: string, allowedHosts: string) {
	let url: URL
	try {
		url = new URL(redirectUri)
	}
	catch {
		return false
	}
	const hosts = allowedHosts.split(',').map(h => h.trim().toLowerCase()).filter(h => h != '')
	return url.protocol == 'https:' && hosts.includes(url.hostname.toLowerCase())
}

export function accountRefusal(accountId: string, allowedAccountId: string | undefined) {
	if (!allowedAccountId)
		return `This server has no ALLOWED_ACCOUNT_ID configured, so it admits no one. To admit this Dropbox account, set ALLOWED_ACCOUNT_ID to ${accountId}.`
	return accountId == allowedAccountId
		? undefined
		: 'This Dropbox account isn\'t allowed to use this server.'
}

export const escapeHtml = (text: string) =>
	text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

export function page(status: number, title: string, body: string) {
	const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
		+ `<title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem">`
		+ `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></body></html>`
	return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
