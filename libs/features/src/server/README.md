# Server

Dev server and debug UI for testing host/hostee interactions — per-app static hosting plus display-mode, resize, message-log, and security controls.

## Quick start

Start a dev server from a resolved `hf-dev.config.*`:

```ts
import { resolveDevConfig, startDevServer } from '@hyperfrontend/features/server'

const config = await resolveDevConfig({ cwd: process.cwd(), flags })
const handle = await startDevServer(config)

console.log(handle.debugUrl) // http://localhost:4280/
handle.apps.forEach((app) => console.log(app.name, app.url))

await handle.close()
```

## How it serves

A URL ending in `/` serves that directory's `index.html`, so a multi-page build's `index.html` and `host/index.html` load at `/` and `/host/`; the unslashed `/host` answers `301` to `/host/`.

Each configured app is served by its own static server bound to its `port`, so apps load at distinct origins — letting the host/hostee message channel and security envelope be exercised cross-origin, exactly as in production. The debug UI is hosted at `/` on a separate control server (default port `4280`), which also exposes the running-app manifest at `/__apps` and the compiled debug-UI assets under `/__debug/`.

## API

| Export                                                  | Purpose                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `resolveDevConfig`                                      | Resolve `hf-dev.config.*` + CLI flags into concrete app servers. |
| `startDevServer`                                        | Start the app servers and the debug-UI control server.           |
| `validateDevConfig` / `validateApps` / `validateDevApp` | Runtime validation of the config shape.                          |
| `createStaticHandler` / `serveFile`                     | Static-file request handling used by the app servers.            |

The config schema (`apps`, `debug`) and the `defineDevConfig()` authoring helper live in the main `@hyperfrontend/features` entry.
