import fs from 'fs'
import path from 'path'

const TS_MARKERS = ['package.json', 'tsconfig.json']

function hasMarker(dir: string, marker: string): boolean {
	return fs.existsSync(path.join(dir, marker))
}

export function findProjectRoot(startDir: string): string | null {
	let dir = path.resolve(startDir)
	const root = path.parse(dir).root

	while (dir !== root) {
		if (hasMarker(dir, '.git') && TS_MARKERS.some(m => hasMarker(dir, m)))
			return dir
		dir = path.dirname(dir)
	}

	return null
}
