const blockSize = 4 * 1024 * 1024

const sha256 = async (bytes: Uint8Array) =>
	new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

// Dropbox content_hash: SHA-256 of the concatenated SHA-256 digests of each 4 MiB block.
export async function contentHash(bytes: Uint8Array) {
	const blocks = Math.ceil(bytes.length / blockSize)
	const joined = new Uint8Array(blocks * 32)
	for (let index = 0; index < blocks; index++)
		joined.set(await sha256(bytes.subarray(index * blockSize, (index + 1) * blockSize)), index * 32)
	return toHex(await sha256(joined))
}
