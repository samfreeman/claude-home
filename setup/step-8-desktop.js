const fs = require('fs')
const path = require('path')
const {
	IS_MAC, IS_WSL,
	ok, fail, info, confirm, run, isDir,
	detectClaudeDesktopDir, saveState
} = require('./utils')
const { generateDesktopConfig } = require('./configs')

module.exports = {
	id: '8-desktop',
	name: 'Claude Desktop',
	platforms: ['wsl', 'mac'],

	detect(state) {
		const desktopDir = state.claudeDesktopDir || detectClaudeDesktopDir(state)
		if (!desktopDir) return { configDir: null, configExists: false }

		const configPath = path.join(desktopDir, 'claude_desktop_config.json')
		let configValid = false
		if (fs.existsSync(configPath)) {
			try {
				JSON.parse(fs.readFileSync(configPath, 'utf8'))
				configValid = true
			}
			catch {}
		}

		return {
			configDir: desktopDir,
			configExists: fs.existsSync(configPath),
			configValid
		}
	},

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

		const detected = this.detect(state)
		if (!detected.configDir) {
			fail('Could not detect Claude Desktop config directory')
			return { success: false, message: 'Config dir unknown' }
		}

		state.claudeDesktopDir = detected.configDir
		saveState(state)

		// On Mac, write the config now (WSL wrote it in step 7)
		if (IS_MAC) {
			if (!isDir(detected.configDir))
				run(`mkdir -p "${detected.configDir}"`)

			const desktopConfig = generateDesktopConfig(state)
			const configPath = path.join(detected.configDir, 'claude_desktop_config.json')
			fs.writeFileSync(configPath, JSON.stringify(desktopConfig, null, 2) + '\n')
			ok('claude_desktop_config.json written')
		}

		// Validate — re-check after potential write
		const post = this.detect(state)
		if (post.configExists) {
			ok(`Claude Desktop config found at ${post.configDir}`)
			return { success: true }
		}

		fail(`Config not found at ${post.configDir}`)
		return { success: false }
	}
}
