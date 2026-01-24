import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
	checkAdrMoved,
	checkPbiMoved,
	checkCriteriaComplete,
	runCop,
	canClear
} from './cop'
import { initDb, resetDb, saveCopSession, getLatestCopSession, type CopSession } from './db'

describe('cop checks', () => {
	let testDir: string

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cop-test-'))
		fs.mkdirSync(path.join(testDir, '.wag', 'adr', 'completed'), { recursive: true })
		fs.mkdirSync(path.join(testDir, '.wag', 'backlog', '_completed'), { recursive: true })
		initDb(':memory:')
	})

	afterEach(() => {
		resetDb()
		fs.rmSync(testDir, { recursive: true, force: true })
	})

	describe('checkAdrMoved', () => {
		it('fails when ADR not found', async () => {
			const result = await checkAdrMoved(testDir, 'PBI-001')
			expect(result.passed).toBe(false)
			expect(result.message).toContain('ADR not found')
		})

		it('passes when ADR exists', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'adr', 'completed', 'PBI-001-test.md'),
				'# ADR'
			)
			const result = await checkAdrMoved(testDir, 'PBI-001')
			expect(result.passed).toBe(true)
		})

		it('fails when completed directory missing', async () => {
			const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cop-empty-'))
			const result = await checkAdrMoved(emptyDir, 'PBI-001')
			expect(result.passed).toBe(false)
			expect(result.message).toContain('not found')
			fs.rmSync(emptyDir, { recursive: true, force: true })
		})
	})

	describe('checkPbiMoved', () => {
		it('fails when PBI not in completed', async () => {
			const result = await checkPbiMoved(testDir, 'PBI-001')
			expect(result.passed).toBe(false)
			expect(result.message).toContain('PBI not found')
		})

		it('passes when PBI exists in completed', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'backlog', '_completed', 'PBI-001.md'),
				'# PBI'
			)
			const result = await checkPbiMoved(testDir, 'PBI-001')
			expect(result.passed).toBe(true)
		})
	})

	describe('checkCriteriaComplete', () => {
		it('fails when criteria unchecked', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'backlog', '_completed', 'PBI-001.md'),
				'- [x] Done\n- [ ] Not done'
			)
			const result = await checkCriteriaComplete(testDir, 'PBI-001')
			expect(result.passed).toBe(false)
			expect(result.message).toContain('unchecked')
		})

		it('passes when all criteria checked', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'backlog', '_completed', 'PBI-001.md'),
				'- [x] Done\n- [x] Also done'
			)
			const result = await checkCriteriaComplete(testDir, 'PBI-001')
			expect(result.passed).toBe(true)
		})

		it('fails when no criteria found', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'backlog', '_completed', 'PBI-001.md'),
				'# PBI with no criteria'
			)
			const result = await checkCriteriaComplete(testDir, 'PBI-001')
			expect(result.passed).toBe(false)
			expect(result.message).toContain('No acceptance criteria')
		})

		it('handles case-insensitive checkbox', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'backlog', '_completed', 'PBI-001.md'),
				'- [X] Done with capital X'
			)
			const result = await checkCriteriaComplete(testDir, 'PBI-001')
			expect(result.passed).toBe(true)
		})
	})

	describe('runCop', () => {
		it('returns failures when checks fail', async () => {
			const result = await runCop('testapp', testDir, 'PBI-001', {
				pbiChecks: [checkAdrMoved, checkPbiMoved]
			})
			expect(result.passed).toBe(false)
			expect(result.failures.length).toBeGreaterThan(0)
			expect(result.sessionId).toBeDefined()
		})

		it('saves session to database', async () => {
			await runCop('testapp', testDir, 'PBI-001', {
				pbiChecks: [checkAdrMoved]
			})
			const session = getLatestCopSession('testapp', 'PBI-001')
			expect(session).not.toBeNull()
			expect(session?.passed).toBe(false)
		})

		it('passes when all checks pass', async () => {
			fs.writeFileSync(
				path.join(testDir, '.wag', 'adr', 'completed', 'PBI-001-test.md'),
				'# ADR'
			)
			fs.writeFileSync(
				path.join(testDir, '.wag', 'backlog', '_completed', 'PBI-001.md'),
				'- [x] Criteria met'
			)
			const result = await runCop('testapp', testDir, 'PBI-001', {
				pbiChecks: [checkAdrMoved, checkPbiMoved, checkCriteriaComplete]
			})
			expect(result.passed).toBe(true)
			expect(result.failures).toHaveLength(0)
		})
	})

	describe('canClear', () => {
		it('allows clear when no PBI active', () => {
			const result = canClear('testapp', null)
			expect(result.allowed).toBe(true)
		})

		it('blocks clear when no cop session', () => {
			const result = canClear('testapp', 'PBI-001')
			expect(result.allowed).toBe(false)
			expect(result.reason).toContain('wag_cop must pass')
		})

		it('blocks clear when cop session failed', () => {
			const session: CopSession = {
				id: 'test-session',
				app: 'testapp',
				pbi: 'PBI-001',
				passed: false,
				failures: ['Test failed'],
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
			saveCopSession(session)

			const result = canClear('testapp', 'PBI-001')
			expect(result.allowed).toBe(false)
			expect(result.reason).toContain('wag_cop failed')
		})

		it('allows clear when cop session passed', () => {
			const session: CopSession = {
				id: 'test-session',
				app: 'testapp',
				pbi: 'PBI-001',
				passed: true,
				failures: [],
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
			saveCopSession(session)

			const result = canClear('testapp', 'PBI-001')
			expect(result.allowed).toBe(true)
		})

		it('uses latest cop session', () => {
			const failedSession: CopSession = {
				id: 'failed-session',
				app: 'testapp',
				pbi: 'PBI-001',
				passed: false,
				failures: ['First attempt failed'],
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 1000
			}
			saveCopSession(failedSession)

			const passedSession: CopSession = {
				id: 'passed-session',
				app: 'testapp',
				pbi: 'PBI-001',
				passed: true,
				failures: [],
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
			saveCopSession(passedSession)

			const result = canClear('testapp', 'PBI-001')
			expect(result.allowed).toBe(true)
		})
	})
})
