// ignoreBOM keeps a leading byte-order mark in the decoded text, so re-encoding is byte-exact.
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const encoder = new TextEncoder()

export function decodeText(bytes: Uint8Array) {
	try {
		return decoder.decode(bytes)
	}
	catch {
		return undefined
	}
}

export const encodeText = (text: string) =>
	encoder.encode(text)

export function countOccurrences(text: string, search: string) {
	let count = 0
	for (let index = text.indexOf(search); index != -1; index = text.indexOf(search, index + 1))
		count++
	return count
}

export function lineStarts(text: string) {
	if (text == '')
		return []
	const starts = [0]
	for (let index = text.indexOf('\n'); index != -1; index = text.indexOf('\n', index + 1))
		starts.push(index + 1)
	if (starts[starts.length - 1] == text.length)
		starts.pop()
	return starts
}

export function insertAtLine(text: string, line: number, insertion: string) {
	const starts = lineStarts(text)
	if (!Number.isInteger(line) || line < 1 || line > starts.length + 1)
		throw new RangeError(`line must be between 1 and ${starts.length + 1}; the file has ${starts.length} lines`)
	const offset = line <= starts.length
		? starts[line - 1]
		: text.length
	return text.slice(0, offset) + insertion + text.slice(offset)
}

export function sliceLines(text: string, start: number, end?: number) {
	const starts = lineStarts(text)
	const last = end ?? starts.length
	if (!Number.isInteger(start) || !Number.isInteger(last) || start < 1 || last < start || last > starts.length)
		throw new RangeError(`Line range ${start}-${last} is outside the file, which has ${starts.length} lines`)
	const to = last < starts.length
		? starts[last]
		: text.length
	return { text: text.slice(starts[start - 1], to), start, end: last, total: starts.length }
}

export function toBase64(bytes: Uint8Array) {
	let binary = ''
	for (let offset = 0; offset < bytes.length; offset += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
	return btoa(binary)
}
