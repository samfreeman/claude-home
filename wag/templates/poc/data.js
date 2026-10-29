// The POC's one fake data set, seen by one signed-in user. After approval it becomes the
// real app's dev and QA seed, so keep it realistic: one cast of people and items, never lorem ipsum.
window.POC_DATA = {
	app: { name: '{{PROJECT_NAME}}', tagline: '' },
	user: { name: 'Ana Reyes', first: 'Ana', initials: 'AR', email: 'ana@example.com' },
	items: [
		{ id: 'i1', title: 'Quarterly review deck', owner: 'Ben Ortiz', status: 'In review', updated: 'Today, 10:42', body: 'Draft is ready for comments before Thursday.' },
		{ id: 'i2', title: 'Pilot pricing', owner: 'Chloé Martin', status: 'Open', updated: 'Today, 09:15', body: 'Revised numbers attached; two tiers instead of three.' },
		{ id: 'i3', title: 'Onboarding checklist', owner: 'Ben Ortiz', status: 'Done', updated: 'Yesterday', body: 'Final version signed off by the team.' }
	]
}
