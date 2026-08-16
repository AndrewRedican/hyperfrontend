# Your first cross-window connection

A page and an iframe can already talk: `postMessage` on one side, a `message` listener on the other. What they cannot do, out of the box, is agree on anything. Nothing checks the message shape, nothing tells you the other side is ready, and a message sent one tick too early vanishes without a trace.

This tutorial builds the smallest real connection with `@hyperfrontend/nexus`: a host page and a note-taking widget in an iframe, each declaring what it sends and accepts, connected through a handshake, exchanging typed messages both ways. By the end you will also see the part that usually surprises people, which is that a message sent before the connection opens is not lost.

## What you need

A page, an iframe, and the package on both sides (the host and the widget are usually separate projects):

```bash
npm install @hyperfrontend/nexus
```

## Declare what each side says

A contract is self-oriented: `emitted` lists what this side sends, `accepted` lists what it is willing to receive. Incoming messages that are not in `accepted` are dropped instead of reaching your handlers. The drop is logged, but brokers run at the `error` log level by default, so pass `settings: { logLevel: 'info' }` to `createBroker` while you are wiring things up if you want to see it.

Put the pair somewhere both projects can read, or copy them; they are plain data.

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

The two mirror each other. The host emits `theme-changed` and the widget accepts it; the widget emits `note-created` and the host accepts it. They do not have to be perfect mirrors, but anything one side emits that the other does not accept will never be delivered.

## One broker per window, one channel per counterpart

A broker owns a window and speaks for it. A channel is that broker's line to one specific counterpart window. On the host page, the broker binds to the global `window` and the channel points at the iframe's window:

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

Nothing is connected yet. Creating a channel is free and synchronous; the trust is established in the next step.

## Open the session

Both sides call `connect()`. Underneath, the brokers run a handshake (request, accept, open) and cross their contracts during that exchange, which is why the `open` event can hand you the peer's origin and declared contract before a single application message flows:

```ts
toWidget.on('open', ({ origin, contract }) => {
  console.log(`connected to ${origin}, which emits ${contract.emitted.length} action type(s)`)
})

toWidget.connect()
```

Once `open` fires, `isActive()` is true on both channels. Order does not matter: whichever side connects first waits for the other. If the counterpart's contract is incompatible, for example when it fails a required-action check, the connection is denied before it opens and you get a `deny` event carrying the reason instead.

## Send and receive

`send(type, data)` validates the type against your `emitted` list. `onMessage` hands you everything the contract let through, and returns a function that unsubscribes. One thing to know: a channel also delivers your own outbound messages to that channel's `onMessage` subscribers, so branch on `message.type` (as below) rather than assuming everything you receive came from the other side.

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

The widget applied the host's theme, the host recorded the widget's note, and neither side touched `postMessage`, origins, or event plumbing directly.

## The part that saves you at 2 in the morning

In raw `postMessage` code, the classic failure is a race: the host sends before the iframe has attached its listener, and the message is simply gone. Nexus channels queue instead. A `send` before the session opens sits in the channel's queue and flushes, in order, the moment the handshake completes:

```ts
const toWidget = broker.addChannel('note-widget', frame.contentWindow)

toWidget.send('theme-changed', { theme: 'dark' })
toWidget.connect()
```

The widget receives that theme once it connects, however long that takes. This one behavior removes the `setTimeout(..., 100)` rituals that haunt most cross-frame integrations.

## Close it down

Either side can end the session. The counterpart is notified, and both channels report inactive:

```ts
toWidget.disconnect()
```

## What you built

Two windows with declared, crossed contracts; a handshaken session; typed delivery in both directions; ordered queueing across the pre-open gap; a clean shutdown. That is the whole mental model of nexus, and every layer above it, including encrypted transports and the features SDK, builds on exactly these pieces.

## Where to go next

- Lock the channel to trusted origins before you ship: see the security section of the [nexus API reference](/docs/libraries/nexus).
- Understand why the handshake and queueing work the way they do: [nexus architecture](/docs/libraries/nexus/architecture).
- If what you actually want is to embed another team's app without running both sides yourself, the [features layer](/docs/libraries/features) packages this whole pattern behind a generated shell, and [Embed a feature someone else shipped](/docs/guides/embed-a-shipped-feature) walks it.
