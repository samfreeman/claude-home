'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Message } from './Message'
import type { WagMessage } from '@/lib/types'

interface MessageListProps {
	messages: WagMessage[]
}

export function MessageList({ messages }: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	if (messages.length == 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<div className="text-center">
					<p className="text-lg">No messages yet</p>
					<p className="text-sm">Waiting for WAG workflow messages...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
			<ScrollArea className="h-full w-full">
				<div className="p-4 max-w-full min-w-0 overflow-hidden">
					{messages.map(message =>
						<Message key={message.id} message={message} />)}
					<div ref={bottomRef} />
				</div>
			</ScrollArea>
		</div>
	)
}
