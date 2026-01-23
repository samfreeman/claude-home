'use client'

import { useState, useEffect, useRef } from 'react'
import type { WagMessage, WagState } from '@/lib/types'

const SSE_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/events` : 'http://localhost:3099/events'

interface UseSSEResult {
	messages: WagMessage[]
	state: WagState | null
	connected: boolean
	error: string | null
	reconnect: () => void
}

export function useSSE(): UseSSEResult {
	const [messages, setMessages] = useState<WagMessage[]>([])
	const [state, setState] = useState<WagState | null>(null)
	const [connected, setConnected] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const eventSourceRef = useRef<EventSource | null>(null)
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		let eventSource: EventSource | null = null
		let isCleanedUp = false

		const connect = () => {
			if (isCleanedUp)
				return

			if (eventSourceRef.current) {
				eventSourceRef.current.close()
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current)
				reconnectTimeoutRef.current = null
			}

			eventSource = new EventSource(SSE_URL)
			eventSourceRef.current = eventSource

			eventSource.onopen = () => {
				setConnected(true)
				setError(null)
			}

			eventSource.onerror = () => {
				setConnected(false)
				setError('Connection lost. Reconnecting...')
				if (eventSource) {
					eventSource.close()
				}
				reconnectTimeoutRef.current = setTimeout(connect, 3000)
			}

			eventSource.addEventListener('connected', (e: MessageEvent) => {
				const data = JSON.parse(e.data) as { timestamp: number }
				console.log('SSE connected at', new Date(data.timestamp))
			})

			eventSource.addEventListener('message', (e: MessageEvent) => {
				const data = JSON.parse(e.data) as WagMessage
				setMessages(prev => {
					const exists = prev.some(m => m.id == data.id)
					if (exists)
						return prev
					return [...prev, data]
				})
			})

			eventSource.addEventListener('state', (e: MessageEvent) => {
				const data = JSON.parse(e.data) as WagState
				setState(data)
			})

			eventSource.addEventListener('clear', () => {
				console.log('SSE clear event received')
				setMessages([])
			})
		}

		connect()

		return () => {
			isCleanedUp = true
			if (eventSource) {
				eventSource.close()
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current)
			}
		}
	}, [])

	const reconnect = () => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close()
			eventSourceRef.current = null
		}
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current)
			reconnectTimeoutRef.current = null
		}
		setError(null)
		setConnected(false)

		const eventSource = new EventSource(SSE_URL)
		eventSourceRef.current = eventSource

		eventSource.onopen = () => {
			setConnected(true)
			setError(null)
		}

		eventSource.onerror = () => {
			setConnected(false)
			setError('Connection lost.')
		}

		eventSource.addEventListener('connected', (e: MessageEvent) => {
			const data = JSON.parse(e.data) as { timestamp: number }
			console.log('SSE reconnected at', new Date(data.timestamp))
		})

		eventSource.addEventListener('message', (e: MessageEvent) => {
			const data = JSON.parse(e.data) as WagMessage
			setMessages(prev => {
				const exists = prev.some(m => m.id == data.id)
				if (exists)
					return prev
				return [...prev, data]
			})
		})

		eventSource.addEventListener('state', (e: MessageEvent) => {
			const data = JSON.parse(e.data) as WagState
			setState(data)
		})

		eventSource.addEventListener('clear', () => {
			console.log('SSE clear event received (reconnect)')
			setMessages([])
		})
	}

	return { messages, state, connected, error, reconnect }
}
