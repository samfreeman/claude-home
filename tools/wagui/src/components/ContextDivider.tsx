'use client'

interface ContextDividerProps {
	content: string
	timestamp: number
}

export function ContextDivider({ content }: ContextDividerProps) {
	return (
		<div className="flex items-center gap-3 my-3 w-full min-w-0 overflow-hidden">
			<div className="flex-1 h-px bg-border min-w-4 shrink" />
			<span
				className="text-xs text-muted-foreground max-w-[60vw] overflow-hidden text-ellipsis whitespace-nowrap"
				title={content}
			>
				{content}
			</span>
			<div className="flex-1 h-px bg-border min-w-4 shrink" />
		</div>
	)
}
