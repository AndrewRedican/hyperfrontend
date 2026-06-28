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

The shell wraps a `@hyperfrontend/nexus` broker: `send` emits a contract action to the feature, and `on` subscribes to feature messages and the `open`/`close`/`error` lifecycle events. `close` disconnects the channel; `destroy` also releases the DOM.
