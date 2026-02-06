const path = require('path')
const {
	ok, fail, info, askDefault, exists, defaultDropboxCreds, saveState
} = require('./utils')

const EXPECTED_FILES = [
	'claude-memory-mcp.env',
	'cs-bounce.env.local',
	'dragonpay-api.env.local'
]

module.exports = {
	id: '5-dropbox',
	name: 'Verify Dropbox',
	platforms: ['wsl', 'mac'],
	async fn(state) {
		const detected = defaultDropboxCreds(state)

		info('Dropbox should be installed and syncing.')
		info('The setup needs credential files from your Dropbox.')
		info('')
		info('Expected files:')
		for (const f of EXPECTED_FILES)
			info(`  ${f}`)
		info('')

		const dropboxPath = await askDefault('Dropbox creds path', detected)
		state.dropboxPath = dropboxPath
		saveState(state)

		info('')

		// Validate each expected file
		let allFound = true
		for (const file of EXPECTED_FILES) {
			const fullPath = path.join(dropboxPath, file)
			if (exists(fullPath))
				ok(file)
			else {
				fail(`${file} not found at ${fullPath}`)
				allFound = false
			}
		}

		return { success: allFound }
	}
}
