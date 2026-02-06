const {
	ok, fail, warn, info, confirm,
	isDir, detectWinAppData, saveState, probe
} = require('./utils')

module.exports = {
	id: '0-prereqs',
	name: 'Windows Prerequisites',
	platforms: ['wsl'],

	detect() {
		const winAppData = detectWinAppData()
		const nodeCheck = probe('cmd.exe /c "node --version"')
		const codeCheck = probe('which code')

		let dropboxFolder = false
		if (winAppData) {
			const winHome = winAppData.replace(/\/AppData\/Roaming$/, '')
			dropboxFolder = isDir(`${winHome}/Dropbox`)
		}

		return {
			winAppData,
			windowsNode: nodeCheck.ok ? nodeCheck.output : null,
			vsCode: codeCheck.ok,
			dropboxFolder
		}
	},

	async fn(state) {
		info('This step ensures Windows-side prerequisites are installed.')
		info('')
		info('You need:')
		info('  1. Dropbox — installed and syncing')
		info('  2. Node.js — installed on Windows (for Windows-native MCP servers)')
		info('  3. VS Code — installed on Windows with WSL extension')
		info('')
		info('Install from:')
		info('  - https://www.dropbox.com/install')
		info('  - https://nodejs.org/')
		info('  - https://code.visualstudio.com/')
		info('')

		if (!await confirm('Have you installed all three?'))
			return { success: false, message: 'User skipped' }

		info('')
		info('Detecting Windows environment...')
		const detected = this.detect()

		if (detected.winAppData) {
			state.winAppData = detected.winAppData
			ok(`Windows AppData: ${detected.winAppData}`)
		}
		else
			fail('Could not detect Windows %APPDATA%')

		if (detected.windowsNode)
			ok(`Windows Node.js: ${detected.windowsNode}`)
		else
			fail('Windows Node.js not found — install from https://nodejs.org/')

		if (detected.vsCode)
			ok('VS Code available from WSL')
		else
			warn('VS Code `code` command not found — install VS Code on Windows with WSL extension')

		if (detected.winAppData) {
			const winHome = detected.winAppData.replace(/\/AppData\/Roaming$/, '')
			if (detected.dropboxFolder)
				ok(`Dropbox folder found: ${winHome}/Dropbox`)
			else
				warn(`Dropbox folder not found at ${winHome}/Dropbox — may need to sync first`)
		}

		saveState(state)

		return {
			success: detected.winAppData != null && detected.windowsNode != null
		}
	}
}
