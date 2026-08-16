# Your first cross-window connection

A page and an iframe can already talk: `postMessage` on one side, a `message` listener on the other. What they cannot do, out of the box, is agree on anything. Nothing checks the message shape, nothing tells you the other side is ready, and a message sent one tick too early vanishes without a trace.

This tutorial builds the smallest real connection with `@hyperfrontend/nexus`: a host page and a note-taking widget in an iframe, each declaring what it sends and accepts, connected through a handshake, exchanging typed messages both ways.

The host and the widget are usually separate projects, so install the package in both:

```bash
npm install @hyperfrontend/nexus
```

## Declare what each side says

A contract is self-oriented: `emitted` lists what this side sends, `accepted` lists what it is willing to receive. Incoming types outside `accepted` are dropped before they reach your handlers, and that drop is only logged if you lift the broker off its default `error` level by passing `settings: { logLevel: 'info' }` to `createBroker`.

```ts
// host page
export const hostContract = {
  emitted: [{ type: 'theme-changed', description: 'The host announces its current theme' }],
  accepted: [{ type: 'note-created', description: 'The widget reports a note the user saved' }],
}

// widget page
export const widgetContract = {
  emitted: [{ type: 'note-created', description: 'Reports a note the user saved' }],
  accepted: [{ type: 'theme-changed', description: 'Applies the host theme' }],
}
```

The two do not have to be perfect mirrors, but anything one side emits that the other does not accept will never be delivered.

## One broker per window, one channel per counterpart

A broker owns a window and speaks for it. A channel is that broker's line to one specific counterpart window.

```ts
import { createBroker } from '@hyperfrontend/nexus'
import { hostContract } from './contracts'

const frame = document.querySelector('iframe')

const broker = createBroker({ name: 'host-page', contract: hostContract })
const toWidget = broker.addChannel('note-widget', frame.contentWindow)
```

Inside the widget, the same two calls point the other way:

```ts
import { createBroker } from '@hyperfrontend/nexus'
import { widgetContract } from './contracts'

const broker = createBroker({ name: 'note-widget', contract: widgetContract })
const toHost = broker.addChannel('host-page', window.parent)
```

## Open the session

Both sides call `connect()`. Underneath, the brokers run a handshake (request, accept, open) and cross their contracts during that exchange, which is why the `open` event can hand you the peer's origin and declared contract before a single application message flows:

```ts
toWidget.on('open', ({ origin, contract }) => {
  console.log(`connected to ${origin}, which emits ${contract.emitted.length} action type(s)`)
})

toWidget.connect()
```

Once `open` fires, `isActive()` is true on both channels. Order does not matter: whichever side connects first waits for the other. Incompatible contracts are denied before the channel opens, and a `deny` event carries the reason instead.

## Send and receive

`send(type, data)` throws if the type is not in your `emitted` list. A channel also delivers your own outbound messages to that channel's `onMessage` subscribers, so branch on `message.type` rather than assuming everything you receive came from the other side.

On the host:

```ts
toWidget.onMessage((message) => {
  if (message.type === 'note-created') {
    addNoteToSidebar(message.data.text)
  }
})

toWidget.send('theme-changed', { theme: 'dark' })
```

In the widget:

```ts
toHost.onMessage((message) => {
  if (message.type === 'theme-changed') {
    document.body.dataset.theme = message.data.theme
  }
})

toHost.send('note-created', { text: 'Ship the widget' })
```

## The part that saves you at 2 in the morning

In raw `postMessage` code, the classic failure is a race: the host sends before the iframe has attached its listener, and the message is simply gone. Nexus channels queue instead. A `send` before the session opens sits in the channel's queue and flushes, in order, the moment the handshake completes:

```ts
const toWidget = broker.addChannel('note-widget', frame.contentWindow)

toWidget.send('theme-changed', { theme: 'dark' })
toWidget.connect()
```

The widget receives that theme once it connects, however long that takes. No more `setTimeout(..., 100)` rituals.

## Close it down

Either side can end the session. The counterpart is notified, and both channels report inactive:

```ts
toWidget.disconnect()
```

You now have two windows with crossed contracts, a handshaken session, typed delivery in both directions, ordered queueing across the pre-open gap, and a clean shutdown. Neither side touched `postMessage` or event plumbing directly.

One gap before this ships: nothing above restricts who may connect, so give the broker a `whitelist` or a security policy.

**Related:** [origin rules and broker settings](/docs/libraries/nexus) · [why the handshake queues](/docs/libraries/nexus/architecture)
