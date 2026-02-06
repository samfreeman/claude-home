const fs = require('fs')
const path = require('path')
const {
	IS_MAC, SSH_DIR,
	ok, info, confirm, run, runSilent, exists, isDir
} = require('./utils')

module.exports = {
	id: '2-github-keys',
	name: 'GitHub CLI & SSH Keys',
	platforms: ['wsl', 'mac'],
	async fn(state) {
		info('This step will:')
		info('  - Install GitHub CLI (gh)')
		info('  - Generate SSH keys for two GitHub accounts')
		info('  - Write SSH config with host aliases')
		info('')
		info('SSH keys:')
		info('  ~/.ssh/id_ed25519           — personal (samfreeman)')
		info('  ~/.ssh/id_ed25519_payonward — PayOnward (SamAtPayOnward)')
		info('')

		if (!await confirm('Continue?'))
			return { success: false, message: 'User skipped' }

		// 1. Install gh CLI
		const ghCheck = runSilent('which gh', { ignoreError: true })
		if (!ghCheck.success) {
			if (IS_MAC)
				run('brew install gh')
			else
				run('sudo apt update && sudo apt install -y gh')
			ok('GitHub CLI installed')
		}
		else
			ok('GitHub CLI already installed')

		// 2. Create ~/.ssh
		if (!isDir(SSH_DIR))
			run(`mkdir -p ${SSH_DIR} && chmod 700 ${SSH_DIR}`)

		// 3. Personal key
		const personalKey = path.join(SSH_DIR, 'id_ed25519')
		if (!exists(personalKey)) {
			run(`ssh-keygen -t ed25519 -C "sam.freeman.55@gmail.com" -f ${personalKey} -N ""`)
			ok('Personal SSH key generated')
		}
		else
			ok('Personal SSH key already exists')

		// 4. PayOnward key
		const payonwardKey = path.join(SSH_DIR, 'id_ed25519_payonward')
		if (!exists(payonwardKey)) {
			run(`ssh-keygen -t ed25519 -C "sfreeman@pay-onward.com" -f ${payonwardKey} -N ""`)
			ok('PayOnward SSH key generated')
		}
		else
			ok('PayOnward SSH key already exists')

		// 5. SSH config
		const sshConfig = `# Personal GitHub (samfreeman)
Host github.com-personal
\tHostName github.com
\tUser git
\tIdentityFile ~/.ssh/id_ed25519

# PayOnward GitHub (SamAtPayOnward)
Host github.com-payonward
\tHostName github.com
\tUser git
\tIdentityFile ~/.ssh/id_ed25519_payonward
`
		const configPath = path.join(SSH_DIR, 'config')
		fs.writeFileSync(configPath, sshConfig, { mode: 0o600 })
		ok('SSH config written')

		// Validate
		const checks = [
			exists(personalKey),
			exists(payonwardKey),
			exists(configPath)
		]
		return { success: checks.every(Boolean) }
	}
}
