import fs from 'node:fs'
import path from 'node:path'

const LT = '‹'
const GT = '›'
const langs = { '.html': 'html', '.js': 'js' }

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
		entry.isDirectory()
			? walk(path.join(dir, entry.name))
			: [path.join(dir, entry.name)])
}

const encode = text =>
	text.replaceAll('<', LT).replaceAll('>', GT)

const hasMarks = text =>
	text.includes(LT) || text.includes(GT)

const root = process.argv[2]
if (root == null) {
	console.error('usage: node readable-copies.mjs <exported-tree>')
	process.exit(2)
}

// 1. Every Markdown file: voice's reader strips tag-like spans from any file, so less-than
// and greater-than become U+2039 / U+203A. A source that already holds those characters
// couldn't be decoded unambiguously, so it stops the sync.
const markdown = walk(root).filter(f => f.endsWith('.md'))
for (const file of markdown) {
	const source = fs.readFileSync(file, 'utf8')
	if (hasMarks(source))
		throw new Error(`${path.relative(root, file)} contains U+2039 or U+203A; write "less-than" / "greater-than" in words instead`)
	fs.writeFileSync(file, encode(source))
}

// 2. Readable copies of the templates' .html and .js, written after step 1 so they aren't encoded twice.
for (const file of walk(path.join(root, 'wag', 'templates'))) {
	const lang = langs[path.extname(file)]
	if (lang == null)
		continue
	const name = path.basename(file)
	const source = fs.readFileSync(file, 'utf8')
	if (hasMarks(source) || source.includes('```'))
		throw new Error(`${path.relative(root, file)} contains U+2039, U+203A or a code fence, so its readable copy couldn't be reversed exactly`)

	const encoded = encode(source)
	const note = encoded == source
		? `Readable copy of \`${name}\` for tools that strip or skip script files. \`${name}\` is the source; this block is it, unmodified.`
		: `Readable copy of \`${name}\` for tools that strip anything tag-like. \`${name}\` is the source. In the block below every less-than sign is written as U+2039 and every greater-than sign as U+203A; turn them back to get \`${name}\` exactly. The original contains neither character of its own, so the swap is exact.`
	const body = encoded.endsWith('\n') ? encoded : `${encoded}\n`
	fs.writeFileSync(`${file}.md`, `${note}\n\n\`\`\`${lang}\n${body}\`\`\`\n`)
}
