# How to make your first cross-window connection

You will wire a page and an iframe into a handshaken session over [`@hyperfrontend/nexus`](/docs/libraries/nexus): contract-checked messages both ways, queued across the pre-open gap, closed cleanly.

A page and an [`<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) can already talk through [`postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage). What they cannot do is agree: nothing checks the message shape, nothing tells you the other side is ready, and a message sent one tick too early vanishes without a trace. You will build the smallest connection that fixes all three, a host page and a note-taking widget.

## 1. Install nexus in both projects

The host and the widget ship as separate projects, so both need it:

```bash
npm install @hyperfrontend/nexus
```

## 2. Declare what each side says

A [contract](/docs/libraries/nexus#api-IChannelContract) is self-oriented: [`emitted`](/docs/libraries/nexus#api-IChannelContract-prop-emitted) is what this side sends, [`accepted`](/docs/libraries/nexus#api-IChannelContract-prop-accepted) is what it will take in.

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

## 3. Give each window a broker, and each counterpart a channel

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

## 4. Connect

Both sides call [`connect()`](/docs/libraries/nexus#api-ChannelHandle); whichever gets there first waits for the other. The handshake crosses the two contracts, so [`open`](/docs/libraries/nexus#api-OpenEventData) hands you the peer's origin and declared contract before a single application message flows:

```ts
toWidget.on('open', ({ origin, contract }) => {
  console.log(`connected to ${origin}, which emits ${contract.emitted.length} action type(s)`)
})

toWidget.connect()
```

## 5. Send and receive

[`send(type, data)`](/docs/libraries/nexus#api-ChannelHandle) throws when the type is not in your `emitted` list, and queues when the session is not open yet, flushing in order once the handshake completes. A channel also delivers your own outbound messages to its [`onMessage`](/docs/libraries/nexus#api-ChannelHandle) subscribers, so branch on [`message.type`](/docs/libraries/nexus#api-IMessage-prop-type) rather than assuming everything you receive came from the other side.

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

The contract carries types, not payload shapes, so [`message.data`](/docs/libraries/nexus#api-IMessage-prop-data) arrives as `unknown` and you narrow it where you use it.

## 6. Close politely

Either side can end the session. [`disconnect()`](/docs/libraries/nexus#api-ChannelHandle) fires [`closing`](/docs/libraries/nexus#api-ChannelEvent) and keeps the channel active so the counterpart can flush, then both sides fire `close` and report inactive.

```ts
toWidget.disconnect()
```

## 7. Lock it to origins you trust

It works, and right now it works with anyone. Name the origins before this faces real traffic:

```ts
const broker = createBroker({
  name: 'host-page',
  contract: hostContract,
  settings: { whitelist: ['https://widgets.example.com'] },
})
```

For anything finer than an [origin list](/docs/libraries/nexus#api-BrokerSettings-prop-whitelist), a [`SecurityPolicy`](/docs/libraries/nexus#api-SecurityPolicy) decides per connection.

## Check it worked

Load the host page. The `open` handler logs the widget's origin and contract, the widget picks up the theme, and a note the widget sends lands in your sidebar. Move the first `send` above `connect()` and it still arrives, in order, once the session opens.
