#!/usr/bin/env node
'use strict'

const {
	IS_MAC, IS_WSL, USER, HOME,
	c, ok, fail, warn, info, confirm,
	closeRL, exists,
	banner, loadState, saveState, markComplete, isComplete,
	detectWinAppData
} = require('./utils')

// ── Step Registry ──

const STEPS = [
	require('./step-0-prereqs'),
	require('./step-1-base'),
	require('./step-2-github-keys'),
	require('./step-3-github-auth'),
	require('./step-4-repos'),
	require('./step-5-dropbox'),
	require('./step-6-build'),
	require('./step-7-deploy-win'),
	require('./step-8-desktop'),
	require('./step-9-unity')
]

// ── Status Display ──

function showStatus() {
	const state = loadState()
	const platform = IS_MAC ? 'mac' : 'wsl'
	const applicable = STEPS.filter(s => s.platforms.includes(platform))

	console.log(`${c.bold}Setup Status:${c.reset}`)
	console.log('')
	for (const step of applicable) {
		if (isComplete(state, step.id))
			ok(step.name)
		else
			console.log(`  ${c.dim}-${c.reset} ${step.name}`)
	}
	const completed = applicable.filter(s => isComplete(state, s.id)).length
	console.log('')
	console.log(`${completed}/${applicable.length} steps complete`)
}

// ── Scan Display ──

function showScan() {
	const state = loadState()
	const platform = IS_MAC ? 'mac' : 'wsl'
	const applicable = STEPS.filter(s => s.platforms.includes(platform))

	console.log('')
	console.log(`${c.bold}${c.cyan}  Machine Scan${c.reset}`)
	console.log(`${c.dim}  Platform: ${IS_MAC ? 'macOS' : 'WSL (Windows)'}${c.reset}`)
	console.log(`${c.dim}  User: ${USER}${c.reset}`)
	console.log(`${c.dim}  Home: ${HOME}${c.reset}`)
	console.log('')

	for (const step of applicable) {
		if (!step.detect) continue

		console.log(`${c.bold}  ${step.name}${c.reset}`)

		try {
			const result = step.detect(state)
			renderDetect(result)
		}
		catch (err) {
			fail(`detect failed: ${err.message}`)
		}
		console.log('')
	}
}

function renderDetect(obj, indent = 4) {
	const pad = ' '.repeat(indent)
	for (const [key, val] of Object.entries(obj)) {
		if (val == null) {
			console.log(`${pad}${c.red}x${c.reset} ${key}: ${c.dim}not found${c.reset}`)
		}
		else if (typeof val == 'object' && !Array.isArray(val)) {
			console.log(`${pad}${c.dim}${key}:${c.reset}`)
			renderDetect(val, indent + 2)
		}
		else if (val === true)
			console.log(`${pad}${c.green}+${c.reset} ${key}`)
		else if (val === false)
			console.log(`${pad}${c.red}x${c.reset} ${key}`)
		else
			console.log(`${pad}${c.green}+${c.reset} ${key}: ${val}`)
	}
}

// ── Main ──

async function main() {
	const args = process.argv.slice(2)

	// --status: show progress and exit
	if (args.includes('--status')) {
		showStatus()
		process.exit(0)
	}

	// --scan: read-only machine report and exit
	if (args.includes('--scan')) {
		showScan()
		process.exit(0)
	}

	// --reset: clear state and exit
	if (args.includes('--reset')) {
		const { STATE_FILE } = require('./utils')
		if (exists(STATE_FILE)) {
			const fs = require('fs')
			fs.unlinkSync(STATE_FILE)
		}
		console.log('State reset. Run setup again to start fresh.')
		process.exit(0)
	}

	// Welcome banner
	console.log('')
	console.log(`${c.bold}${c.cyan}  Claude Code Environment Setup${c.reset}`)
	console.log(`${c.dim}  Platform: ${IS_MAC ? 'macOS' : 'WSL (Windows)'}${c.reset}`)
	console.log(`${c.dim}  User: ${USER}${c.reset}`)
	console.log(`${c.dim}  Home: ${HOME}${c.reset}`)

	const state = loadState()

	// On WSL: detect Windows AppData if not already stored
	if (IS_WSL && !state.winAppData) {
		const winAppData = detectWinAppData()
		if (winAppData) {
			state.winAppData = winAppData
			saveState(state)
			console.log(`${c.dim}  Windows AppData: ${winAppData}${c.reset}`)
		}
		else
			console.log(`${c.yellow}  Could not detect Windows AppData${c.reset}`)
	}
	else if (IS_WSL)
		console.log(`${c.dim}  Windows AppData: ${state.winAppData}${c.reset}`)

	console.log('')

	// Filter steps for current platform
	const platform = IS_MAC ? 'mac' : 'wsl'
	const applicable = STEPS.filter(s => s.platforms.includes(platform))
	const totalSteps = applicable.length

	// Find first incomplete step
	const firstIncomplete = applicable.findIndex(s => !isComplete(state, s.id))
	if (firstIncomplete == -1) {
		console.log(`${c.green}All steps complete!${c.reset} Use --reset to start over.`)
		closeRL()
		process.exit(0)
	}

	if (firstIncomplete > 0) {
		info(`Resuming from ${applicable[firstIncomplete].name}`)
		info(`(${firstIncomplete} steps already complete)`)
		console.log('')
	}

	// Run steps sequentially
	for (let i = firstIncomplete; i < applicable.length; i++) {
		const step = applicable[i]

		if (isComplete(state, step.id)) {
			ok(`${step.name} (already complete)`)
			continue
		}

		banner(i, totalSteps - 1, step.name)

		try {
			const result = await step.fn(state)

			if (result.success) {
				markComplete(state, step.id)
				console.log('')
				ok(`${step.name} complete!`)
			}
			else {
				console.log('')
				warn(`${step.name}: ${result.message || 'incomplete'}`)
				const retry = await confirm('Retry this step?')
				if (retry) {
					i--
					continue
				}
				const skip = await confirm('Skip and continue?')
				if (!skip) break
			}
		}
		catch (err) {
			console.log('')
			fail(`${step.name} failed: ${err.message}`)
			const cont = await confirm('Continue to next step?')
			if (!cont) break
		}
	}

	// Final status
	console.log('')
	showStatus()
	closeRL()
}

main().catch(err => {
	console.error('Setup failed:', err.message)
	closeRL()
	process.exit(1)
})
