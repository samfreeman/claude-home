import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3198',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: [
		{
			command: 'PORT=3199 DB_PATH=:memory: npx tsx server/index.ts',
			url: 'http://localhost:3199/health',
			reuseExistingServer: false
		},
		{
			command: 'NEXT_PUBLIC_API_URL=http://localhost:3199 pnpm dev --port 3198',
			url: 'http://localhost:3198',
			reuseExistingServer: false
		}
	]
})
