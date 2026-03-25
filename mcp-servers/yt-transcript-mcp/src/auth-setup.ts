#!/usr/bin/env node
/**
 * One-time OAuth setup for yt-transcript-mcp.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node dist/auth-setup.js
 *
 * Opens a browser for Google sign-in, then prints your GOOGLE_REFRESH_TOKEN.
 */

import { createServer } from 'http'
import { OAuth2Client } from 'google-auth-library'

const SCOPES = [
	'https://www.googleapis.com/auth/youtube',
	'https://www.googleapis.com/auth/youtube.force-ssl'
]
const PORT = 4242
const REDIRECT_URI = `http://localhost:${PORT}/callback`

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET

if (!clientId || !clientSecret) {
	console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
	process.exit(1)
}

const client = new OAuth2Client({ clientId, clientSecret, redirectUri: REDIRECT_URI })

const authUrl = client.generateAuthUrl({
	access_type: 'offline',
	scope: SCOPES,
	prompt: 'consent'
})

console.log('\nOpening browser for Google sign-in...')
console.log('If it does not open, visit this URL manually:\n')
console.log(authUrl + '\n')

// Try to open browser
try {
	const { spawn } = await import('child_process')
	if (process.env.WSL_DISTRO_NAME)
		spawn('powershell.exe', ['-Command', `Start-Process "${authUrl}"`], { detached: true, stdio: 'ignore' }).unref()
	else if (process.platform == 'darwin')
		spawn('open', [authUrl], { detached: true, stdio: 'ignore' }).unref()
	else
		spawn('xdg-open', [authUrl], { detached: true, stdio: 'ignore' }).unref()
}
catch {}

// Wait for callback
const code = await new Promise<string>((resolve, reject) => {
	const server = createServer((req, res) => {
		const url = new URL(req.url!, `http://localhost:${PORT}`)
		const code = url.searchParams.get('code')
		const error = url.searchParams.get('error')

		res.writeHead(200, { 'Content-Type': 'text/html' })

		if (error) {
			res.end('<h2>Auth failed: ' + error + '</h2><p>You can close this tab.</p>')
			server.close()
			reject(new Error('Auth failed: ' + error))
			return
		}

		if (code) {
			res.end('<h2>Authenticated!</h2><p>You can close this tab and return to the terminal.</p>')
			server.close()
			resolve(code)
		}
	})

	server.listen(PORT, () => console.log(`Waiting for Google callback on port ${PORT}...`))
})

const { tokens } = await client.getToken(code)

if (!tokens.refresh_token) {
	console.error('\nError: No refresh token returned.')
	console.error('This can happen if the account was already authorized.')
	console.error('Go to https://myaccount.google.com/permissions and revoke access, then re-run.')
	process.exit(1)
}

console.log('\nSuccess! Add this to your MCP server config:\n')
console.log(`GOOGLE_CLIENT_ID=${clientId}`)
console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`)
console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
console.log()
