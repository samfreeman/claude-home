import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
	initDb,
	saveMessage,
	getMessages,
	clearMessages,
	resetDb,
	type WagMessage
} from '../db'

function createMessage(overrides: Partial<WagMessage> = {}): WagMessage {
	return {
		id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		timestamp: Date.now(),
		header: {
			mode: 'DEV',
			app: 'test-app',
			branch: 'dev',
			context: 'Testing'
		},
		role: 'dev',
		type: 'chat',
		content: 'Test message',
		...overrides
	}
}

describe('server/db', () => {
	beforeEach(() => {
		resetDb()
		initDb(':memory:')
	})

	afterEach(() => {
		resetDb()
	})

	describe('saveMessage', () => {
		it('saves a message to the database', () => {
			const msg = createMessage({ content: 'Hello world' })
			saveMessage(msg)

			const messages = getMessages()
			expect(messages).toHaveLength(1)
			expect(messages[0].content).toBe('Hello world')
		})

		it('saves message with all fields', () => {
			const msg = createMessage({
				id: 'test-id-123',
				timestamp: 1234567890,
				header: {
					mode: 'ADR',
					app: 'my-app',
					branch: 'main',
					context: 'Creating ADR'
				},
				role: 'architect',
				type: 'proposal',
				content: 'Proposing changes',
				metadata: {
					pbi: 'PBI-001',
					task: 3,
					approved: true
				}
			})
			saveMessage(msg)

			const messages = getMessages()
			expect(messages).toHaveLength(1)
			const saved = messages[0]
			expect(saved.id).toBe('test-id-123')
			expect(saved.timestamp).toBe(1234567890)
			expect(saved.header.mode).toBe('ADR')
			expect(saved.header.app).toBe('my-app')
			expect(saved.header.branch).toBe('main')
			expect(saved.header.context).toBe('Creating ADR')
			expect(saved.role).toBe('architect')
			expect(saved.type).toBe('proposal')
			expect(saved.content).toBe('Proposing changes')
			expect(saved.metadata?.pbi).toBe('PBI-001')
			expect(saved.metadata?.task).toBe(3)
			expect(saved.metadata?.approved).toBe(true)
		})

		it('handles message without metadata', () => {
			const msg = createMessage()
			delete msg.metadata
			saveMessage(msg)

			const messages = getMessages()
			expect(messages[0].metadata).toBeUndefined()
		})

		it('replaces message with same ID (INSERT OR REPLACE)', () => {
			const msg1 = createMessage({ id: 'same-id', content: 'Original' })
			const msg2 = createMessage({ id: 'same-id', content: 'Updated' })

			saveMessage(msg1)
			saveMessage(msg2)

			const messages = getMessages()
			expect(messages).toHaveLength(1)
			expect(messages[0].content).toBe('Updated')
		})
	})

	describe('getMessages', () => {
		it('returns empty array when no messages', () => {
			const messages = getMessages()
			expect(messages).toEqual([])
		})

		it('returns messages in timestamp order', () => {
			saveMessage(createMessage({ id: 'first', timestamp: 100, content: 'First' }))
			saveMessage(createMessage({ id: 'third', timestamp: 300, content: 'Third' }))
			saveMessage(createMessage({ id: 'second', timestamp: 200, content: 'Second' }))

			const messages = getMessages()
			expect(messages[0].content).toBe('First')
			expect(messages[1].content).toBe('Second')
			expect(messages[2].content).toBe('Third')
		})

		it('respects limit parameter', () => {
			for (let i = 0; i < 10; i++)
				saveMessage(createMessage({ id: `msg-${i}` }))

			const messages = getMessages(5)
			expect(messages).toHaveLength(5)
		})

		it('defaults to limit of 100', () => {
			for (let i = 0; i < 150; i++)
				saveMessage(createMessage({ id: `msg-${i}`, timestamp: i }))

			const messages = getMessages()
			expect(messages).toHaveLength(100)
		})
	})

	describe('clearMessages', () => {
		it('removes all messages', () => {
			saveMessage(createMessage({ id: 'msg-1' }))
			saveMessage(createMessage({ id: 'msg-2' }))
			saveMessage(createMessage({ id: 'msg-3' }))

			expect(getMessages()).toHaveLength(3)

			clearMessages()

			expect(getMessages()).toHaveLength(0)
		})
	})

	describe('persistence', () => {
		it('messages persist across multiple operations', () => {
			const msg1 = createMessage({ id: 'persist-1', content: 'First' })
			const msg2 = createMessage({ id: 'persist-2', content: 'Second' })

			saveMessage(msg1)
			const afterFirst = getMessages()
			expect(afterFirst).toHaveLength(1)

			saveMessage(msg2)
			const afterSecond = getMessages()
			expect(afterSecond).toHaveLength(2)

			const ids = afterSecond.map(m => m.id)
			expect(ids).toContain('persist-1')
			expect(ids).toContain('persist-2')
		})
	})
})
