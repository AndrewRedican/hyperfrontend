# Hostee

Hostee-side SDK for feature apps — feature initialization, contract declaration, and the feature lifecycle. A feature app stays a normal app; it knows nothing about any particular host.

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

`ready()` resolves once the host connection is established. `send` emits a contract action to the host; `on` subscribes to host messages and the `open`/`close`/`error` lifecycle events. `close` disconnects from the host.
