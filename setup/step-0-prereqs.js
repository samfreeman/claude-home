const {
	ok, fail, warn, info, confirm,
	runSilent, isDir, detectWinAppData, saveState, probe
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

		// Detect Windows %APPDATA% and store it
		info('')
		info('Detecting Windows environment...')
		const winAppData = detectWinAppData()
		if (winAppData) {
			state.winAppData = winAppData
			ok(`Windows AppData: ${winAppData}`)
		}
		else
			fail('Could not detect Windows %APPDATA%')

		// Validate Node on Windows
		const nodeCheck = runSilent('cmd.exe /c "node --version"', { ignoreError: true })
		if (nodeCheck.success)
			ok(`Windows Node.js: ${nodeCheck.output.trim()}`)
		else
			fail('Windows Node.js not found — install from https://nodejs.org/')

		// Validate VS Code available from WSL
		const codeCheck = runSilent('which code', { ignoreError: true })
		if (codeCheck.success)
			ok('VS Code available from WSL')
		else
			warn('VS Code `code` command not found — install VS Code on Windows with WSL extension')

		// Check Dropbox folder exists using detected Windows home
		if (winAppData) {
			const winHome = winAppData.replace(/\/AppData\/Roaming$/, '')
			const dropboxBase = `${winHome}/Dropbox`
			if (isDir(dropboxBase))
				ok(`Dropbox folder found: ${dropboxBase}`)
			else
				warn(`Dropbox folder not found at ${dropboxBase} — may need to sync first`)
		}

		saveState(state)

		return {
			success: winAppData != null && nodeCheck.success
		}
	}
}
