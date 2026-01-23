import { test, expect } from '@playwright/test'

const API_URL = 'http://localhost:3199'

test.describe('Clear Messages', () => {
	test.beforeEach(async ({ request }) => {
		await request.delete(`${API_URL}/api/v1/messages`)
	})

	test('displays messages when sent via API', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: {
				role: 'dev',
				type: 'chat',
				content: 'Test message 1'
			}
		})

		await expect(page.getByText('Test message 1')).toBeVisible()
	})

	test('clears messages when clear API is called', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: {
				role: 'dev',
				type: 'chat',
				content: 'Message to be cleared'
			}
		})

		await expect(page.getByText('Message to be cleared')).toBeVisible()

		await request.delete(`${API_URL}/api/v1/messages`)

		await expect(page.getByText('Message to be cleared')).not.toBeVisible()
	})

	test('clears multiple messages at once', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'dev', type: 'chat', content: 'First message' }
		})
		await expect(page.getByText('First message')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'pm', type: 'chat', content: 'Second message' }
		})
		await expect(page.getByText('Second message')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'architect', type: 'chat', content: 'Third message' }
		})
		await expect(page.getByText('Third message')).toBeVisible()

		await request.delete(`${API_URL}/api/v1/messages`)

		await expect(page.getByText('First message')).not.toBeVisible()
		await expect(page.getByText('Second message')).not.toBeVisible()
		await expect(page.getByText('Third message')).not.toBeVisible()
	})

	test('can add new messages after clearing', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'dev', type: 'chat', content: 'Old message' }
		})
		await expect(page.getByText('Old message')).toBeVisible()

		await request.delete(`${API_URL}/api/v1/messages`)
		await expect(page.getByText('Old message')).not.toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'dev', type: 'chat', content: 'New message after clear' }
		})

		await expect(page.getByText('New message after clear')).toBeVisible()
	})

	test('state is reset after clear', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/state`, {
			data: {
				app: 'testapp',
				mode: 'DEV',
				context: 'Testing clear',
				pbi: 'PBI-007'
			}
		})

		await expect(page.locator('span').filter({ hasText: /^DEV$/ })).toBeVisible()

		await request.delete(`${API_URL}/api/v1/messages`)

		const stateResponse = await request.get(`${API_URL}/api/v1/state`)
		const stateData = await stateResponse.json()
		expect(stateData.state.header.mode).toBeNull()
	})

	test('clear button with confirm removes messages', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'dev', type: 'chat', content: 'Message to clear via button' }
		})
		await expect(page.getByText('Message to clear via button')).toBeVisible()

		await page.getByTitle('Clear messages').click()
		await expect(page.getByRole('dialog')).toBeVisible()
		await page.getByRole('button', { name: 'Clear' }).click()

		await expect(page.getByText('Message to clear via button')).not.toBeVisible()
	})

	test('clear button with cancel keeps messages', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		await request.post(`${API_URL}/api/v1/messages`, {
			data: { role: 'dev', type: 'chat', content: 'Message to keep' }
		})
		await expect(page.getByText('Message to keep')).toBeVisible()

		await page.getByTitle('Clear messages').click()
		await expect(page.getByRole('dialog')).toBeVisible()
		await page.getByRole('button', { name: 'Cancel' }).click()

		await expect(page.getByText('Message to keep')).toBeVisible()
	})
})
