Readable copy of `data.js` for tools that strip or skip script files. `data.js` is the source; this block is it, unmodified.

```js
// The POC's one fake data set, seen by one signed-in user. After approval it becomes the
// real app's dev and QA seed, so keep it realistic: one cast of people and items, never lorem ipsum.
window.POC_DATA = {
	user: { name: 'Ana Reyes', first: 'Ana', initials: 'AR', email: 'ana@example.com' },
	messages: [
		{ id: 'm1', author: 'Ben Ortiz', channel: 'chat', time: '10:42', text: 'Draft investor deck is in Documents — can you look before Thursday?' },
		{ id: 'm2', author: 'Chloé Martin', channel: 'email', time: '09:15', text: 'Re: pilot pricing — attached the revised numbers.' },
		{ id: 'm3', author: 'Ben Ortiz', channel: 'call', time: 'Yesterday', text: '12 min call · transcript ready' }
	]
}
```
