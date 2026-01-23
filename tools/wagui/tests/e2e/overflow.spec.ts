import { test, expect } from '@playwright/test'

const API_URL = 'http://localhost:3199'

test.describe('Layout Overflow Protection', () => {
	test.beforeEach(async ({ request }) => {
		await request.delete(`${API_URL}/api/v1/messages`)
	})

	test('long context message does not expand layout beyond viewport', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		// Send a very long context message that would break layout without overflow protection
		const longContent = 'This_is_a_very_long_unbroken_string_that_should_not_expand_the_layout_'.repeat(20)

		await request.post(`${API_URL}/api/v1/state`, {
			data: {
				app: 'testapp',
				mode: 'DEV',
				context: longContent
			}
		})

		// Wait for message to appear
		await page.waitForTimeout(500)

		// Check the document body doesn't have horizontal scroll
		const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
		const bodyClientWidth = await page.evaluate(() => document.body.clientWidth)

		// Body should not expand beyond its client width (no horizontal scrollbar on page)
		expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth)
	})

	test('long chat message does not expand layout beyond viewport', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		// Send a very long chat message
		const longContent = 'ThisIsAVeryLongUnbrokenWordThatShouldNotExpandTheLayoutBeyondTheViewport'.repeat(10)

		await request.post(`${API_URL}/api/v1/messages`, {
			data: {
				role: 'dev',
				type: 'chat',
				content: longContent
			}
		})

		// Wait for message to appear
		await page.waitForTimeout(500)

		// Check the document body doesn't have horizontal scroll
		const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
		const bodyClientWidth = await page.evaluate(() => document.body.clientWidth)

		// Body should not expand beyond its client width
		expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth)
	})

	test('multiple long messages maintain stable layout', async ({ page, request }) => {
		await page.goto('/')
		await expect(page.getByText('Connected')).toBeVisible()

		// Send several long messages
		for (let i = 0; i < 3; i++) {
			await request.post(`${API_URL}/api/v1/messages`, {
				data: {
					role: 'dev',
					type: 'context',
					content: `Long_context_message_number_${i}_`.repeat(30)
				}
			})
		}

		await page.waitForTimeout(500)

		// Check the document body doesn't have horizontal scroll
		const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
		const bodyClientWidth = await page.evaluate(() => document.body.clientWidth)

		// Body should not expand beyond its client width
		expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth)
	})
})
