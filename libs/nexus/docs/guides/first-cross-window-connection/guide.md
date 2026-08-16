# Your first cross-window connection

By the end of this tutorial you will have a page and an iframe exchanging contract-checked messages over a handshaken session, with queueing across the pre-open gap and a clean shutdown, and you will understand the model every layer above nexus is built on.

A page and an iframe can already talk: `postMessage` on one side, a `message` listener on the other. What they cannot do, out of the box, is agree on anything. Nothing checks the message shape, nothing tells you the other side is ready, and a message sent one tick too early vanishes without a trace. You will build the smallest connection that fixes all three: a host page and a note-taking widget, each declaring what it sends and accepts.

## Install the package in both projects

The host and the widget are usually separate projects, so install it in both:

```bash
npm install @hyperfrontend/nexus
```

## Declare what each side says

A [contract](/docs/libraries/nexus#api-IChannelContract) is self-oriented: `emitted` lists what this side sends, `accepted` lists what it is willing to receive.

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

Anything one side emits that the other does not accept is dropped before it reaches a handler.

## One broker per window, one channel per counterpart

A [broker](/docs/libraries/nexus#api-createBroker) owns a window and speaks for it. A [channel](/docs/libraries/nexus#api-ChannelHandle) is that broker's line to one specific counterpart window.

```ts
import { createBroker } from '@hyperfrontend/nexus'
import { hostContract } from './contracts'

const frame = document.querySelector('iframe')
if (!frame?.contentWindow) throw new Error('The widget iframe is not in the page yet')

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

Both sides call `connect()`. Underneath, the brokers run a handshake and cross their contracts during that exchange, which is why the [`open`](/docs/libraries/nexus#api-OpenEventData) event can hand you the peer's origin and declared contract before a single application message flows:

```ts
toWidget.on('open', ({ origin, contract }) => {
  console.log(`connected to ${origin}, which emits ${contract.emitted.length} action type(s)`)
})

toWidget.connect()
```

Order does not matter: whichever side connects first waits for the other.

## Send and receive

`send(type, data)` throws if the type is not in your `emitted` list. A channel also delivers your own outbound messages to that channel's `onMessage` subscribers, so branch on `message.type` rather than assuming everything you receive came from the other side.

On the host:

```ts
toWidget.onMessage((message) => {
  if (message.type === 'note-created') {
    const { text } = message.data as { text: string }
    addNoteToSidebar(text)
  }
})

toWidget.send('theme-changed', { theme: 'dark' })
```

In the widget:

```ts
toHost.onMessage((message) => {
  if (message.type === 'theme-changed') {
    const { theme } = message.data as { theme: string }
    document.body.dataset.theme = theme
  }
})

toHost.send('note-created', { text: 'Ship the widget' })
```

The contract carries types, not payload shapes, so [`message.data`](/docs/libraries/nexus#api-IMessage) arrives as `unknown` and you narrow it where you use it.

## Send before the session opens

Nexus channels queue. A `send` before the session opens sits in the channel's queue and flushes, in order, the moment the handshake completes, so the host could have sent the theme before it connected:

```ts
toWidget.send('theme-changed', { theme: 'dark' })
toWidget.connect()
```

The widget receives that theme once it connects.

## Close it down

Either side can end the session. `disconnect()` proposes a polite close: the channel fires `closing` and stays active so the counterpart can flush, then both sides fire `close` and report inactive once the acknowledgement lands.

```ts
toWidget.disconnect()
```

## Lock it to a trusted origin

The connection works, and it will work with anyone. Name the origins you trust before it faces real traffic:

```ts
const broker = createBroker({
  name: 'host-page',
  contract: hostContract,
  settings: { whitelist: ['https://widgets.example.com'] },
})
```

For anything finer than an origin list, a [`SecurityPolicy`](/docs/libraries/nexus#api-SecurityPolicy) decides per connection.

You now have two windows with crossed contracts, a handshaken session, delivery in both directions, ordered queueing across the pre-open gap, a clean shutdown, and an origin rule — and neither side touched `postMessage` or event plumbing directly.
