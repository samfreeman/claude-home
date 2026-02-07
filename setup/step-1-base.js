const fs = require('fs')
const path = require('path')
const {
	IS_MAC, HOME, SOURCE,
	ok, info, confirm, run, exists, isDir, probe
} = require('./utils')

module.exports = {
	id: '1-base',
	name: 'Base Setup',
	platforms: ['wsl', 'mac'],

	detect() {
		const npmGlobalDir = path.join(HOME, '.npm-global')
		const pnpmCheck = probe('which pnpm')
		const claudeCheck = probe('which claude')

		const gitName = probe('git config --global user.name')
		const gitEmail = probe('git config --global user.email')

		return {
			npmGlobalDir: isDir(npmGlobalDir),
			pnpm: pnpmCheck.ok,
			claudeCode: claudeCheck.ok,
			sourceDir: isDir(SOURCE),
			gitIdentity: {
				name: gitName.ok ? gitName.output : null,
				email: gitEmail.ok ? gitEmail.output : null
			}
		}
	},

	async fn(state) {
		info('This step will:')
		info('  - Configure npm global prefix (avoid sudo)')
		info('  - Install pnpm')
		info('  - Install claude-code CLI')
		info('  - Create ~/source directory')
		info('  - Set git identity')
		info('')

		if (!await confirm('Continue?'))
			return { success: false, message: 'User skipped' }

		info('')
		info('Checking current environment...')
		const detected = this.detect()

		// 1. npm global prefix
		const npmGlobalDir = path.join(HOME, '.npm-global')
		if (!detected.npmGlobalDir) {
			run(`mkdir -p ${npmGlobalDir}`)
			run('npm config set prefix ~/.npm-global')
		}
		ok('npm global prefix configured')

		// Ensure PATH includes npm-global/bin
		const shellRc = IS_MAC
			? path.join(HOME, '.zshrc')
			: path.join(HOME, '.bashrc')
		const rcContent = exists(shellRc) ? fs.readFileSync(shellRc, 'utf8') : ''
		if (!rcContent.includes('.npm-global/bin')) {
			fs.appendFileSync(shellRc, '\nexport PATH=~/.npm-global/bin:$PATH\n')
			ok(`Added npm-global to PATH in ${path.basename(shellRc)}`)
		}
		else
			ok('npm-global already in PATH')

		// Update PATH for current process so subsequent steps can find pnpm/claude
		const npmGlobalBin = path.join(npmGlobalDir, 'bin')
		if (!process.env.PATH.includes(npmGlobalBin))
			process.env.PATH = `${npmGlobalBin}:${process.env.PATH}`

		// 2. Install pnpm
		if (!detected.pnpm) {
			run('npm install -g pnpm')
			ok('pnpm installed')
		}
		else
			ok('pnpm already installed')

		// 3. Install claude-code
		if (!detected.claudeCode) {
			run('npm install -g @anthropic-ai/claude-code')
			ok('claude-code installed')
		}
		else
			ok('claude-code already installed')

		// 4. Create ~/source
		if (!detected.sourceDir)
			run(`mkdir -p ${SOURCE}`)
		ok(`${SOURCE} ready`)

		// 5. Git identity
		run('git config --global user.name "Sam Freeman"')
		run('git config --global user.email "sam.freeman.55@gmail.com"')
		ok('Git identity configured')

		// Validate
		return { success: isDir(npmGlobalDir) && isDir(SOURCE) }
	}
}
