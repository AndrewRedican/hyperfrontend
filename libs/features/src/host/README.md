# Host

Host-side SDK for embedding hyperfrontend features — shell factory, display modes, iframe utilities, and lifecycle.

```ts
import { builtInDisplayModes, createShell, DisplayMode } from '@hyperfrontend/features/host'

const shell = createShell({
  modes: builtInDisplayModes,
  url: 'https://features.example.com/clock',
  container: '#clock-slot',
  displayMode: DisplayMode.Embedded,
})

shell.on('open', () => console.log('feature connected'))
shell.on('tick', (time) => console.log('feature said', time))

shell.open()
shell.send('set-timezone', { tz: 'UTC' })
```

## API

| Export                | Purpose                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `createShell`         | Build a shell handle from an explicit `modes` map — only the mounts you pass ship.                              |
| `builtInDisplayModes` | The all-modes map, for hosts that want every mode available.                                                    |
| `mountEmbedded` …     | The four mount functions (`mountEmbedded`, `mountDialog`, `mountPopup`, `mountStandalone`) for the `modes` map. |
| `DisplayMode`         | The four built-in modes: `Embedded`, `Dialog`, `Popup`, `Standalone`.                                           |
| `ShellHandle`         | Type of the handle returned by `createShell`.                                                                   |
| `CreateShellOptions`  | Options accepted by `createShell` (`ShellOptions` plus the `modes` map).                                        |
| `ExperiencePlugin`    | Opt-in extension point for layering transitions/animations onto display modes.                                  |

The `modes` map is how unused mode code stays out of bundles: a generated shell passes exactly the modes its feature declared, and a hand-written host that only ever embeds can pass `{ embedded: mountEmbedded }` and ship one mode. Opening a mode outside the map throws, naming the supported set.

The shell wraps a `@hyperfrontend/nexus` broker: `send` emits a contract action to the feature, and `on` subscribes to feature messages and the `open`/`closing`/`close`/`error`/`status`/`dirty-state`/`dismiss` lifecycle events. `close` disconnects the channel politely (the feature gets a `closing` flush window, and `isDirty` reports declared unsaved work first); `destroy` also releases the DOM.

Opening is asynchronous: `isOpen` stays `false` and sends queue until the wire handshake with the feature completes, flushing on the `open` event. If the feature never completes the handshake within `openTimeoutMs` (default 10 s), the shell tears the mount down and emits `error` with `reason: 'open-timeout'`.

A feature that reloads itself (a refresh, an in-frame navigation, a dev-server rebuild) ends its session but keeps its mount: `close` fires with `{ reason: 'peer-reload' }`, then `open` fires again once the new document completes its own handshake, and the shell re-announces the presentation to it. Treat the pair as a session boundary — pending requests reject, `isDirty` resets, and anything you sent the previous document needs sending again. To refuse the reload instead, `destroy()` on that reason.

## Display modes and sizing

