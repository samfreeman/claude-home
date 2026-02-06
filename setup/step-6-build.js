const path = require('path')
const {
	CLAUDE_HOME, SOURCE, MCP_SERVERS,
	ok, info, confirm, run, exists, isDir
} = require('./utils')

module.exports = {
	id: '6-build',
	name: 'Build & Configure',
	platforms: ['wsl', 'mac'],

	detect() {
		const memoryMcp = path.join(MCP_SERVERS, 'claude-memory-mcp')
		const wagMcp = path.join(MCP_SERVERS, 'wag-mcp')
		const pwMcp = path.join(MCP_SERVERS, 'playwright-mcp')

		const projects = [
			path.join(SOURCE, 'cs-bounce'),
			path.join(SOURCE, 'samx'),
			path.join(SOURCE, 'dragonpay-api')
		]
		const projectDeps = {}
		for (const proj of projects) {
			const name = path.basename(proj)
			projectDeps[name] = isDir(proj) && isDir(path.join(proj, 'node_modules'))
		}

		return {
			memoryMcp: {
				dist: exists(path.join(memoryMcp, 'dist/index.js')),
				nodeModules: isDir(path.join(memoryMcp, 'node_modules'))
			},
			wagMcp: {
				dist: exists(path.join(wagMcp, 'dist/index.js')),
				nodeModules: isDir(path.join(wagMcp, 'node_modules'))
			},
			playwrightMcp: {
				nodeModules: isDir(path.join(pwMcp, 'node_modules'))
			},
			mcpJson: exists(path.join(CLAUDE_HOME, '.mcp.json')),
			projectDeps
		}
	},

	async fn(state) {
		const dropboxPath = state.dropboxPath || require('./utils').defaultDropboxCreds(state)
		const fs = require('fs')
		const { generateMcpJson } = require('./configs')

		info('This step will:')
		info('  - Build MCP servers (claude-memory-mcp, wag-mcp)')
		info('  - Install playwright-mcp dependencies + browsers')
		info('  - Copy credential files from Dropbox')
		info('  - Write .mcp.json for Claude Code')
		info('  - Install dependencies for project repos')
		info('')

		if (!await confirm('Continue?'))
			return { success: false, message: 'User skipped' }

		// 1. Build claude-memory-mcp
		const memoryMcp = path.join(MCP_SERVERS, 'claude-memory-mcp')
		run('npm install', { cwd: memoryMcp })
		run('npm run build', { cwd: memoryMcp })
		ok('claude-memory-mcp built')

		// 2. Build wag-mcp
		const wagMcp = path.join(MCP_SERVERS, 'wag-mcp')
		run('npm install', { cwd: wagMcp })
		run('npm run build', { cwd: wagMcp })
		ok('wag-mcp built')

		// 3. Install playwright-mcp deps + browsers
		const pwMcp = path.join(MCP_SERVERS, 'playwright-mcp')
		run('npm install', { cwd: pwMcp })
		run('npx playwright install chromium', { cwd: pwMcp })
		ok('playwright-mcp dependencies + Chromium installed')

		// 4. Copy creds from Dropbox
		const credMappings = [
			{ src: 'claude-memory-mcp.env', dest: path.join(memoryMcp, '.env') },
			{ src: 'cs-bounce.env.local', dest: path.join(SOURCE, 'cs-bounce', '.env.local') },
			{ src: 'dragonpay-api.env.local', dest: path.join(SOURCE, 'dragonpay-api', '.env.local') }
		]

		for (const cred of credMappings) {
			const srcPath = path.join(dropboxPath, cred.src)
			if (exists(srcPath)) {
				fs.copyFileSync(srcPath, cred.dest)
				ok(`Copied ${cred.src}`)
			}
			else
				require('./utils').warn(`${cred.src} not found in Dropbox — skipping`)
		}

		// 5. Write .mcp.json
		const mcpConfig = generateMcpJson()
		fs.writeFileSync(
			path.join(CLAUDE_HOME, '.mcp.json'),
			JSON.stringify(mcpConfig, null, '\t') + '\n'
		)
		ok('.mcp.json written')

		// 6. Install project dependencies (detect package manager per repo)
		const projects = [
			path.join(SOURCE, 'cs-bounce'),
			path.join(SOURCE, 'samx'),
			path.join(SOURCE, 'dragonpay-api')
		]
		for (const proj of projects) {
			if (isDir(proj) && exists(path.join(proj, 'package.json'))) {
				const usePnpm = exists(path.join(proj, 'pnpm-lock.yaml'))
				const cmd = usePnpm ? 'pnpm install' : 'npm install'
				run(cmd, { cwd: proj })
				ok(`${usePnpm ? 'pnpm' : 'npm'} install: ${path.basename(proj)}`)
			}
		}

		// Validate
		const checks = [
			exists(path.join(memoryMcp, 'dist/index.js')),
			exists(path.join(wagMcp, 'dist/index.js')),
			exists(path.join(CLAUDE_HOME, '.mcp.json'))
		]
		return { success: checks.every(Boolean) }
	}
}
