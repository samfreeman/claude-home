'use client'

import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { WagState } from '@/lib/types'

interface HeaderProps {
	state: WagState | null
	connected: boolean
	onClear?: () => void
}

function getModeColor(mode: string | null): string {
	switch (mode) {
		case 'DOCS':
			return 'bg-blue-500'
		case 'ADR':
			return 'bg-purple-500'
		case 'DEV':
			return 'bg-green-500'
		default:
			return 'bg-gray-500'
	}
}

export function Header({ state, connected, onClear }: HeaderProps) {
	return (
		<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-14 items-center px-4">
				<div className="flex items-center gap-4">
					<h1 className="text-lg font-semibold">WAG UI</h1>
					<Separator orientation="vertical" className="h-6" />
					<div className="flex items-center gap-2">
						<Badge
							variant={connected ? 'default' : 'destructive'}
							className="text-xs"
						>
							{connected ? 'Connected' : 'Disconnected'}
						</Badge>
						{onClear && (
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={onClear}
								title="Clear messages"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>

				{state && (
					<div className="ml-auto flex items-center gap-3">
						{state.header.mode && (
							<Badge className={getModeColor(state.header.mode)}>
								{state.header.mode}
							</Badge>
						)}
						<span className="text-sm text-muted-foreground">
							{state.header.app}
						</span>
						<Separator orientation="vertical" className="h-4" />
						<span className="text-sm font-mono text-muted-foreground">
							{state.header.branch}
						</span>
						{state.header.context && (
							<>
								<Separator orientation="vertical" className="h-4" />
								<span className="text-sm text-muted-foreground truncate max-w-[200px]">
									{state.header.context}
								</span>
							</>
						)}
						{state.activePbi && (
							<>
								<Separator orientation="vertical" className="h-4" />
								<Badge variant="outline" className="text-xs">
									{state.activePbi}
								</Badge>
							</>
						)}
						{state.currentTask != null && state.totalTasks != null && (
							<span className="text-xs text-muted-foreground">
								Task {state.currentTask}/{state.totalTasks}
							</span>
						)}
					</div>
				)}
			</div>
		</header>
	)
}