The host owns presentation. It picks the display mode (from the set the feature's contract declares), announces it to the feature once per mount — the announcement already carries the frame's initial dimensions, so the feature lays itself out without waiting for a second message — and is the single authority on frame geometry: every dimension crosses the boundary as an exact pixel value, host to feature, never the other way.

Mounted is not displayed: the frame mounts hidden and is revealed only once the session opens, so the user never sees (or clicks into) a frame whose feature is not ready. A dialog pane cannot intercept the page while it is still connecting; an embedded frame reserves its box without painting.

**Embedded** mounts the frame inline in your `container` and the frame fills the container's content box — measured before the frame is inserted, then observed with a `ResizeObserver`; every later change is reported to the feature. While the container has no measurable size (hidden, not yet laid out, or nothing gives it a height), the SDK applies a dynamic viewport-derived fallback so the embed is never invisible by accident; the fallback retires as soon as your layout takes over. A feature with intrinsic dimensions can bake fixed `embedWidth`/`embedHeight` instead (or you can pass them) — then the frame gets exactly those pixels and you place the container somewhere they fit; the SDK never distorts a fixed agreement.

**Dialog** is a full-viewport transparent pane layered above your page. The feature draws its dialog box (and any backdrop paint) inside the pane; `dialogWidth`/`dialogHeight` set the inner box (viewport-derived when unset) and `dialogPosition` places it — `center` by default, or any edge/corner (`top-left` … `bottom-right`). The feature detects backdrop clicks and in-frame Escape presses and reports them as a dismiss signal; `dialogBackdrop` decides what the shell does — `close` (default) starts the polite teardown, `event` emits a `dismiss` event for you to handle, `none` ignores it. `closeOnEscape` covers Escape from both documents.

```ts
shell.open({ displayMode: DisplayMode.Dialog, dialogWidth: 480, dialogPosition: 'top-center', dialogBackdrop: 'event' })
shell.on('dismiss', ({ source }) => console.log('backdrop interaction', source))
```

**Popup** opens a separate window at `popupWidth`/`popupHeight` (viewport-derived when unset), placed on the screen per `popupPosition` (`center` by default, or any edge/corner). After that the window belongs to the browser and the user: they move and resize it freely, and no frame geometry crosses the boundary. The window's title and chrome are not the host's to set — the title comes from the loaded document (the feature sets its own `document.title`), and browsers ignore chrome flags like resizability for `window.open`. **Standalone** is a plain new tab — the simplest mode, deliberately free of presentation coordination.

Transparency is on by default in both iframe modes (`allowtransparency` plus a matched `color-scheme` pin on both sides — a mismatch would force an opaque canvas), so features can render non-rectangular designs, blend with your UI, and paint dialog backdrops. Want an opaque embed? Give your container a background.

### What the SDK deliberately does not do

- **Content-driven growth** (the embed grows with its content) is not built in — it would hand geometry authority to the feature, which is the inversion this design exists to avoid. The recipe is one contract action: have the feature emit its content height as product data, and set it on the container you own (`shell.on('contentHeight', (px) => setContainerHeight(px))`); the SDK's container observation propagates the change back down.
- **Clipping and scrolling** are not managed. The feature owns its document's overflow behaviour; the host owns the container's. Neither needs a protocol.
- **Draggable/resizable dialog boxes** are not built in — but the full-viewport pane makes them a pure feature-side concern: the pane never moves, so the feature can drag or resize its inner box with ordinary CSS/pointer code and nothing needs to cross the boundary. If your host UI needs to know, carry position as an ordinary contract action.

## Browser capabilities

Two `ShellOptions` fields govern what the feature frame may do with the browser around it, both applied before the frame loads (the only moment they take effect) and both scoped to the iframe modes — `popup` and `standalone` open top-level windows, which ask the user for permissions directly.

`permissions` delegates Permissions-Policy features (camera, fullscreen, clipboard, …) to the frame via the iframe `allow` attribute. Browsers deny these to cross-origin frames by default, so a feature that needs one only works when the host delegates it. A generated connector bakes the needs the feature declared at build time (also disclosed in its README and `metadata.json`); a host-supplied list replaces the baked one entirely.

`sandbox` is the host's containment lever and is never baked by a build. `true` (or an opt-in object) starts the frame from the browser's deny-all sandbox; the SDK manages the two hazardous tokens itself — `allow-scripts` is always granted (the feature runtime is JavaScript), and `allow-same-origin` is granted only to cross-origin feature URLs, since a same-origin frame holding both tokens could remove its own sandbox. A sandboxed same-origin feature therefore runs with an opaque origin (no cookies or storage) while the messaging protocol still connects. Everything else — `forms`, `popups`, `modals`, `downloads`, `topNavigationByUserActivation` — is denied unless opted in. Requesting a sandbox on `popup` or `standalone` throws, because no containment can apply to a top-level window.

```ts
shell.open({
  permissions: ['fullscreen', 'clipboard-write'],
  sandbox: { downloads: true },
})
```
