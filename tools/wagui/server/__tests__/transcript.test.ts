import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getTranscriptDir, findLatestTranscript, parseTranscriptEntry } from '../transcript'

describe('server/transcript', () => {
	describe('getTranscriptDir', () => {
		it('encodes forward slashes as hyphens', () => {
			const result = getTranscriptDir('/home/user/project')
			expect(result).toBe(path.join(os.homedir(), '.claude', 'projects', '-home-user-project'))
		})

		it('handles root path', () => {
			const result = getTranscriptDir('/')
			expect(result).toBe(path.join(os.homedir(), '.claude', 'projects', '-'))
		})

		it('handles path with multiple segments', () => {
			const result = getTranscriptDir('/home/samf/source/claude/tools/wagui')
			expect(result).toBe(
				path.join(os.homedir(), '.claude', 'projects', '-home-samf-source-claude-tools-wagui')
			)
		})
	})

	describe('parseTranscriptEntry', () => {
		it('parses user message', () => {
			const entry = {
				type: 'user',
				message: { content: [{ type: 'text', text: 'Hello world' }] },
				uuid: 'test-uuid-123',
				timestamp: '2026-01-23T10:30:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result).not.toBeNull()
			expect(result!.id).toBe('test-uuid-123')
			expect(result!.role).toBe('user')
			expect(result!.type).toBe('chat')
			expect(result!.content).toBe('Hello world')
			expect(result!.header.app).toBe('test-app')
			expect(result!.metadata?.source).toBe('transcript')
		})

		it('parses assistant message', () => {
			const entry = {
				type: 'assistant',
				message: { content: [{ type: 'text', text: 'I can help with that' }] },
				uuid: 'assistant-uuid',
				timestamp: '2026-01-23T10:31:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result).not.toBeNull()
			expect(result!.role).toBe('dev')
			expect(result!.content).toBe('I can help with that')
		})

		it('joins multiple text blocks', () => {
			const entry = {
				type: 'user',
				message: {
					content: [
						{ type: 'text', text: 'First line' },
						{ type: 'text', text: 'Second line' }
					]
				},
				uuid: 'multi-uuid',
				timestamp: '2026-01-23T10:32:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result!.content).toBe('First line\nSecond line')
		})

		it('returns null for non-message types', () => {
			const entry = {
				type: 'progress',
				message: { content: [{ type: 'text', text: 'Progress update' }] },
				uuid: 'progress-uuid',
				timestamp: '2026-01-23T10:33:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result).toBeNull()
		})

		it('returns null when no text content', () => {
			const entry = {
				type: 'assistant',
				message: { content: [{ type: 'tool_use', name: 'some_tool' }] },
				uuid: 'tool-uuid',
				timestamp: '2026-01-23T10:34:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result).toBeNull()
		})

		it('returns null when message is missing', () => {
			const entry = {
				type: 'user',
				message: undefined,
				uuid: 'no-message-uuid',
				timestamp: '2026-01-23T10:35:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result).toBeNull()
		})

		it('converts timestamp to milliseconds', () => {
			const entry = {
				type: 'user',
				message: { content: [{ type: 'text', text: 'Test' }] },
				uuid: 'timestamp-uuid',
				timestamp: '2026-01-23T10:30:00.000Z'
			}

			const result = parseTranscriptEntry(entry, 'test-app')

			expect(result!.timestamp).toBe(new Date('2026-01-23T10:30:00.000Z').getTime())
		})
	})

	describe('findLatestTranscript', () => {
		let testDir: string

		beforeEach(() => {
			testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-test-'))
		})

		afterEach(() => {
			fs.rmSync(testDir, { recursive: true, force: true })
		})

		it('returns null for non-existent directory', () => {
			const result = findLatestTranscript('/non/existent/path')
			expect(result).toBeNull()
		})

		it('returns null for empty directory', () => {
			const result = findLatestTranscript(testDir)
			expect(result).toBeNull()
		})

		it('returns null when no jsonl files exist', () => {
			fs.writeFileSync(path.join(testDir, 'other.txt'), 'content')
			const result = findLatestTranscript(testDir)
			expect(result).toBeNull()
		})

		it('returns the only jsonl file', () => {
			const filePath = path.join(testDir, 'session.jsonl')
			fs.writeFileSync(filePath, '{}')

			const result = findLatestTranscript(testDir)

			expect(result).toBe(filePath)
		})

		it('returns the most recently modified jsonl file', () => {
			const older = path.join(testDir, 'older.jsonl')
			const newer = path.join(testDir, 'newer.jsonl')

			fs.writeFileSync(older, '{}')
			const pastTime = Date.now() - 10000
			fs.utimesSync(older, pastTime / 1000, pastTime / 1000)

			fs.writeFileSync(newer, '{}')

			const result = findLatestTranscript(testDir)

			expect(result).toBe(newer)
		})
	})
})
