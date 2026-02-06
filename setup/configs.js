const fs = require('fs')
const path = require('path')
const {
	IS_MAC, IS_WSL, HOME, MCP_SERVERS, isDir, warn
} = require('./utils')

// ── .mcp.json (Claude Code) ──
// Same structure on both platforms — uses native home paths

function generateMcpJson() {
	const pwBrowsersPath = IS_MAC
		? path.join(HOME, 'Library/Caches/ms-playwright')
		: path.join(HOME, '.cache/ms-playwright')

	return {
		mcpServers: {
			playwright: {
				command: 'node',
				args: [
					path.join(MCP_SERVERS, 'playwright-mcp/cli.js'),
					'--browser', 'chromium',
					'--no-sandbox',
					'--headless'
				],
				env: {
					NODE_ENV: 'production',
					PLAYWRIGHT_BROWSERS_PATH: pwBrowsersPath
				}
			},
			wag: {
				command: 'node',
				args: [path.join(MCP_SERVERS, 'wag-mcp/dist/index.js')]
			},
			'claude-memory': {
				command: 'node',
				args: [path.join(MCP_SERVERS, 'claude-memory-mcp/dist/index.js')]
			}
		}
	}
}

// ── claude_desktop_config.json ──

function generateDesktopConfig(state) {
	if (IS_WSL) return generateDesktopConfigWSL(state)
	return generateDesktopConfigMac(state)
}

function generateDesktopConfigWSL(state) {
	const winAppData = state.winAppData
	// Convert WSL path back to Windows path for node invocation
	// /mnt/c/Users/foo/AppData/Roaming → C:\Users\foo\AppData\Roaming
	const winAppDataWin = wslToWinPath(winAppData)
	const winMcpBase = `${winAppDataWin}\\Claude\\mcp-servers`

	// Detect chromium version from playwright cache
	const chromiumDir = detectChromiumDir()

	// Dropbox path for filesystem MCP
	const dropboxBase = state.dropboxPath
		? state.dropboxPath.replace(/\/creds$/, '')
		: null

	const filesystemPaths = [
		HOME,
		'/mnt/c/Code/Unity'
	]
	if (winAppData)
		filesystemPaths.push(`${winAppData}/Claude`)
	if (dropboxBase)
		filesystemPaths.push(dropboxBase)

	const servers = {
		'claude-memory': {
			command: 'node',
			args: [`${winMcpBase}\\claude-memory-mcp\\dist\\index.js`]
		}
	}

	// Only include playwright if chromium is installed
	if (chromiumDir) {
		servers.playwright = {
			command: 'wsl',
			args: [
				'-e', 'bash', '-c',
				`PLAYWRIGHT_BROWSERS_PATH=${HOME}/.cache/ms-playwright npx -y @playwright/mcp@latest --headless --browser chromium --executable-path ${HOME}/.cache/ms-playwright/${chromiumDir}/chrome-linux/chrome`
			]
		}
	}
	else
		warn('Playwright omitted from Desktop config — chromium not installed')

	servers.filesystem = {
		command: 'wsl',
		args: [
			'npx', '-y', '@modelcontextprotocol/server-filesystem',
			...filesystemPaths
		]
	}

	return {
		mcpServers: servers,
		preferences: {
			coworkScheduledTasksEnabled: false,
			sidebarMode: 'chat'
		}
	}
}

function generateDesktopConfigMac(state) {
	const pwBrowsersPath = path.join(HOME, 'Library/Caches/ms-playwright')
	const dropboxBase = state.dropboxPath
		? state.dropboxPath.replace(/\/creds$/, '')
		: null

	const filesystemPaths = [HOME]
	if (dropboxBase)
		filesystemPaths.push(dropboxBase)

	return {
		mcpServers: {
			'claude-memory': {
				command: 'node',
				args: [path.join(MCP_SERVERS, 'claude-memory-mcp/dist/index.js')]
			},
			playwright: {
				command: 'node',
				args: [
					path.join(MCP_SERVERS, 'playwright-mcp/cli.js'),
					'--browser', 'chromium',
					'--headless'
				],
				env: {
					PLAYWRIGHT_BROWSERS_PATH: pwBrowsersPath
				}
			},
			filesystem: {
				command: 'npx',
				args: [
					'-y', '@modelcontextprotocol/server-filesystem',
					...filesystemPaths
				]
			}
		},
		preferences: {
			coworkScheduledTasksEnabled: false,
			sidebarMode: 'chat'
		}
	}
}

// ── Helpers ──

function wslToWinPath(wslPath) {
	if (!wslPath) return ''
	// /mnt/c/Users/foo → C:\Users\foo
	const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/)
	if (!match) return wslPath
	return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`
}

function detectChromiumDir() {
	const pwCachePath = path.join(HOME, '.cache/ms-playwright')
	if (isDir(pwCachePath)) {
		const dirs = fs.readdirSync(pwCachePath)
			.filter(d => d.startsWith('chromium-') && !d.includes('headless'))
		if (dirs.length > 0) return dirs[0]
	}
	warn('Could not detect Playwright chromium version — run: npx playwright install chromium')
	return null
}

module.exports = {
	generateMcpJson,
	generateDesktopConfig,
	wslToWinPath
}
