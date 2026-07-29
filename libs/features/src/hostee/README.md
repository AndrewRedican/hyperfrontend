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

`ready()` resolves once the wire handshake with the host completes, and rejects if the host does not open the connection within `readyTimeoutMs` (default 10 s; an `error` with `reason: 'ready-timeout'` is also emitted). Sends issued before the handshake completes queue and flush on open. `send` emits a contract action to the host; `on` subscribes to host messages and the `open`/`closing`/`close`/`error`/`presentation`/`resize` lifecycle events (`closing` is the flush window before a polite close completes). `setDirty` declares unsaved work to the host. `close` disconnects from the host politely.

## Presentation

The host owns how the feature is surfaced; the SDK receives that decision and prepares the document, so the app author only has to make the layout responsive.

Right after `open`, the host announces the display mode along with the frame's initial dimensions — read the mode from `feature.displayMode` or the `presentation` event (`{ mode }`); the dimensions arrive as the first `resize` event, no extra round trip. In the iframe modes the host then reports every change to the frame's usable space as exact pixels; the SDK sizes `html`/`body` to match and re-emits each as `resize` (`{ width, height }`). In `popup`/`standalone` the browser window is the viewport and `resize` comes from the feature's own window. Responding to the reported width and height — media/container queries, reflow, breakpoints — is the app author's job.

In **dialog** mode the frame spans the host's viewport, transparent. The SDK places your root element (the body's first element child, or pass `root` to `createFeature`) at the agreed position — centered by default — and sizes it to the agreed inner-box dimensions; everything around it is the backdrop. You style the box itself — background, border, shadow — since an unstyled box is invisible against the transparent backdrop. The SDK detects pointer interaction on the bare backdrop and Escape presses and reports them to the host as dismiss signals — pure reports: the SDK tears nothing down itself, and if the host's policy is to close, the ordinary polite close (`closing` flush window included) follows. Because the pane covers the whole viewport, dragging or resizing the box is ordinary in-document CSS/pointer work if you want it — nothing crosses the boundary.

The body reset (`resetBody`, on by default) keeps `html`/`body` margin-free and **transparent**, with a `color-scheme` pin matched to the host frame — overriding the background or `color-scheme` with an opaque/dark scheme breaks the transparency that embedded blending and dialog backdrops depend on.
