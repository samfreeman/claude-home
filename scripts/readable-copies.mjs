import fs from 'node:fs'
import path from 'node:path'

const langs = { '.html': 'html', '.js': 'js' }

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
		entry.isDirectory()
			? walk(path.join(dir, entry.name))
			: [path.join(dir, entry.name)])
}

const root = process.argv[2]
if (root == null) {
	console.error('usage: node readable-copies.mjs <dir>')
	process.exit(2)
}

for (const file of walk(root)) {
	const lang = langs[path.extname(file)]
	if (lang == null)
		continue
	const name = path.basename(file)
	const source = fs.readFileSync(file, 'utf8')
	if (/[‹›]/.test(source) || source.includes('```'))
		throw new Error(`${file} contains ‹, › or a code fence, so its readable copy couldn't be reversed exactly`)

	const encoded = source.replaceAll('<', '‹').replaceAll('>', '›')
	const note = encoded == source
		? `Readable copy of \`${name}\` for tools that strip or skip script files. \`${name}\` is the source; this block is it, unmodified.`
		: `Readable copy of \`${name}\` for tools that strip HTML tags, even inside code fences. \`${name}\` is the source. In the block below every \`<\` is written as \`‹\` (U+2039) and every \`>\` as \`›\` (U+203A); turn them back to get \`${name}\` exactly. The original contains no \`‹\` or \`›\` of its own, so the swap is exact.`
	const body = encoded.endsWith('\n') ? encoded : `${encoded}\n`
	fs.writeFileSync(`${file}.md`, `${note}\n\n\`\`\`${lang}\n${body}\`\`\`\n`)
}
