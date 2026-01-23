'use client'

import { useState } from 'react'
import { useSSE } from '@/hooks/useSSE'
import { Header } from '@/components/Header'
import { MessageList } from '@/components/MessageList'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3099'

export default function Home() {
	const { messages, state, connected, error } = useSSE()
	const [showClearDialog, setShowClearDialog] = useState(false)

	const handleClear = () => {
		fetch(`${API_URL}/api/v1/messages`, { method: 'DELETE' })
	}

	return (
		<div className="flex h-screen flex-col bg-background overflow-hidden">
			<Header state={state} connected={connected} onClear={() => setShowClearDialog(true)} />
			{error && (
				<div className="bg-destructive/10 text-destructive px-4 py-2 text-sm text-center">
					{error}
				</div>
			)}
			<MessageList messages={messages} />
			<ConfirmDialog
				open={showClearDialog}
				onOpenChange={setShowClearDialog}
				title="Clear messages"
				description="Are you sure you want to clear all messages? This cannot be undone."
				onConfirm={handleClear}
				confirmText="Clear"
			/>
		</div>
	)
}
