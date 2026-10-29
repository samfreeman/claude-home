Readable copy of `index.html` for tools that strip HTML tags, even inside code fences. `index.html` is the source. In the block below every `<` is written as `‹` (U+2039) and every `>` as `›` (U+203A); turn them back to get `index.html` exactly. The original contains no `‹` or `›` of its own, so the swap is exact.

```html
‹!doctype html›
‹!--
  WAG POC starter — copy this folder to .wag/poc/ and build on it.
  The procedure is ~/.claude/wag/workflows/poc.md; this comment is the markup contract.

  One page, many routes. Each route is a ‹section data-route="/path"› (dynamic segments as
  /calls/[id]); the router at the bottom shows the one that matches location.hash, so every
  link is href="#/path". No build step: it runs from a double-click, from Dropbox, and on Vercel.

    data-route="‹route›"   one per route in the PRD's UI pages table
    data-auth="out|in"     which side of the simulated sign-in the route belongs to
    data-page="‹name›"     the PRD's page name
    data-list="‹key›"      repeat the child ‹template› once per item in POC_DATA[key]
    data-record="‹key›"    fill the child ‹template› with the POC_DATA[key] item whose id is
                           the route's [id] (the first item if none matches)
    data-fill              fill {{path}} placeholders once from POC_DATA (e.g. {{user.name}})
    data-slot="‹component›" + data-variant — the shadcn component a control stands in for;
                           its classes come from that component, so the real app swaps it 1:1
    data-action="sign-in|sign-out|toggle-theme"
    data-nav               a nav link; gets aria-current="page" when its route is showing

  Fake data lives in data.js (one data set, one signed-in user's view). The theme lives in
  theme.css (tweakcn format). Both carry over to the real app.
--›
‹html lang="en"›
‹head›
  ‹meta charset="utf-8"›
  ‹meta name="viewport" content="width=device-width, initial-scale=1"›
  ‹meta name="robots" content="noindex, nofollow"›
  ‹title›{{PROJECT_NAME}}‹/title›
  ‹link rel="stylesheet" href="theme.css"›
  ‹script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.11"›‹/script›
  ‹script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js"›‹/script›
  ‹script src="data.js"›‹/script›
  ‹style type="text/tailwindcss"›
    @custom-variant dark (&:where(.dark, .dark *));
    @theme inline {
      --color-background: var(--background);
      --color-foreground: var(--foreground);
      --color-card: var(--card);
      --color-card-foreground: var(--card-foreground);
      --color-popover: var(--popover);
      --color-popover-foreground: var(--popover-foreground);
      --color-primary: var(--primary);
      --color-primary-foreground: var(--primary-foreground);
      --color-secondary: var(--secondary);
      --color-secondary-foreground: var(--secondary-foreground);
      --color-muted: var(--muted);
      --color-muted-foreground: var(--muted-foreground);
      --color-accent: var(--accent);
      --color-accent-foreground: var(--accent-foreground);
      --color-destructive: var(--destructive);
      --color-border: var(--border);
      --color-input: var(--input);
      --color-ring: var(--ring);
      --radius-sm: calc(var(--radius) - 4px);
      --radius-md: calc(var(--radius) - 2px);
      --radius-lg: var(--radius);
      --radius-xl: calc(var(--radius) + 4px);
    }
    @layer base {
      * { @apply border-border; }
    }
  ‹/style›
  ‹script›
    (function () {
      let saved = null
      try {
        saved = localStorage.getItem('poc-theme')
      }
      catch {}
      const dark = saved ? saved == 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', dark)
    })()
  ‹/script›
‹/head›
‹body class="bg-background text-foreground antialiased"›

  ‹!-- ───────────── Signed out ───────────── --›

  ‹section data-route="/" data-auth="out" data-page="Landing" hidden›
    ‹header class="border-b"›
      ‹div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"›
        ‹span class="font-semibold"›{{PROJECT_NAME}}‹/span›
        ‹div class="flex items-center gap-2"›
          ‹button data-slot="button" data-variant="ghost" data-action="toggle-theme" aria-label="Toggle light or dark mode"
            class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"›
            ‹i data-lucide="sun" class="size-4 hidden dark:block"›‹/i›‹i data-lucide="moon" class="size-4 dark:hidden"›‹/i›
          ‹/button›
          ‹a href="#/sign-in" data-slot="button" data-variant="default"
            class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"›Sign in‹/a›
        ‹/div›
      ‹/div›
    ‹/header›
    ‹section class="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 py-24 text-center"›
      ‹div class="mx-auto max-w-5xl"›
        ‹span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs"›
          ‹span class="size-2 animate-pulse rounded-full bg-primary"›‹/span› Now in beta
        ‹/span›
        ‹h1 class="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"›
          Headline with ‹span class="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"›one phrase‹/span› lifted
        ‹/h1›
        ‹p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"›Subtext in muted foreground.‹/p›
        ‹div class="mt-10 flex justify-center gap-4"›
          ‹a href="#/sign-in" data-slot="button" data-variant="default"
            class="inline-flex h-12 items-center rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg"›Get started‹/a›
          ‹a href="#how" data-slot="button" data-variant="outline"
            class="inline-flex h-12 items-center rounded-md border bg-background px-8 text-base font-semibold"›How it works‹/a›
        ‹/div›
      ‹/div›
    ‹/section›
    ‹!-- …stats, how it works, pricing, FAQ, final CTA, footer: the UI standard's landing sections, in its order --›
  ‹/section›

  ‹section data-route="/sign-in" data-auth="out" data-page="Sign in" hidden class="flex min-h-screen items-center justify-center px-6"›
    ‹div data-slot="card" class="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm"›
      ‹h1 class="text-xl font-semibold"›Sign in to {{PROJECT_NAME}}‹/h1›
      ‹p class="mt-1 text-sm text-muted-foreground"›Simulated — any button signs you in.‹/p›
      ‹button data-slot="button" data-variant="outline" data-action="sign-in"
        class="mt-6 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background text-sm font-medium shadow-xs hover:bg-accent"›
        ‹i data-lucide="log-in" class="size-4"›‹/i› Continue with Google
      ‹/button›
    ‹/div›
  ‹/section›

  ‹!-- ───────────── Signed in: the shell (becomes the real app's layout.tsx) ───────────── --›

  ‹div data-shell hidden class="flex min-h-screen"›
    ‹aside class="flex w-60 shrink-0 flex-col border-r bg-card"›
      ‹div class="flex h-14 items-center px-4 font-semibold"›{{PROJECT_NAME}}‹/div›
      ‹nav class="flex-1 space-y-1 px-2 text-sm"›
        ‹a data-nav href="#/" class="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground"›
          ‹i data-lucide="layout-dashboard" class="size-4"›‹/i› Dashboard
        ‹/a›
        ‹a data-nav href="#/messages" class="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground"›
          ‹i data-lucide="inbox" class="size-4"›‹/i› Messages
        ‹/a›
        ‹!-- …the PRD's menu, in its order --›

        ‹div class="px-3 pt-6 pb-1 text-xs font-medium text-muted-foreground"›Development‹/div›
        ‹a data-nav href="#/project-plan-status" class="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground"›
          ‹i data-lucide="file-text" class="size-4"›‹/i› Project Plan &amp; Status
        ‹/a›
      ‹/nav›
      ‹div data-fill class="flex items-center gap-2 border-t p-3 text-sm"›
        ‹span class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium"›{{user.initials}}‹/span›
        ‹span class="flex-1 truncate"›{{user.name}}‹/span›
        ‹button data-slot="button" data-variant="ghost" data-action="toggle-theme" aria-label="Toggle light or dark mode"
          class="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent"›
          ‹i data-lucide="sun" class="size-4 hidden dark:block"›‹/i›‹i data-lucide="moon" class="size-4 dark:hidden"›‹/i›
        ‹/button›
        ‹button data-slot="button" data-variant="ghost" data-action="sign-out" aria-label="Sign out"
          class="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent"›
          ‹i data-lucide="log-out" class="size-4"›‹/i›
        ‹/button›
      ‹/div›
    ‹/aside›

    ‹main class="min-w-0 flex-1 p-6"›

      ‹section data-route="/" data-auth="in" data-page="Dashboard" hidden›
        ‹h1 data-fill class="text-2xl font-semibold"›Welcome back, {{user.first}}‹/h1›
        ‹p class="mt-1 text-sm text-muted-foreground"›Since you were last here‹/p›
      ‹/section›

      ‹section data-route="/messages" data-auth="in" data-page="Messages" hidden›
        ‹h1 class="text-2xl font-semibold"›Messages‹/h1›
        ‹div data-list="messages" class="mt-6 space-y-3"›
          ‹template›
            ‹a href="#/messages/{{id}}" data-slot="card" class="block rounded-xl border bg-card p-4 text-card-foreground shadow-sm hover:border-primary/40"›
              ‹div class="flex items-center justify-between"›
                ‹span class="text-sm font-medium"›{{author}}‹/span›
                ‹span data-slot="badge" data-variant="outline" class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"›{{channel}}‹/span›
              ‹/div›
              ‹p class="mt-2 text-sm text-muted-foreground"›{{text}}‹/p›
            ‹/a›
          ‹/template›
        ‹/div›
      ‹/section›

      ‹section data-route="/messages/[id]" data-auth="in" data-page="Message" hidden›
        ‹a href="#/messages" class="text-sm text-muted-foreground hover:text-foreground"›← Messages‹/a›
        ‹div data-record="messages" class="mt-4"›
          ‹template›
            ‹h1 class="text-2xl font-semibold"›{{author}}‹/h1›
            ‹p class="mt-1 text-sm text-muted-foreground"›{{channel}} · {{time}}‹/p›
            ‹p class="mt-6"›{{text}}‹/p›
          ‹/template›
        ‹/div›
      ‹/section›

      ‹!-- Development: the docs viewer. PRD.html and Architecture.html are self-contained renders
           (the /wag:html-prd and /wag:html-architecture procedure) in docs/, shown here and downloadable as is. --›
      ‹section data-route="/project-plan-status" data-auth="in" data-page="Project Plan & Status" hidden›
        ‹h1 class="text-2xl font-semibold"›Project Plan &amp; Status‹/h1›
        ‹div class="mt-6 space-y-3"›
          ‹details data-slot="accordion-item" class="group rounded-xl border bg-card"›
            ‹summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium"›
              ‹i data-lucide="chevron-right" class="size-4 transition-transform group-open:rotate-90"›‹/i›
              ‹span class="flex-1"›PRD‹/span›
              ‹a href="docs/PRD.html" download="PRD.html" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"›‹i data-lucide="download" class="size-4"›‹/i› Download‹/a›
            ‹/summary›
            ‹iframe src="docs/PRD.html" title="PRD" loading="lazy" class="h-[80vh] w-full rounded-b-xl border-t"›‹/iframe›
          ‹/details›
          ‹details data-slot="accordion-item" class="group rounded-xl border bg-card"›
            ‹summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium"›
              ‹i data-lucide="chevron-right" class="size-4 transition-transform group-open:rotate-90"›‹/i›
              ‹span class="flex-1"›Architecture‹/span›
              ‹a href="docs/Architecture.html" download="Architecture.html" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"›‹i data-lucide="download" class="size-4"›‹/i› Download‹/a›
            ‹/summary›
            ‹iframe src="docs/Architecture.html" title="Architecture" loading="lazy" class="h-[80vh] w-full rounded-b-xl border-t"›‹/iframe›
          ‹/details›
          ‹details data-slot="accordion-item" class="group rounded-xl border bg-card"›
            ‹summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium"›
              ‹i data-lucide="chevron-right" class="size-4 transition-transform group-open:rotate-90"›‹/i›
              ‹span class="flex-1"›Backlog‹/span›
            ‹/summary›
            ‹p class="border-t px-4 py-4 text-sm text-muted-foreground"›
              The backlog — epics and PBIs — is written once this POC is approved. It starts by porting this POC
              into the real application, then turns each feature's fake data into real data, one slice at a time.
            ‹/p›
          ‹/details›
        ‹/div›
      ‹/section›

    ‹/main›
  ‹/div›

  ‹script›
    const data = window.POC_DATA ?? {}
    const sections = [...document.querySelectorAll('[data-route]')]
    const shell = document.querySelector('[data-shell]')

    const session = {
      get(key) {
        try {
          return sessionStorage.getItem(key)
        }
        catch {
          return session[key]
        }
      },
      set(key, value) {
        try {
          value == null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value)
        }
        catch {
          session[key] = value
        }
      }
    }

    const esc = s =›
      String(s).replace(/[&‹›"']/g, c =› `&#${c.charCodeAt(0)};`)

    const fill = (html, item) =›
      html.replace(/\{\{([\w.]+)\}\}/g, (_, path) =›
        esc(path.split('.').reduce((v, k) =› v?.[k], item) ?? ''))

    function match(pattern, path) {
      const names = []
      const source = pattern.replace(/\[([^\]]+)\]/g, (_, name) =› {
        names.push(name)
        return '([^/]+)'
      })
      const m = path.match(new RegExp(`^${source}$`))
      if (m == null)
        return null
      return Object.fromEntries(names.map((name, i) =› [name, decodeURIComponent(m[i + 1])]))
    }

    function render(root, params) {
      for (const el of root.querySelectorAll('[data-record]')) {
        const items = data[el.dataset.record] ?? []
        const item = items.find(i =› String(i.id) == params.id) ?? items[0] ?? {}
        el.querySelectorAll(':scope › :not(template)').forEach(n =› n.remove())
        el.insertAdjacentHTML('beforeend', fill(el.querySelector('template').innerHTML, item))
      }
    }

    function show() {
      const path = location.hash.slice(1).split('?')[0] || '/'
      const auth = session.get('poc-signed-in') ? 'in' : 'out'
      let target = null
      let params = {}
      for (const s of sections) {
        const p = s.dataset.auth == auth ? match(s.dataset.route, path) : null
        if (p) {
          target = s
          params = p
          break
        }
      }
      if (target == null) {
        const elsewhere = sections.some(s =› match(s.dataset.route, path))
        location.replace(elsewhere && auth == 'out' ? '#/sign-in' : '#/')
        return
      }
      sections.forEach(s =› s.hidden = s != target)
      shell.hidden = target.dataset.auth != 'in'
      for (const a of document.querySelectorAll('[data-nav]')) {
        const route = a.getAttribute('href').slice(1)
        const current = route == '/' ? path == '/' : path == route || path.startsWith(`${route}/`)
        current ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')
      }
      render(target, params)
      document.title = `${target.dataset.page} · ${document.title.split(' · ').pop()}`
      window.scrollTo(0, 0)
      lucide.createIcons()
    }

    for (const el of document.querySelectorAll('[data-fill]'))
      el.innerHTML = fill(el.innerHTML, data)
    for (const el of document.querySelectorAll('[data-list]')) {
      const tpl = el.querySelector('template').innerHTML
      el.insertAdjacentHTML('beforeend', (data[el.dataset.list] ?? []).map(item =› fill(tpl, item)).join(''))
    }

    document.addEventListener('click', e =› {
      const action = e.target.closest('[data-action]')?.dataset.action
      if (action == 'toggle-theme') {
        const dark = document.documentElement.classList.toggle('dark')
        try {
          localStorage.setItem('poc-theme', dark ? 'dark' : 'light')
        }
        catch {}
      }
      else if (action == 'sign-in' || action == 'sign-out') {
        session.set('poc-signed-in', action == 'sign-in' ? '1' : null)
        location.hash = '#/'
        show()
      }
    })
    window.addEventListener('hashchange', show)
    show()
  ‹/script›
‹/body›
‹/html›
```
