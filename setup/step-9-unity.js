const path = require('path')
const {
	SOURCE, ok, warn, info, confirm, askDefault, isDir, run
} = require('./utils')

module.exports = {
	id: '9-unity',
	name: 'Unity (Optional)',
	platforms: ['wsl'],

	detect() {
		return {
			unityProjectsDir: isDir('/mnt/c/Code/Unity'),
			sourceUnityDir: isDir(path.join(SOURCE, 'unity'))
		}
	},

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

		// Create Windows Unity path if it doesn't exist
		if (!isDir(unityPath)) {
			run(`mkdir -p "${unityPath}"`)
			ok(`Created Unity projects directory: ${unityPath}`)
		}
		else
			ok('Unity projects path already exists')

		info('')
		info(`Unity projects should be stored at: ${unityPath}`)
		info(`Access from WSL via: ${unityDir}`)

		return { success: true }
	}
}
