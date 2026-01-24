#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

const WAGUI_BASE_URL = 'http://localhost:3099/api/v1'

async function apiCall(
	method: string,
	endpoint: string,
	body?: Record<string, unknown>
): Promise<unknown> {
	const url = `${WAGUI_BASE_URL}${endpoint}`
	const options: RequestInit = {
		method,
		headers: {
			'Content-Type': 'application/json'
		}
	}

	if (body)
		options.body = JSON.stringify(body)

	const response = await fetch(url, options)

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`API error ${response.status}: ${text}`)
	}

	return response.json()
}

const server = new Server(
	{
		name: 'wag-mcp',
		version: '2.0.0'
	},
	{
		capabilities: {
			tools: {}
		}
	}
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: 'wag_set_state',
				description: 'Set the current WAG workflow state (header info). Call this when entering a mode or changing context.',
				inputSchema: {
					type: 'object',
					properties: {
						app: {
							type: 'string',
							description: 'Application name'
						},
						appRoot: {
							type: 'string',
							description: 'Absolute path to app root directory'
						},
						repo: {
							type: 'string',
							description: 'Absolute path to repo root (optional)'
						},
						mode: {
							type: 'string',
							enum: ['DOCS', 'ADR', 'DEV', null],
							description: 'Current workflow mode'
						},
						branch: {
							type: 'string',
							description: 'Git branch (default: dev)'
						},
						context: {
							type: 'string',
							description: 'What you are currently doing'
						},
						pbi: {
							type: 'string',
							description: 'Active PBI (optional)'
						},
						task: {
							type: 'number',
							description: 'Current task number (optional)'
						},
						totalTasks: {
							type: 'number',
							description: 'Total tasks in plan (optional)'
						}
					},
					required: ['app', 'mode', 'context']
				}
			},
			{
				name: 'wag_send_message',
				description: 'Send a message from a role. The current WAG header is automatically included.',
				inputSchema: {
					type: 'object',
					properties: {
						role: {
							type: 'string',
							enum: ['user', 'pm', 'architect', 'dev'],
							description: 'Who is sending the message'
						},
						type: {
							type: 'string',
							enum: ['chat', 'proposal', 'review', 'diff', 'decision', 'system', 'context'],
							description: 'Type of message'
						},
						content: {
							type: 'string',
							description: 'Message content'
						},
						file: {
							type: 'string',
							description: 'Related file path (optional)'
						},
						task: {
							type: 'number',
							description: 'Related task number (optional)'
						},
						pbi: {
							type: 'string',
							description: 'Related PBI (optional)'
						},
						approved: {
							type: 'boolean',
							description: 'For review type - whether approved (optional)'
						}
					},
					required: ['role', 'type', 'content']
				}
			},
			{
				name: 'wag_get_history',
				description: 'Get recent message history',
				inputSchema: {
					type: 'object',
					properties: {
						limit: {
							type: 'number',
							description: 'Max messages to return (default: 50)'
						}
					}
				}
			},
			{
				name: 'wag_get_state',
				description: 'Get current WAG workflow state',
				inputSchema: {
					type: 'object',
					properties: {}
				}
			},
			{
				name: 'wag_clear',
				description: 'Clear all messages and reset state (typically when PBI completes)',
				inputSchema: {
					type: 'object',
					properties: {}
				}
			},
			{
				name: 'wag_cop',
				description: 'Validate postconditions before allowing wag_clear. Must pass before clear is allowed.',
				inputSchema: {
					type: 'object',
					properties: {
						pbi: {
							type: 'string',
							description: 'PBI being completed (e.g., PBI-026)'
						}
					},
					required: ['pbi']
				}
			}
		]
	}
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params

	try {
		switch (name) {
			case 'wag_set_state': {
				const result = await apiCall('POST', '/state', args as Record<string, unknown>)
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}]
				}
			}

			case 'wag_send_message': {
				const result = await apiCall('POST', '/messages', args as Record<string, unknown>)
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}]
				}
			}

			case 'wag_get_history': {
				const { limit } = args as { limit?: number }
				const query = limit ? `?limit=${limit}` : ''
				const result = await apiCall('GET', `/messages${query}`)
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}]
				}
			}

			case 'wag_get_state': {
				const result = await apiCall('GET', '/state')
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}]
				}
			}

			case 'wag_clear': {
				const result = await apiCall('DELETE', '/messages')
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}]
				}
			}

			case 'wag_cop': {
				const { pbi } = args as { pbi: string }
				const result = await apiCall('POST', '/cop', { pbi })
				return {
					content: [{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}]
				}
			}

			default:
				return {
					content: [{
						type: 'text',
						text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }, null, 2)
					}],
					isError: true
				}
		}
	}
	catch (error) {
		return {
			content: [{
				type: 'text',
				text: JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				}, null, 2)
			}],
			isError: true
		}
	}
})

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
	console.error('WAG MCP server running (HTTP gateway mode)')
}

main().catch((error) => {
	console.error('Server error:', error)
	process.exit(1)
})
