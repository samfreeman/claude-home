const path = require('path')
const {
	SOURCE, ok, warn, info, confirm, askDefault, isDir, run
} = require('./utils')

module.exports = {
	id: '9-unity',
	name: 'Unity (Optional)',
	platforms: ['wsl'],
	async fn(state) {
		info('This step is optional. Unity Hub is only needed for game development.')
		info('')
		info('If you want Unity:')
		info('  1. Install Unity Hub from https://unity.com/download')
		info('  2. Install a Unity editor version through the Hub')
		info('')

		const wantUnity = await confirm('Set up Unity?')
		if (!wantUnity) {
			ok('Unity setup skipped')
			return { success: true }
		}

		const defaultPath = '/mnt/c/Code/Unity'
		const unityPath = await askDefault('Windows Unity projects path', defaultPath)

		// Ensure ~/source/unity exists
		const unityDir = path.join(SOURCE, 'unity')
		if (!isDir(unityDir))
			run(`mkdir -p ${unityDir}`)

		info('')
		info(`Unity projects should be stored at: ${unityPath}`)
		info(`Access from WSL via: ${unityDir}`)

		if (isDir(unityPath))
			ok('Unity projects path exists')
		else
			warn(`${unityPath} does not exist yet — create it when needed`)

		return { success: true }
	}
}
