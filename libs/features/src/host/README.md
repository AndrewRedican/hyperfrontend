# Host

Host-side SDK for embedding hyperfrontend features — shell factory, display modes, iframe utilities, and lifecycle.

```ts
import { createShell, DisplayMode } from '@hyperfrontend/features/host'

const shell = createShell({
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

| Export             | Purpose                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `createShell`      | Build a shell handle for a feature; returns `open`/`close`/`send`/`on`/`isOpen`. |
| `DisplayMode`      | The four built-in modes: `Embedded`, `Dialog`, `Popup`, `Standalone`.            |
| `ShellHandle`      | Type of the handle returned by `createShell`.                                    |
| `ShellOptions`     | Options accepted by `createShell` and per-`open` overrides.                      |
| `ExperiencePlugin` | Opt-in extension point for layering transitions/animations onto display modes.   |

The shell wraps a `@hyperfrontend/nexus` broker: `send` emits a contract action to the feature, and `on` subscribes to feature messages and the `open`/`closing`/`close`/`error`/`status`/`dirty-state` lifecycle events. `close` disconnects the channel politely (the feature gets a `closing` flush window, and `isDirty` reports declared unsaved work first); `destroy` also releases the DOM.

Opening is asynchronous: `isOpen` stays `false` and sends queue until the wire handshake with the feature completes, flushing on the `open` event. If the feature never completes the handshake within `openTimeoutMs` (default 10 s), the shell tears the mount down and emits `error` with `reason: 'open-timeout'`.

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
