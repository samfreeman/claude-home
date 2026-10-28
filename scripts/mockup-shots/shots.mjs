import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const dark = args.includes('--dark')
const file = args.find(a => !a.startsWith('--'))
if (file == null) {
	console.error('usage: node shots.mjs <.wag/mockups/mockup.html> [--dark]')
	process.exit(2)
}

const html = path.resolve(file)
const mockupsDir = path.dirname(html)
const screensDir = path.join(mockupsDir, 'screens')
const docsDir = path.join(mockupsDir, '..', 'docs')
fs.mkdirSync(screensDir, { recursive: true })

const slug = s =>
	s.replace(/[[\]]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'index'

const fromDocs = p =>
	path.relative(docsDir, p).split(path.sep).join('/')

const browser = await chromium.launch()
try {
	const page = await browser.newPage({
		viewport: { width: 1024, height: 768 },
		colorScheme: dark ? 'dark' : 'light',
		reducedMotion: 'reduce'
	})
	await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' })
	await page.evaluate(on =>
		document.documentElement.classList.toggle('dark', on), dark)
	await page.addStyleTag({ content: '[data-review] { display: none !important }' })
	await page.evaluate(() => document.fonts.ready)

	const shots = []
	for (const route of await page.locator('[data-route]').all()) {
		const r = await route.getAttribute('data-route')
		const state = await route.getAttribute('data-state')
		const name = await route.getAttribute('data-page') ?? r
		const sections = await route.locator('[data-landing]').all()
		if (sections.length > 0) {
			for (const section of sections) {
				const s = await section.getAttribute('data-landing')
				shots.push({ name: `${name} — ${s}`, base: `landing-${slug(s)}`, el: section })
			}
		}
		else
			shots.push({ name, base: slug(r) + (state ? `-${slug(state)}` : ''), el: route })
	}
	if (shots.length == 0)
		throw new Error(`no [data-route] sections in ${html}`)

	const seen = new Set()
	for (const shot of shots) {
		const png = path.join(screensDir, `${shot.base}${dark ? '-dark' : ''}.png`)
		if (seen.has(png))
			throw new Error(`two sections map to ${path.basename(png)} — give them distinct data-state / data-landing values`)
		seen.add(png)
		await shot.el.screenshot({ path: png, animations: 'disabled' })
		console.log(`[![${shot.name}](${fromDocs(png)})](${fromDocs(html)})`)
	}
	console.error(`${shots.length} screenshots -> ${screensDir}`)
}
finally {
	await browser.close()
}
