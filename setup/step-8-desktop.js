const fs = require('fs')
const path = require('path')
const {
	IS_MAC, IS_WSL, HOME,
	ok, fail, info, confirm, run, exists, isDir,
	detectClaudeDesktopDir, saveState
} = require('./utils')
const { generateDesktopConfig } = require('./configs')

module.exports = {
	id: '8-desktop',
	name: 'Claude Desktop',
	platforms: ['wsl', 'mac'],
	async fn(state) {
		info('Install Claude Desktop if not already installed.')
		info('')
		info('Download from: https://claude.ai/download')
		if (IS_WSL)
			info('Install the Windows version.')
		else
			info('Install the macOS version.')
		info('')

		if (IS_WSL)
			info('The config was written in Step 7. Just verify the app is installed.')
		else
			info('After confirming install, we will write the config file.')
		info('')

		if (!await confirm('Is Claude Desktop installed?'))
			return { success: false, message: 'User skipped' }

		// Detect or use stored desktop dir
		const desktopDir = state.claudeDesktopDir || detectClaudeDesktopDir(state)
		if (!desktopDir) {
			fail('Could not detect Claude Desktop config directory')
			return { success: false, message: 'Config dir unknown' }
		}

		state.claudeDesktopDir = desktopDir
		saveState(state)

		// On Mac, write the config now (WSL wrote it in step 7)
		if (IS_MAC) {
			if (!isDir(desktopDir))
				run(`mkdir -p "${desktopDir}"`)

			const desktopConfig = generateDesktopConfig(state)
			const configPath = path.join(desktopDir, 'claude_desktop_config.json')
			fs.writeFileSync(configPath, JSON.stringify(desktopConfig, null, 2) + '\n')
			ok('claude_desktop_config.json written')
		}

		// Validate config exists
		const configPath = path.join(desktopDir, 'claude_desktop_config.json')
		if (exists(configPath)) {
			ok(`Claude Desktop config found at ${desktopDir}`)
			return { success: true }
		}

		fail(`Config not found at ${configPath}`)
		return { success: false }
	}
}
