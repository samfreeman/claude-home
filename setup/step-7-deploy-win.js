const fs = require('fs')
const path = require('path')
const {
	MCP_SERVERS,
	ok, fail, info, confirm, run, exists, saveState, detectWinAppData
} = require('./utils')
const { generateDesktopConfig, wslToWinPath } = require('./configs')

module.exports = {
	id: '7-deploy-win',
	name: 'Deploy to Windows',
	platforms: ['wsl'],

	detect(state) {
		const winAppData = state.winAppData || detectWinAppData()
		if (!winAppData) return { winAppData: null }

		const winMcpBase = `${winAppData}/Claude/mcp-servers`
		const claudeDesktopDir = `${winAppData}/Claude`
		const configPath = path.join(claudeDesktopDir, 'claude_desktop_config.json')

		let configValid = false
		if (exists(configPath)) {
			try {
				JSON.parse(fs.readFileSync(configPath, 'utf8'))
				configValid = true
			}
			catch {}
		}

		return {
			memoryDist: exists(`${winMcpBase}/claude-memory-mcp/dist/index.js`),
			memoryModules: exists(`${winMcpBase}/claude-memory-mcp/node_modules`),
			wagDist: exists(`${winMcpBase}/wag-mcp/dist/index.js`),
			wagModules: exists(`${winMcpBase}/wag-mcp/node_modules`),
			desktopConfig: configValid
		}
	},

	async fn(state) {
		if (!state.winAppData) {
			fail('Windows AppData not detected — run step 0 first')
			return { success: false, message: 'Missing winAppData' }
		}

		const winAppData = state.winAppData
		const winMcpBase = `${winAppData}/Claude/mcp-servers`
		const claudeDesktopDir = `${winAppData}/Claude`

		info('Deploying MCP servers to Windows for Claude Desktop:')
		info(`  Target: ${winMcpBase}`)
		info('')
		info('  1. claude-memory-mcp (dist + package.json + .env + npm install)')
		info('  2. wag-mcp (dist + package.json + npm install)')
		info('  3. Write claude_desktop_config.json')
		info('')

		if (!await confirm('Continue?'))
			return { success: false, message: 'User skipped' }

		// Ensure target directories exist
		run(`mkdir -p "${winMcpBase}/claude-memory-mcp"`)
		run(`mkdir -p "${winMcpBase}/wag-mcp"`)

		// 1. Deploy claude-memory-mcp
		const memSrc = path.join(MCP_SERVERS, 'claude-memory-mcp')
		const memDst = `${winMcpBase}/claude-memory-mcp`

		run(`cp -r ${memSrc}/dist ${memSrc}/package.json ${memDst}/`)
		// Copy .env if it exists
		const envFile = path.join(memSrc, '.env')
		if (exists(envFile))
			run(`cp ${envFile} ${memDst}/`)
		// npm install on Windows side — inner quotes handle paths with spaces
		run(`cmd.exe /c "cd /d ""${wslToWinPath(memDst)}"" && npm install --omit=dev"`)
		ok('claude-memory-mcp deployed to Windows')

		// 2. Deploy wag-mcp
		const wagSrc = path.join(MCP_SERVERS, 'wag-mcp')
		const wagDst = `${winMcpBase}/wag-mcp`

		run(`cp -r ${wagSrc}/dist ${wagSrc}/package.json ${wagDst}/`)
		run(`cmd.exe /c "cd /d ""${wslToWinPath(wagDst)}"" && npm install --omit=dev"`)
		ok('wag-mcp deployed to Windows')

		// 3. Write claude_desktop_config.json
		// Store the desktop dir in state for step 8 validation
		state.claudeDesktopDir = claudeDesktopDir
		saveState(state)

		const desktopConfig = generateDesktopConfig(state)
		const configPath = path.join(claudeDesktopDir, 'claude_desktop_config.json')
		run(`mkdir -p "${claudeDesktopDir}"`)
		fs.writeFileSync(configPath, JSON.stringify(desktopConfig, null, 2) + '\n')
		ok(`claude_desktop_config.json written to ${claudeDesktopDir}`)

		// Validate
		const checks = [
			exists(`${memDst}/dist/index.js`),
			exists(`${wagDst}/dist/index.js`),
			exists(configPath)
		]
		checks.forEach((c, i) => {
			const labels = ['memory-mcp dist', 'wag-mcp dist', 'desktop config']
			if (c) ok(labels[i])
			else fail(labels[i])
		})

		return { success: checks.every(Boolean) }
	}
}
