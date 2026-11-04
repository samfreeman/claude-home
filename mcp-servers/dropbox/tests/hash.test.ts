import { describe, expect, it } from 'vitest'
import { contentHash } from '../src/dropbox/hash'

const sha = async (bytes: Uint8Array) =>
	new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))

const hex = (bytes: Uint8Array) =>
	Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

describe('contentHash', () => {
	it('hashes an empty file as the SHA-256 of nothing', async () => {
		expect(await contentHash(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
	})

	it('hashes the concatenated digests of 4 MiB blocks', async () => {
		const block = 4 * 1024 * 1024
		const bytes = new Uint8Array(block + 10).map((_, i) => i % 251)
		const first = await sha(bytes.subarray(0, block))
		const second = await sha(bytes.subarray(block))
		const joined = new Uint8Array([...first, ...second])
		expect(await contentHash(bytes)).toBe(hex(await sha(joined)))
	})

	it('hashes a small file as the digest of its single block digest', async () => {
		const bytes = new TextEncoder().encode('hello')
		expect(await contentHash(bytes)).toBe(hex(await sha(await sha(bytes))))
	})
})
