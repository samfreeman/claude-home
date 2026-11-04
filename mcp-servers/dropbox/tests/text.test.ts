import { describe, expect, it } from 'vitest'
import { countOccurrences, decodeText, encodeText, insertAtLine, lineStarts, sliceLines, toBase64 } from '../src/text'

describe('decodeText / encodeText', () => {
	it('round-trips a byte-order mark, CRLF and multibyte text exactly', () => {
		const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('<p>é\r\n✓</p>\n')])
		const text = decodeText(bytes)!
		expect(text.charCodeAt(0)).toBe(0xfeff)
		expect(encodeText(text)).toEqual(bytes)
	})

	it('returns undefined for bytes that are not UTF-8', () => {
		expect(decodeText(new Uint8Array([0xff, 0xfe, 0x00]))).toBeUndefined()
	})
})

describe('countOccurrences', () => {
	it('counts overlapping matches', () => {
		expect(countOccurrences('aaa', 'aa')).toBe(2)
		expect(countOccurrences('<a><a>', '<a>')).toBe(2)
		expect(countOccurrences('abc', 'x')).toBe(0)
	})
})

describe('lines', () => {
	it('treats a trailing newline as ending the last line, not starting a new one', () => {
		expect(lineStarts('')).toEqual([])
		expect(lineStarts('a')).toEqual([0])
		expect(lineStarts('a\n')).toEqual([0])
		expect(lineStarts('a\nb')).toEqual([0, 2])
		expect(lineStarts('a\r\nb\n')).toEqual([0, 3])
	})

	it('inserts at the start of a line, or at the end', () => {
		expect(insertAtLine('one\ntwo\n', 1, 'zero\n')).toBe('zero\none\ntwo\n')
		expect(insertAtLine('one\ntwo\n', 2, 'mid\n')).toBe('one\nmid\ntwo\n')
		expect(insertAtLine('one\ntwo\n', 3, 'three\n')).toBe('one\ntwo\nthree\n')
		expect(insertAtLine('', 1, 'first')).toBe('first')
	})

	it('rejects lines outside the file', () => {
		expect(() => insertAtLine('one\n', 0, 'x')).toThrow(RangeError)
		expect(() => insertAtLine('one\n', 3, 'x')).toThrow(/between 1 and 2/)
	})

	it('slices lines verbatim, keeping their line endings', () => {
		const text = 'a\r\nb\nc'
		expect(sliceLines(text, 2)).toEqual({ text: 'b\nc', start: 2, end: 3, total: 3 })
		expect(sliceLines(text, 1, 1).text).toBe('a\r\n')
		expect(() => sliceLines(text, 2, 9)).toThrow(RangeError)
	})
})

describe('toBase64', () => {
	it('encodes bytes', () => {
		expect(toBase64(new Uint8Array([0, 255, 1]))).toBe('AP8B')
	})
})
