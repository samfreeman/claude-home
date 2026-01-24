import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

export interface GateResult {
	passed: boolean
	copPassed: boolean
	copOutput: string
	failures: string[]
	sessionId: string
}

async function runLint(appRoot: string): Promise<{ passed: boolean; output: string }> {
	try {
		const { stdout } = await execAsync('pnpm lint', { cwd: appRoot })
		return { passed: true, output: stdout || 'Lint passed' }
	}
	catch (error) {
		const err = error as { stderr?: string; stdout?: string }
		const output = err.stderr || err.stdout || 'Unknown lint error'
		return { passed: false, output }
	}
}

async function runTests(appRoot: string): Promise<{ passed: boolean; output: string }> {
	try {
		const { stdout } = await execAsync('pnpm test', { cwd: appRoot })
		return { passed: true, output: stdout || 'Tests passed' }
	}
	catch (error) {
		const err = error as { stderr?: string; stdout?: string }
		const output = err.stderr || err.stdout || 'Unknown test error'
		return { passed: false, output }
	}
}

async function getGitDiff(appRoot: string): Promise<string> {
	try {
		const { stdout } = await execAsync('git diff HEAD', { cwd: appRoot })
		return stdout || '(no changes)'
	}
	catch {
		return '(failed to get diff)'
	}
}

async function readAdr(appRoot: string, pbi: string): Promise<string | null> {
	const activeDir = path.join(appRoot, '.wag', 'adr', 'active')
	const completedDir = path.join(appRoot, '.wag', 'adr', 'completed')

	// Check active first
	if (fs.existsSync(activeDir)) {
		const files = fs.readdirSync(activeDir)
		const adrFile = files.find(f => f.startsWith(pbi) && f.endsWith('.md'))
		if (adrFile)
			return fs.readFileSync(path.join(activeDir, adrFile), 'utf-8')
	}

	// Then completed
	if (fs.existsSync(completedDir)) {
		const files = fs.readdirSync(completedDir)
		const adrFile = files.find(f => f.startsWith(pbi) && f.endsWith('.md'))
		if (adrFile)
			return fs.readFileSync(path.join(completedDir, adrFile), 'utf-8')
	}

	return null
}

export async function runGate(
	appRoot: string,
	pbi: string,
	broadcast: (event: string, data: unknown) => void
): Promise<GateResult> {
	const sessionId = randomUUID()
	const failures: string[] = []
	const outputs: string[] = []

	// Run lint
	broadcast('gate', { type: 'cop-start', step: 'lint', pbi, sessionId })
	const lintResult = await runLint(appRoot)
	outputs.push(`=== LINT ===\n${lintResult.output}`)
	if (!lintResult.passed)
		failures.push(`Lint failed: ${lintResult.output.split('\n').slice(0, 5).join('\n')}`)
	broadcast('gate', { type: 'cop-step', step: 'lint', passed: lintResult.passed, output: lintResult.output, sessionId })

	// Run tests
	broadcast('gate', { type: 'cop-start', step: 'tests', pbi, sessionId })
	const testResult = await runTests(appRoot)
	outputs.push(`=== TESTS ===\n${testResult.output}`)
	if (!testResult.passed)
		failures.push(`Tests failed: ${testResult.output.split('\n').slice(0, 10).join('\n')}`)
	broadcast('gate', { type: 'cop-step', step: 'tests', passed: testResult.passed, output: testResult.output, sessionId })

	const copPassed = failures.length == 0
	const copOutput = outputs.join('\n\n')

	// Broadcast cop summary
	broadcast('gate', {
		type: 'cop-complete',
		pbi,
		passed: copPassed,
		failures,
		output: copOutput,
		sessionId
	})

	// If cop failed, return early
	if (!copPassed) {
		return {
			passed: false,
			copPassed: false,
			copOutput,
			failures,
			sessionId
		}
	}

	// Get diff and ADR for architect review
	const diff = await getGitDiff(appRoot)
	const adr = await readAdr(appRoot, pbi)

	// Broadcast architect context (for the agent to use)
	broadcast('gate', {
		type: 'architect-ready',
		pbi,
		diff,
		adr,
		sessionId
	})

	return {
		passed: copPassed, // Architect will determine final pass
		copPassed: true,
		copOutput,
		failures: [],
		sessionId
	}
}