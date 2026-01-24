import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { saveCopSession, getLatestCopSession, type CopSession } from './db'

const execAsync = promisify(exec)

export interface CopResult {
	passed: boolean
	failures: string[]
	sessionId: string
}

export interface CopCheckResult {
	passed: boolean
	message?: string
}

type PbiCheck = (appRoot: string, pbi: string) => Promise<CopCheckResult>
type ProjectCheck = (appRoot: string) => Promise<CopCheckResult>

export interface CopOptions {
	pbiChecks?: PbiCheck[]
	projectChecks?: ProjectCheck[]
}

async function checkAdrMoved(appRoot: string, pbi: string): Promise<CopCheckResult> {
	const completedDir = path.join(appRoot, '.wag', 'adr', 'completed')

	if (!fs.existsSync(completedDir))
		return { passed: false, message: `ADR completed directory not found: ${completedDir}` }

	const files = fs.readdirSync(completedDir)
	const adrFile = files.find(f => f.startsWith(pbi) && f.endsWith('.md'))

	if (!adrFile)
		return { passed: false, message: `ADR not found in adr/completed/${pbi}*.md` }

	return { passed: true }
}

async function checkPbiMoved(appRoot: string, pbi: string): Promise<CopCheckResult> {
	const completedPath = path.join(appRoot, '.wag', 'backlog', '_completed', `${pbi}.md`)

	if (!fs.existsSync(completedPath))
		return { passed: false, message: `PBI not found in backlog/_completed/${pbi}.md` }

	return { passed: true }
}

async function checkCriteriaComplete(appRoot: string, pbi: string): Promise<CopCheckResult> {
	const completedPath = path.join(appRoot, '.wag', 'backlog', '_completed', `${pbi}.md`)

	if (!fs.existsSync(completedPath))
		return { passed: false, message: `Cannot check criteria - PBI file not found` }

	const content = fs.readFileSync(completedPath, 'utf-8')

	const unchecked = (content.match(/- \[ \]/g) || []).length
	const checked = (content.match(/- \[x\]/gi) || []).length

	if (unchecked > 0)
		return { passed: false, message: `Acceptance criteria not complete: ${unchecked} of ${unchecked + checked} unchecked` }

	if (checked == 0)
		return { passed: false, message: `No acceptance criteria found in PBI` }

	return { passed: true }
}

async function checkLintPasses(appRoot: string): Promise<CopCheckResult> {
	try {
		await execAsync('pnpm lint', { cwd: appRoot })
		return { passed: true }
	}
	catch (error) {
		const err = error as { stderr?: string; stdout?: string }
		const output = err.stderr || err.stdout || 'Unknown lint error'
		const lines = output.split('\n').slice(0, 5).join('\n')
		return { passed: false, message: `Lint failed: ${lines}` }
	}
}

async function checkTestsPasses(appRoot: string): Promise<CopCheckResult> {
	try {
		await execAsync('pnpm test', { cwd: appRoot })
		return { passed: true }
	}
	catch (error) {
		const err = error as { stderr?: string; stdout?: string }
		const output = err.stderr || err.stdout || 'Unknown test error'
		const lines = output.split('\n').slice(0, 5).join('\n')
		return { passed: false, message: `Tests failed: ${lines}` }
	}
}

async function checkGitClean(appRoot: string): Promise<CopCheckResult> {
	try {
		const { stdout } = await execAsync('git status --porcelain', { cwd: appRoot })

		if (stdout.trim().length > 0) {
			const files = stdout.trim().split('\n').slice(0, 5)
			return { passed: false, message: `Git status not clean: ${files.join(', ')}` }
		}

		return { passed: true }
	}
	catch (error) {
		const err = error as Error
		return { passed: false, message: `Git check failed: ${err.message}` }
	}
}

const defaultPbiChecks: PbiCheck[] = [
	checkAdrMoved,
	checkPbiMoved,
	checkCriteriaComplete
]

const defaultProjectChecks: ProjectCheck[] = [
	checkLintPasses,
	checkTestsPasses,
	checkGitClean
]

export async function runCop(
	app: string,
	appRoot: string,
	pbi: string,
	options?: CopOptions
): Promise<CopResult> {
	const pbiChecks = options ? (options.pbiChecks ?? []) : defaultPbiChecks
	const projectChecks = options ? (options.projectChecks ?? []) : defaultProjectChecks
	const failures: string[] = []
	const sessionId = randomUUID()

	for (const check of pbiChecks) {
		const result = await check(appRoot, pbi)
		if (!result.passed && result.message)
			failures.push(result.message)
	}

	for (const check of projectChecks) {
		const result = await check(appRoot)
		if (!result.passed && result.message)
			failures.push(result.message)
	}

	const passed = failures.length == 0
	const now = Date.now()

	const session: CopSession = {
		id: sessionId,
		app,
		pbi,
		passed,
		failures,
		createdAt: now,
		updatedAt: now
	}

	saveCopSession(session)

	return {
		passed,
		failures,
		sessionId
	}
}

export function canClear(app: string, pbi: string | null): { allowed: boolean; reason?: string } {
	if (!pbi)
		return { allowed: true }

	const session = getLatestCopSession(app, pbi)

	if (!session)
		return { allowed: false, reason: 'wag_cop must pass before wag_clear. Call wag_cop first.' }

	if (!session.passed)
		return { allowed: false, reason: `wag_cop failed. Fix issues and run wag_cop again. Failures: ${session.failures.join('; ')}` }

	return { allowed: true }
}

export {
	checkAdrMoved,
	checkPbiMoved,
	checkCriteriaComplete,
	checkLintPasses,
	checkTestsPasses,
	checkGitClean
}