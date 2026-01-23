'use client'

import { Badge } from '@/components/ui/badge'
import type { WagMessage, WagRole, MessageType } from '@/lib/types'
import { ContextDivider } from './ContextDivider'

interface MessageProps {
	message: WagMessage
}

function getAvatarColor(role: WagRole): string {
	switch (role) {
		case 'user':
			return 'bg-primary/60'
		case 'pm':
			return 'bg-secondary/80'
		case 'architect':
			return 'bg-accent/80'
		case 'dev':
			return 'bg-muted'
		default:
			return 'bg-muted'
	}
}

function getRoleInitials(role: WagRole): string {
	switch (role) {
		case 'user':
			return 'U'
		case 'pm':
			return 'PM'
		case 'architect':
			return 'A'
		case 'dev':
			return 'D'
		default:
			return '?'
	}
}

function getTypeBadge(type: MessageType): string {
	switch (type) {
		case 'proposal':
			return '📋'
		case 'review':
			return '🔍'
		case 'diff':
			return '📝'
		case 'decision':
			return '✅'
		case 'system':
			return '⚙️'
		default:
			return '💬'
	}
}

function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	})
}

function getRoleLabel(role: WagRole): string {
	switch (role) {
		case 'user':
			return 'User'
		case 'pm':
			return 'PM'
		case 'architect':
			return 'Architect'
		case 'dev':
			return 'Dev'
		default:
			return role
	}
}

export function Message({ message }: MessageProps) {
	if (message.type == 'context')
		return <ContextDivider content={message.content} timestamp={message.timestamp} />

	const isUser = message.role == 'user'

	return (
		<div className={`flex flex-col mb-2 ${isUser ? 'items-end' : 'items-start'}`}>
			{/* Header: role name and timestamp - above the bubble row */}
			<div className={`flex items-center gap-2 text-xs text-muted-foreground mb-1 ${isUser ? 'flex-row-reverse pr-10' : 'pl-10'}`}>
				<span className="font-medium">{getRoleLabel(message.role)}</span>
				<span>{formatTimestamp(message.timestamp)}</span>
			</div>

			{/* Avatar + Bubble row */}
			<div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 max-w-full`}>
				{/* Avatar */}
				<div className={`w-8 h-8 rounded-full flex items-center justify-center text-foreground/80 text-xs font-medium shrink-0 ${getAvatarColor(message.role)}`}>
					{getRoleInitials(message.role)}
				</div>

				{/* Bubble */}
				<div className={`${isUser ? 'bg-primary text-primary-foreground' : 'bg-card'} rounded-lg px-3 py-2 max-w-[80%] overflow-hidden`}>
					<div className="text-sm whitespace-pre-wrap break-words">
						{message.content}
					</div>

					{/* Footer: type emoji and metadata */}
					<div className={`flex items-center gap-2 mt-1 text-xs ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'} ${isUser ? 'justify-end' : 'justify-start'} flex-wrap`}>
						<span>{getTypeBadge(message.type)}</span>
						{message.metadata?.pbi && (
							<Badge variant="outline" className="text-xs py-0 h-5">
								{message.metadata.pbi}
							</Badge>
						)}
						{message.metadata?.file && (
							<span className="font-mono truncate max-w-[200px]">{message.metadata.file}</span>
						)}
						{message.metadata?.approved != null && (
							<Badge variant={message.metadata.approved ? 'default' : 'destructive'} className="text-xs py-0 h-5">
								{message.metadata.approved ? 'Approved' : 'Rejected'}
							</Badge>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
