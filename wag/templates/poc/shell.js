// WAG POC shell, loaded in every page's head after data.js. The procedure is
// ~/.claude/wag/workflows/poc.md; this comment is the markup contract.
//
// Pages: one file per route, all in pages/. "/" is pages/index.html, "/x" is pages/x.html, and a
// dynamic "/x/[id]" folds into pages/x.html and reads ?id=. Pages link to each other by bare name
// (x.html) and load the shared files with ../ (../theme.css, ../data.js, ../shell.js). The root
// index.html only redirects to pages/index.html.
// shell.js loads the rest of the shell from scripts/ right after itself (the list is at the bottom):
//   scripts/comments.js  development only: the Comment button and dialog; it posts to api/comment.js
// Each page's body says which side of the simulated sign-in it is on:
//   body data-auth="in"    signed-in page; the shell (nav and top bar) is drawn around its main
//   body data-auth="out"   signed-out page (sign-in); signed-in visitors go to index.html
//   body data-auth="any"   both views in one file (index.html); children marked
//                          data-view="out" and data-view="in" show for the current state
// Inside a page:
//   main data-page="NAME"            the page's content; NAME is the PRD's page name and the title
//   data-if="id", data-unless="id"   shown only with, or only without, ?id= (list and detail in one file)
//   data-list="KEY"                  repeat the child template once per item in POC_DATA[KEY]
//   data-record="KEY"                fill the child template with the POC_DATA[KEY] item whose id is ?id=
//   data-fill                        fill {{path}} placeholders once from POC_DATA
//   data-logo                        the app's logo (mark and name); data-logo="tagline" adds data.app.tagline
//   data-slot, data-variant          the shadcn component a control stands in for
//   data-dev                         the development-only look, on anything that won't ship
//   data-topbar                      the shell's top bar, where comments.js puts the Comment button
//   data-action="sign-in|sign-out|toggle-theme"
//   data-action="open-docs"          on a link to project-documents.html: signs in first, so it skips sign-in
//   data-action="open-comment"       development only: open the Comment dialog (comments.js)
// NAV is the app's menu: edit it to match the PRD's menu. DEV_NAV is the standard Development section.
// MARK is the logo's mark, used by logo() and as the favicon: replace it, once, here.
// Development only: anything that won't be in the final site stands out as scaffolding, in one shared
// look — data-dev: a thin, muted, dashed pink outline, a colour no app's theme uses (the one place a
// colour is written as a hex, not a theme token). The Development section of the menu wears it,
// headed "Development only", and so does the Comment button.

const NAV = [
	{ href: 'index.html', label: 'Dashboard', icon: 'layout-dashboard' },
	{ href: 'items.html', label: 'Items', icon: 'list' }
]

const DEV_NAV = [
	{ href: 'project-documents.html', label: 'Project Documents', icon: 'clipboard-list' }
]

// PLACEHOLDER: a generic mark until the brand has one (poc.md, Step 3).
const MARK = (bg, fg) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${bg}"/><circle cx="16" cy="16" r="6.5" fill="none" stroke="${fg}" stroke-width="3"/></svg>`

const store = {
	get(area, key) {
		try {
			return window[area].getItem(key)
		}
		catch {
			return null
		}
	},
	set(area, key, value) {
		try {
			value == null ? window[area].removeItem(key) : window[area].setItem(key, value)
		}
		catch {}
	}
}

const savedTheme = store.get('localStorage', 'poc-theme')
document.documentElement.classList.toggle(
	'dark',
	savedTheme ? savedTheme == 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)

// The development-only look: a thin, muted, dashed pink outline.
document.head.insertAdjacentHTML('beforeend', `<style>[data-dev]{border:1px dashed rgb(255 46 136/.45);border-radius:.5rem}</style>`)

const data = window.POC_DATA ?? {}
const params = new URLSearchParams(location.search)
const here = location.pathname.split('/').pop() || 'index.html'

const esc = s =>
	String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const fill = (html, item) =>
	html.replace(/\{\{([\w.]+)\}\}/g, (_, path) =>
		esc(path.split('.').reduce((v, k) => v?.[k], item) ?? ''))

const logo = ({ tagline = false } = {}) => `
	<span class="inline-flex items-center gap-2">
		<span class="size-7 shrink-0 [&>svg]:size-full">${MARK('var(--primary)', 'var(--primary-foreground)')}</span>
		<span class="flex flex-col leading-tight">
			<span class="font-semibold">${esc(data.app?.name ?? '')}</span>
			${tagline && data.app?.tagline ? `<span class="text-xs text-muted-foreground">${esc(data.app.tagline)}</span>` : ''}
		</span>
	</span>`

// The favicon is the mark itself. A data: image can't read CSS variables, so the theme's colours
// are written in as the page loaded them.
function addFavicon() {
	const css = getComputedStyle(document.documentElement)
	const color = name => css.getPropertyValue(name).trim()
	const link = document.createElement('link')
	link.rel = 'icon'
	link.href = `data:image/svg+xml,${encodeURIComponent(MARK(color('--primary'), color('--primary-foreground')))}`
	document.head.append(link)
}

