import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb, resetDb, upsertApp, getApps, getApp } from '../db'

describe('Apps Database Functions', () => {
	beforeEach(() => {
		initDb(':memory:')
	})

	afterEach(() => {
		resetDb()
	})

	describe('upsertApp', () => {
		it('should insert a new app', () => {
			upsertApp('testapp', '/home/user/testapp', '/home/user')
			const app = getApp('testapp')

			expect(app).not.toBeNull()
			expect(app?.name).toBe('testapp')
			expect(app?.appRoot).toBe('/home/user/testapp')
			expect(app?.repoRoot).toBe('/home/user')
			expect(app?.lastUsed).toBeGreaterThan(0)
		})

		it('should update existing app', () => {
			upsertApp('testapp', '/home/user/old', '/home/user')
			const before = getApp('testapp')

			upsertApp('testapp', '/home/user/new', '/home/user/repo')
			const after = getApp('testapp')

			expect(after?.appRoot).toBe('/home/user/new')
			expect(after?.repoRoot).toBe('/home/user/repo')
			expect(after?.lastUsed).toBeGreaterThanOrEqual(before!.lastUsed)
		})

		it('should handle null repoRoot', () => {
			upsertApp('testapp', '/home/user/testapp')
			const app = getApp('testapp')

			expect(app?.repoRoot).toBeNull()
		})
	})

	describe('getApps', () => {
		it('should return empty array when no apps', () => {
			const apps = getApps()
			expect(apps).toEqual([])
		})

		it('should return all apps sorted by lastUsed desc', async () => {
			upsertApp('app1', '/path/app1')
			await new Promise(r => setTimeout(r, 10))
			upsertApp('app2', '/path/app2')
			await new Promise(r => setTimeout(r, 10))
			upsertApp('app3', '/path/app3')

			const apps = getApps()

			expect(apps.length).toBe(3)
			expect(apps[0].name).toBe('app3')
			expect(apps[1].name).toBe('app2')
			expect(apps[2].name).toBe('app1')
		})
	})

	describe('getApp', () => {
		it('should return null for non-existent app', () => {
			const app = getApp('nonexistent')
			expect(app).toBeNull()
		})

		it('should return app by name', () => {
			upsertApp('myapp', '/home/user/myapp', '/home/user')
			const app = getApp('myapp')

			expect(app).toEqual({
				name: 'myapp',
				appRoot: '/home/user/myapp',
				repoRoot: '/home/user',
				lastUsed: expect.any(Number)
			})
		})
	})
})
