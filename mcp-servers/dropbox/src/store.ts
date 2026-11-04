export interface Store {
	get(key: string): Promise<string | null>
	put(key: string, value: string, ttlSeconds?: number): Promise<void>
	delete(key: string): Promise<void>
}

export const kvStore = (kv: KVNamespace): Store => ({
	get: key => kv.get(key),
	put: (key, value, ttlSeconds) => kv.put(key, value, ttlSeconds == null ? undefined : { expirationTtl: ttlSeconds }),
	delete: key => kv.delete(key)
})

export function memoryStore(): Store {
	const values = new Map<string, string>()
	return {
		get: async key => values.get(key) ?? null,
		put: async (key, value) => {
			values.set(key, value)
		},
		delete: async key => {
			values.delete(key)
		}
	}
}
