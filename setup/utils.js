const fs = require('fs')
const path = require('path')
const os = require('os')
const readline = require('readline')
const { execSync } = require('child_process')

// ── OS Detection ──

const IS_MAC = process.platform == 'darwin'
const IS_WSL = process.platform == 'linux'
	&& fs.existsSync('/proc/version')
	&& fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')

if (!IS_MAC && !IS_WSL) {
	console.log('')
	console.log('  This script runs from Mac or WSL (Windows Subsystem for Linux).')
	console.log('')
	if (process.platform == 'win32') {
		console.log('  You are on native Windows. To get started:')
		console.log('')
		console.log('  1. Open PowerShell as Administrator and run:')
		console.log('     wsl --install')
		console.log('')
		console.log('  2. Restart, then open Ubuntu from the Start menu')
		console.log('')
		console.log('  3. Install Node.js inside WSL:')
		console.log('     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -')
		console.log('     sudo apt install -y nodejs')
		console.log('')
		console.log('  4. Clone this repo and run setup:')
		console.log('     git clone git@github.com:samfreeman/claude-home.git ~/.claude')
		console.log('     node ~/.claude/setup/setup.js')
		console.log('')
		console.log('  The setup script handles everything from there —')
		console.log('  including deploying to the Windows side for Claude Desktop.')
	}
	else {
		console.log(`  Detected platform: ${process.platform}`)
		console.log('  Only macOS and WSL are supported.')
	}
	console.log('')
	process.exit(1)
}

// ── Path Constants ──

const USER = os.userInfo().username
const HOME = os.homedir()
const CLAUDE_HOME = path.join(HOME, '.claude')
const SOURCE = path.join(HOME, 'source')
const SSH_DIR = path.join(HOME, '.ssh')
const MCP_SERVERS = path.join(CLAUDE_HOME, 'mcp-servers')
const STATE_FILE = path.join(CLAUDE_HOME, 'setup', 'state.json')

// ── Dynamic Path Detection ──

function detectWinAppData() {
	if (!IS_WSL) return null
	try {
		const raw = execSync('cmd.exe /c echo %APPDATA%', {
			encoding: 'utf8',
			stdio: 'pipe',
			timeout: 10000
		}).trim()
		// Convert C:\Users\foo\AppData\Roaming → /mnt/c/Users/foo/AppData/Roaming
		const drive = raw[0].toLowerCase()
		const rest = raw.slice(2).replace(/\\/g, '/')
		return `/mnt/${drive}${rest}`
	}
	catch {
		return null
	}
}

function detectClaudeDesktopDir(state) {
	if (IS_WSL) {
		const appData = state.winAppData || detectWinAppData()
		if (appData) return `${appData}/Claude`
		return null
	}
	return path.join(HOME, 'Library/Application Support/Claude')
}

function defaultDropboxCreds(state) {
	if (IS_WSL) {
		const appData = state.winAppData || detectWinAppData()
		if (appData) {
			// AppData is .../AppData/Roaming — Dropbox is typically at the user home level
			const winHome = appData.replace(/\/AppData\/Roaming$/, '')
			return `${winHome}/Dropbox/Claude/creds`
		}
		return `/mnt/c/Users/${USER}/Dropbox/Claude/creds`
	}
	return path.join(HOME, 'Dropbox/Claude/creds')
}

// ── Colors ──

const c = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m'
}

const ok = (msg) => console.log(`  ${c.green}+${c.reset} ${msg}`)
const fail = (msg) => console.log(`  ${c.red}x${c.reset} ${msg}`)
const warn = (msg) => console.log(`  ${c.yellow}!${c.reset} ${msg}`)
const info = (msg) => console.log(`  ${c.dim}${msg}${c.reset}`)

// ── Readline ──

let rl = null

function getRL() {
	if (!rl)
		rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	return rl
}

function closeRL() {
	if (rl) {
		rl.close()
		rl = null
	}
}

function ask(question) {
	return new Promise((resolve) =>
		getRL().question(question, resolve))
}

async function confirm(question) {
	const answer = await ask(`${question} (y/n) `)
	return answer.trim().toLowerCase() == 'y'
}

async function askDefault(question, defaultVal) {
	const answer = await ask(`${question} [${defaultVal}]: `)
	return answer.trim() || defaultVal
}

// ── Command Execution ──

function run(cmd, opts = {}) {
	const { silent = false, cwd = HOME, ignoreError = false } = opts
	try {
		const result = execSync(cmd, {
			cwd,
			encoding: 'utf8',
			stdio: silent ? 'pipe' : 'inherit',
			timeout: 300000
		})
		return { success: true, output: result }
	}
	catch (err) {
		if (ignoreError)
			return { success: false, output: err.stderr || err.stdout || err.message }
		throw err
	}
}

function runSilent(cmd, opts = {}) {
	return run(cmd, { ...opts, silent: true })
}

// Silent probe with configurable timeout — for detect() functions
function probe(cmd, timeout = 5000) {
	try {
		const output = execSync(cmd, {
			encoding: 'utf8',
			stdio: 'pipe',
			timeout
		}).trim()
		return { ok: true, output }
	}
	catch {
		return { ok: false, output: '' }
	}
}

// ── Filesystem ──

function exists(p) {
	return fs.existsSync(p)
}

function isDir(p) {
	return exists(p) && fs.statSync(p).isDirectory()
}

// ── Banner ──

function banner(stepNum, totalSteps, name) {
	console.log('')
	console.log(`${c.cyan}${'='.repeat(60)}${c.reset}`)
	console.log(`${c.bold}  Step ${stepNum}/${totalSteps}: ${name}${c.reset}`)
	console.log(`${c.cyan}${'='.repeat(60)}${c.reset}`)
	console.log('')
}

// ── State Management ──

function loadState() {
	if (exists(STATE_FILE))
		return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
	return { steps: {}, dropboxPath: null, winAppData: null, claudeDesktopDir: null }
}

function saveState(state) {
	const dir = path.dirname(STATE_FILE)
	if (!isDir(dir))
		fs.mkdirSync(dir, { recursive: true })
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, '\t'))
}

function markComplete(state, stepId) {
	state.steps[stepId] = {
		completed: true,
		timestamp: new Date().toISOString()
	}
	saveState(state)
}

function isComplete(state, stepId) {
	return state.steps[stepId]?.completed == true
}

// ── Exports ──

module.exports = {
	IS_MAC,
	IS_WSL,
	USER,
	HOME,
	CLAUDE_HOME,
	SOURCE,
	SSH_DIR,
	MCP_SERVERS,
	STATE_FILE,
	detectWinAppData,
	detectClaudeDesktopDir,
	defaultDropboxCreds,
	c,
	ok,
	fail,
	warn,
	info,
	ask,
	confirm,
	askDefault,
	closeRL,
	run,
	runSilent,
	probe,
	exists,
	isDir,
	banner,
	loadState,
	saveState,
	markComplete,
	isComplete
}
