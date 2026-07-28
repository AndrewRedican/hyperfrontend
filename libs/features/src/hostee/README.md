# Hostee

Hostee-side SDK for feature apps — feature initialization, contract declaration, and lifecycle.

```ts
import { createFeature } from '@hyperfrontend/features/hostee'

const feature = createFeature({
  name: 'clock',
  contract: {
    emitted: [{ type: 'tick' }],
    accepted: [{ type: 'set-timezone' }],
  },
})

await feature.ready()
feature.on('set-timezone', ({ tz }) => render(tz))
setInterval(() => feature.send('tick', Date.now()), 1000)
```

## API

| Export          | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `createFeature` | Connect a feature app to its host; returns `send`/`on`/`ready`/`close`. |
| `FeatureHandle` | Type of the handle returned by `createFeature`.                         |

`ready()` resolves once the wire handshake with the host completes, and rejects if the host does not open the connection within `readyTimeoutMs` (default 10 s; an `error` with `reason: 'ready-timeout'` is also emitted). Sends issued before the handshake completes queue and flush on open. `send` emits a contract action to the host; `on` subscribes to host messages and the `open`/`closing`/`close`/`error` lifecycle events (`closing` is the flush window before a polite close completes). `setDirty` declares unsaved work to the host. `close` disconnects from the host politely.
