const fs = require('fs')
const path = require('path')
const {
	IS_MAC, HOME, SOURCE, MCP_SERVERS,
	ok, warn, info, confirm, run, runSilent, exists, isDir
} = require('./utils')

module.exports = {
	id: '1-base',
	name: 'Base Setup',
	platforms: ['wsl', 'mac'],
	async fn(state) {
		info('This step will:')
		info('  - Configure npm global prefix (avoid sudo)')
		info('  - Install pnpm')
		info('  - Install claude-code CLI')
		info('  - Install Playwright browsers')
		info('  - Create ~/source directory')
		info('  - Set git identity')
		info('')

		if (!await confirm('Continue?'))
			return { success: false, message: 'User skipped' }

		// 1. npm global prefix
		const npmGlobalDir = path.join(HOME, '.npm-global')
		if (!isDir(npmGlobalDir)) {
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

		// 2. Install pnpm
		const pnpmCheck = runSilent('which pnpm', { ignoreError: true })
		if (!pnpmCheck.success) {
			run('npm install -g pnpm')
			ok('pnpm installed')
		}
		else
			ok('pnpm already installed')

		// 3. Install claude-code
		const claudeCheck = runSilent('which claude', { ignoreError: true })
		if (!claudeCheck.success) {
			run('npm install -g @anthropic-ai/claude-code')
			ok('claude-code installed')
		}
		else
			ok('claude-code already installed')

		// 4. Install playwright browsers
		const pwMcp = path.join(MCP_SERVERS, 'playwright-mcp')
		if (isDir(pwMcp)) {
			run('npx playwright install chromium', { cwd: pwMcp })
			ok('Playwright Chromium installed')
		}
		else
			warn('playwright-mcp not found — will install after clone')

		// 5. Create ~/source
		if (!isDir(SOURCE))
			run(`mkdir -p ${SOURCE}`)
		ok(`${SOURCE} ready`)

		// 6. Git identity
		run('git config --global user.name "Sam Freeman"')
		run('git config --global user.email "sam.freeman.55@gmail.com"')
		ok('Git identity configured')

		// Validate
		const checks = [
			isDir(npmGlobalDir),
			runSilent('which pnpm', { ignoreError: true }).success,
			isDir(SOURCE)
		]
		return { success: checks.every(Boolean) }
	}
}
