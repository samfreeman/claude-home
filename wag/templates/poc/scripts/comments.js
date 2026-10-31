// WAG POC comments: the Comment button and its dialog. Development only — not part of the app, and
// not ported at the handoff. Loaded by shell.js last; uses its data, esc and store. The procedure is
// ~/.claude/wag/workflows/poc.md (Step 6, Comments; the setup is Step 7).
//
// The page's scripts share one set of top-level names, so a name declared here must not be declared
// in shell.js or any other part in scripts/ — a clash stops the later script loading at all.
//
// A reviewer leaves a comment on whatever page they're on, and it reaches the owner with the page's
// full address, so nobody has to describe in words where they were. The dialog makes clear the
// comment is about this page, by name — "You're leaving a comment about the Items page." The full
// address is sent, not shown. The dialog says the comment lands as a file in the owner's Dropbox, and
// it may be a while before they get to it. The button sits top right on every page, in the
// development-only look (data-dev, shell.js):
//   signed-in pages   at the end of the top bar (data-topbar)
//   the landing page  just left of the header's Sign in button, lined up with it
//   anywhere else     fixed in the top right corner
//
// Who left it: the dialog is where the reviewer picks their name, from data.js's poc.reviewers —
// sign-in is not touched. The name is remembered in the browser, so it's picked once. No name, no
// comment: Send waits for a name and some text. The app doesn't change with the name picked; it only
// signs comments.
//
// Send posts the name, the page's address and the text to api/comment.js, which writes it to Dropbox
// as its own file. If it doesn't send, the text stays in the box to try again.

const COMMENT_NAME_KEY = 'poc-comment-name'

const commentOwner = data.poc?.owner || 'the owner'

const commentPick = 'inline-flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm hover:border-ring/50 has-[:checked]:border-ring has-[:checked]:bg-accent has-[:checked]:text-accent-foreground'

const commentButton = fixed => `
	<button type="button" data-dev data-action="open-comment" title="Leave a comment on this page (development only)"
		class="${fixed ? 'fixed top-3 right-4 z-40 bg-background ' : ''}inline-flex h-9 items-center gap-2 px-3 text-sm text-[#FF2E88]/80 hover:text-[#FF2E88]">
		<i data-lucide="message-square-plus" class="size-4"></i> Comment
	</button>`

// The landing page's Sign in button, in its header — only while it's showing.
const visibleSignIn = () =>
	[...document.querySelectorAll('header a[href="sign-in.html"]')].find(a => a.offsetParent)

// Which page the comment is about, by name: the page's own name (main data-page), or the landing page.
function commentPageName() {
	const main = document.querySelector('main[data-page]:not([hidden])')
	if (main)
		return `the <span class="font-semibold">${esc(main.dataset.page)}</span> page`
	return visibleSignIn() ? 'the <span class="font-semibold">landing</span> page' : 'this page'
}

function openComment() {
	const saved = store.get('localStorage', COMMENT_NAME_KEY)
	document.body.insertAdjacentHTML('beforeend', `
	<dialog data-slot="dialog" class="m-auto w-full max-w-lg rounded-lg border bg-card p-0 text-card-foreground backdrop:bg-black/60">
		<form data-comment-form class="space-y-4 p-6">
			<h2 class="flex items-center gap-2 text-2xl"><i data-lucide="message-square-plus" class="size-5 text-[#FF2E88]/80"></i> Comment</h2>
			<p class="text-base">You’re leaving a comment about ${commentPageName()}.</p>
			<p class="text-sm text-muted-foreground">Development only. Your comment lands as a file in ${esc(commentOwner)}’s Dropbox, along with the page you’re on, so you don’t have to say where you were. It may be a while before ${esc(commentOwner)} gets to it.</p>
			<div>
				<div class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Who you are</div>
				<div class="mt-2 flex flex-wrap gap-2">${(data.poc?.reviewers ?? []).map(r => `
					<label class="${commentPick}">
						<input type="radio" name="commenter" value="${esc(r.name)}" ${r.name == saved ? 'checked' : ''} class="sr-only">
						<span class="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">${esc(r.initials)}</span>${esc(r.name)}
					</label>`).join('')}
				</div>
				<p class="mt-2 text-xs text-muted-foreground">Your name only signs your comments. The app looks the same whoever you pick.</p>
			</div>
			<textarea name="comment" rows="5" placeholder="What do you think?" class="w-full rounded-md border bg-background px-3 py-2 text-sm"></textarea>
			<p data-comment-status hidden class="text-sm"></p>
			<div class="flex justify-end gap-2 pt-2">
				<button type="button" data-action="close-comment" data-slot="button" data-variant="ghost" class="h-9 rounded-md px-3 text-sm hover:bg-accent">Cancel</button>
				<button type="submit" data-comment-send disabled data-slot="button" data-variant="outline" class="h-9 rounded-md border border-ring/50 px-4 text-sm font-medium text-accent-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">Send</button>
			</div>
		</form>
	</dialog>`)
	const dialog = document.body.lastElementChild
	const form = dialog.querySelector('form')
	const ready = () =>
		form.querySelector('[data-comment-send]').disabled =
			!form.querySelector('[name="commenter"]:checked') || !form.querySelector('[name="comment"]').value.trim()
	form.addEventListener('change', e => {
		if (e.target.name == 'commenter')
			store.set('localStorage', COMMENT_NAME_KEY, e.target.value)
		ready()
	})
	form.addEventListener('input', ready)
	form.addEventListener('submit', e => {
		e.preventDefault()
		sendComment(form)
	})
	dialog.addEventListener('close', () => dialog.remove())
	lucide.createIcons()
	dialog.showModal()
	form.querySelector('[name="comment"]').focus()
}

async function sendComment(form) {
	const send = form.querySelector('[data-comment-send]')
	const status = form.querySelector('[data-comment-status]')
	send.disabled = true
	status.hidden = false
	status.textContent = 'Sending…'
	try {
		const r = await fetch('/api/comment', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: form.querySelector('[name="commenter"]:checked').value,
				page: location.href,
				text: form.querySelector('[name="comment"]').value.trim()
			})
		})
		if (!r.ok)
			throw new Error(r.status)
		status.textContent = 'Sent. Thank you.'
		setTimeout(() => form.closest('dialog').close(), 900)
	}
	catch {
		status.textContent = 'It didn’t send. Your comment is still here, so try again.'
		send.disabled = false
	}
}

// Places the button. This file loads after shell.js, so this runs after the shell has drawn the page.
// Beside Sign in, the two are wrapped in a row, so the header's left-and-right layout is unchanged.
document.addEventListener('DOMContentLoaded', () => {
	const bar = document.querySelector('[data-topbar]')
	const signIn = !bar && visibleSignIn()
	if (bar)
		bar.insertAdjacentHTML('beforeend', commentButton(false))
	else if (signIn) {
		const row = document.createElement('div')
		row.className = 'flex items-center gap-3'
		signIn.replaceWith(row)
		row.insertAdjacentHTML('beforeend', commentButton(false))
		row.append(signIn)
	}
	else
		document.body.insertAdjacentHTML('beforeend', commentButton(true))
	lucide.createIcons()
})

document.addEventListener('click', e => {
	const action = e.target.closest('[data-action]')?.dataset.action
	if (action == 'open-comment')
		openComment()
	else if (action == 'close-comment')
		e.target.closest('dialog').close()
})
