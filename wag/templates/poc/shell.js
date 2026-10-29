// WAG POC shell, loaded in every page's head after data.js. The procedure is
// ~/.claude/wag/workflows/poc.md; this comment is the markup contract.
//
// Pages: one file per route, all in pages/. "/" is pages/index.html, "/x" is pages/x.html, and a
// dynamic "/x/[id]" folds into pages/x.html and reads ?id=. Pages link to each other by bare name
// (x.html) and load the shared files with ../ (../theme.css, ../data.js, ../shell.js). The root
// index.html only redirects to pages/index.html.
// Each page's body says which side of the simulated sign-in it is on:
//   body data-auth="in"    signed-in page; the shell (nav) is drawn around its main
//   body data-auth="out"   signed-out page (sign-in); signed-in visitors go to index.html
//   body data-auth="any"   both views in one file (index.html); children marked
//                          data-view="out" and data-view="in" show for the current state
// Inside a page:
//   main data-page="NAME"            the page's content; NAME is the PRD's page name and the title
//   data-if="id", data-unless="id"   shown only with, or only without, ?id= (list and detail in one file)
//   data-list="KEY"                  repeat the child template once per item in POC_DATA[KEY]
//   data-record="KEY"                fill the child template with the POC_DATA[KEY] item whose id is ?id=
//   data-fill                        fill {{path}} placeholders once from POC_DATA
//   data-slot, data-variant          the shadcn component a control stands in for
//   data-action="sign-in|sign-out|toggle-theme"
// NAV is the app's menu: edit it to match the PRD's menu. DEV_NAV is the standard Development section.

const NAV = [
	{ href: 'index.html', label: 'Dashboard', icon: 'layout-dashboard' },
	{ href: 'items.html', label: 'Items', icon: 'list' }
]

const DEV_NAV = [
	{ href: 'project-plan-status.html', label: 'Project Plan & Status', icon: 'file-text' }
]

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

const data = window.POC_DATA ?? {}
const params = new URLSearchParams(location.search)
const here = location.pathname.split('/').pop() || 'index.html'

const esc = s =>
	String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const fill = (html, item) =>
	html.replace(/\{\{([\w.]+)\}\}/g, (_, path) =>
		esc(path.split('.').reduce((v, k) => v?.[k], item) ?? ''))

const navLink = item => `
	<a href="${item.href}" ${item.href == here ? 'aria-current="page"' : ''}
		class="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground">
		<i data-lucide="${item.icon}" class="size-4"></i> ${esc(item.label)}
	</a>`

const iconButton = (action, label, icons) => `
	<button data-slot="button" data-variant="ghost" data-action="${action}" aria-label="${label}"
		class="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent">${icons}</button>`

function drawShell(main) {
	const wrap = document.createElement('div')
	wrap.className = 'flex min-h-screen'
	wrap.innerHTML = `
		<aside class="flex w-60 shrink-0 flex-col border-r bg-card">
			<a href="index.html" class="flex h-14 items-center px-4 font-semibold">${esc(data.app?.name ?? '')}</a>
			<nav class="flex-1 space-y-1 px-2 text-sm">
				${NAV.map(navLink).join('')}
				<div class="px-3 pt-6 pb-1 text-xs font-medium text-muted-foreground">Development</div>
				${DEV_NAV.map(navLink).join('')}
			</nav>
			<div class="flex items-center gap-2 border-t p-3 text-sm">
				<span class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">${esc(data.user?.initials ?? '')}</span>
				<span class="flex-1 truncate">${esc(data.user?.name ?? '')}</span>
				${iconButton('toggle-theme', 'Toggle light or dark mode', '<i data-lucide="sun" class="size-4 hidden dark:block"></i><i data-lucide="moon" class="size-4 dark:hidden"></i>')}
				${iconButton('sign-out', 'Sign out', '<i data-lucide="log-out" class="size-4"></i>')}
			</div>
		</aside>`
	main.replaceWith(wrap)
	main.classList.add('min-w-0', 'flex-1', 'p-6')
	wrap.append(main)
}

function render() {
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
})