const navLink = item => `
	<a href="${item.href}" ${item.href == here ? 'aria-current="page"' : ''}
		class="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground">
		<i data-lucide="${item.icon}" class="size-4"></i> ${esc(item.label)}
	</a>`

// The Development section, in the development-only look.
const devSection = () => `
	<div data-dev class="mt-6 space-y-1 p-1.5">
		<div class="flex items-center gap-1.5 px-2 pt-0.5 pb-1 text-xs font-medium uppercase tracking-wider text-[#FF2E88]/70">
			<i data-lucide="construction" class="size-3.5"></i> Development only
		</div>
		${DEV_NAV.map(navLink).join('')}
	</div>`

// The signed-in shell: the menu down the left, and a sticky top bar (h-14) over the page holding the
// light/dark toggle; comments.js adds the Comment button at its end.
function drawShell(main) {
	const wrap = document.createElement('div')
	wrap.className = 'flex min-h-screen'
	wrap.innerHTML = `
		<aside class="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-card">
			<a href="index.html" class="flex h-14 items-center px-4">${logo()}</a>
			<nav class="flex-1 space-y-1 overflow-y-auto px-2 text-sm">
				${NAV.map(navLink).join('')}
				${devSection()}
			</nav>
			<div class="flex items-center gap-2 border-t p-3 text-sm">
				<span class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">${esc(data.user?.initials ?? '')}</span>
				<span class="flex-1 truncate">${esc(data.user?.name ?? '')}</span>
				<button data-slot="button" data-variant="ghost" data-action="sign-out" aria-label="Sign out"
					class="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent">
					<i data-lucide="log-out" class="size-4"></i>
				</button>
			</div>
		</aside>
		<div class="flex min-w-0 flex-1 flex-col">
			<header data-topbar class="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-6">
				<div class="flex-1"></div>
				<button data-slot="button" data-variant="outline" data-action="toggle-theme" aria-label="Toggle light or dark mode"
					class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-accent">
					<i data-lucide="sun" class="hidden size-4 dark:block"></i><i data-lucide="moon" class="size-4 dark:hidden"></i>
					<span class="hidden dark:inline">Light</span><span class="dark:hidden">Dark</span>
				</button>
			</header>
		</div>`
	main.replaceWith(wrap)
	main.classList.add('min-w-0', 'flex-1', 'p-6')
	wrap.lastElementChild.append(main)
}

function render() {
	for (const el of document.querySelectorAll('[data-logo]'))
		el.innerHTML = logo({ tagline: el.dataset.logo == 'tagline' })
	for (const el of document.querySelectorAll('[data-fill]'))
		el.innerHTML = fill(el.innerHTML, data)
	for (const el of document.querySelectorAll('[data-list]')) {
		const tpl = el.querySelector('template').innerHTML
		el.insertAdjacentHTML('beforeend', (data[el.dataset.list] ?? []).map(item => fill(tpl, item)).join(''))
	}
	for (const el of document.querySelectorAll('[data-record]')) {
		const items = data[el.dataset.record] ?? []
		const item = items.find(i => String(i.id) == params.get('id')) ?? items[0] ?? {}
		el.insertAdjacentHTML('beforeend', fill(el.querySelector('template').innerHTML, item))
	}
	for (const el of document.querySelectorAll('[data-if="id"]'))
		el.hidden = !params.has('id')
	for (const el of document.querySelectorAll('[data-unless="id"]'))
		el.hidden = params.has('id')
}

document.addEventListener('DOMContentLoaded', () => {
	const auth = document.body.dataset.auth ?? 'in'
	const signedIn = store.get('sessionStorage', 'poc-signed-in') == '1'
	if (auth == 'in' && !signedIn)
		return location.replace('sign-in.html')
	if (auth == 'out' && signedIn)
		return location.replace('index.html')
	addFavicon()
	for (const el of document.querySelectorAll('[data-view]'))
		el.hidden = el.dataset.view != (signedIn ? 'in' : 'out')
	const main = document.querySelector('main[data-page]:not([hidden])')
	if (signedIn && main && auth != 'out')
		drawShell(main)
	render()
	const name = data.app?.name ?? ''
	document.title = main ? `${main.dataset.page} · ${name}` : name
	lucide.createIcons()
})

document.addEventListener('click', e => {
	const action = e.target.closest('[data-action]')?.dataset.action
	if (action == 'toggle-theme') {
		const dark = document.documentElement.classList.toggle('dark')
		store.set('localStorage', 'poc-theme', dark ? 'dark' : 'light')
	}
	else if (action == 'sign-in' || action == 'sign-out') {
		store.set('sessionStorage', 'poc-signed-in', action == 'sign-in' ? '1' : null)
		location.href = 'index.html'
	}
	else if (action == 'open-docs')
		store.set('sessionStorage', 'poc-signed-in', '1')
})

// The rest of the shell, loaded from scripts/ right after this file, in order, so pages load only
// shell.js. When shell.js is split (poc.md, Step 6), the new parts go before comments.js.
const base = document.currentScript.src.replace(/shell\.js(\?.*)?$/, '')
for (const file of ['comments.js'])
	document.write(`<script src="${base}scripts/${file}"></script>`)
