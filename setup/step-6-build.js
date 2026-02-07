const fs = require('fs')
const path = require('path')
const {
	CLAUDE_HOME, SOURCE, MCP_SERVERS, HOME,
	ok, warn, info, confirm, run, exists, isDir, defaultDropboxCreds
} = require('./utils')
const { generateMcpJson } = require('./configs')

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
				nodeModules: isDir(path.join(pwMcp, 'node_modules')),
				dist: exists(path.join(pwMcp, 'dist/index.js'))
			},
			mcpJson: exists(path.join(CLAUDE_HOME, '.mcp.json')),
			mcpSymlink: exists(path.join(HOME, '.mcp.json')),
			projectDeps
		}
	},

	async fn(state) {
		const dropboxPath = state.dropboxPath || defaultDropboxCreds(state)

		info('This step will:')
		info('  - Build MCP servers (claude-memory-mcp, wag-mcp, playwright-mcp)')
		info('  - Install Playwright browser + system dependencies')
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

		// Install Chromium browser binary (no system deps yet)
		run('npx playwright install chromium', { cwd: pwMcp })
		ok('Chromium browser binary installed')

		// Prompt user to install OS dependencies manually (requires sudo)
		info('')
		info('Playwright requires system libraries to run Chromium.')
		info('Run this command manually:')
		console.log(`  cd ${pwMcp} && sudo npx playwright install-deps`)
		info('')

		if (!await confirm('Have you installed the system dependencies?'))
			return { success: false, message: 'User skipped Playwright deps' }

		// Build playwright-mcp after deps are installed
		run('npm run build', { cwd: pwMcp })
		ok('playwright-mcp built')

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
				warn(`${cred.src} not found in Dropbox — skipping`)
		}

		// 5. Write .mcp.json
		const mcpConfig = generateMcpJson()
		fs.writeFileSync(
			path.join(CLAUDE_HOME, '.mcp.json'),
			JSON.stringify(mcpConfig, null, '\t') + '\n'
		)
		ok('.mcp.json written')

		// Create symlink at ~/.mcp.json so Claude Code can find MCP servers from any project
		const symlinkPath = path.join(HOME, '.mcp.json')
		const targetPath = path.join(CLAUDE_HOME, '.mcp.json')
		run(`ln -sf "${targetPath}" "${symlinkPath}"`)
		ok('~/.mcp.json symlink created')

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
		const post = this.detect()
		return { success: post.memoryMcp.dist && post.wagMcp.dist && post.playwrightMcp.dist && post.mcpJson && post.mcpSymlink }
	}
}