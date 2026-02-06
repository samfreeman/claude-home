const fs = require('fs')
const path = require('path')
const {
	SSH_DIR, ok, fail, warn, info, confirm, runSilent, exists
} = require('./utils')

module.exports = {
	id: '3-github-auth',
	name: 'GitHub Auth',
	platforms: ['wsl', 'mac'],
	async fn(state) {
		info('This step requires manual browser interaction.')
		info('')
		info('You need to:')
		info('  1. Run: gh auth login  (authenticate personal account)')
		info('  2. Add SSH public keys to GitHub')
		info('')

		// Show personal public key
		const personalPubPath = path.join(SSH_DIR, 'id_ed25519.pub')
		if (exists(personalPubPath)) {
			const key = fs.readFileSync(personalPubPath, 'utf8').trim()
			info('Personal key (add at https://github.com/settings/ssh/new):')
			console.log(`  ${key}`)
			info('')
		}

		// Show PayOnward public key
		const payonwardPubPath = path.join(SSH_DIR, 'id_ed25519_payonward.pub')
		if (exists(payonwardPubPath)) {
			const key = fs.readFileSync(payonwardPubPath, 'utf8').trim()
			info('PayOnward key (add at https://github.com/settings/ssh/new as SamAtPayOnward):')
			console.log(`  ${key}`)
			info('')
		}

		if (!await confirm('Have you completed authentication and added both keys?'))
			return { success: false, message: 'User skipped' }

		// Validate SSH connectivity
		info('')
		info('Testing SSH connections...')

		const personalOk = testSsh('github.com-personal', 'samfreeman')
		const payonwardOk = testSsh('github.com-payonward', 'SamAtPayOnward')

		// gh auth status (nice to have, not required)
		const ghAuth = runSilent('gh auth status 2>&1', { ignoreError: true })
		if (ghAuth.output?.includes('Logged in'))
			ok('gh CLI authenticated')
		else
			warn('gh CLI not authenticated (optional — SSH keys are what matters)')

		return { success: personalOk && payonwardOk }
	}
}

// accept-new is safe here because we're connecting to github.com only —
// do not reuse this pattern for arbitrary hosts
function testSsh(host, expectedUser) {
	const result = runSilent(
		`ssh -T git@${host} -o StrictHostKeyChecking=accept-new 2>&1`,
		{ ignoreError: true }
	)
	const output = result.output || ''
	if (output.includes(expectedUser)) {
		ok(`${host}: connected as ${expectedUser}`)
		return true
	}
	fail(`${host}: ${output.trim()}`)
	return false
}
