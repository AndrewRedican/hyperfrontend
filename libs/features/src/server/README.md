# Server

Dev server and debug UI for testing host/hostee interactions — per-app static hosting plus display-mode, resize, message-log, and security controls — and the production static server behind `hf serve`.

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

Or serve a built site for production:

```bash
hf serve --root dist/site --port 8080
```

## How it serves

A URL ending in `/` serves that directory's `index.html`, so a multi-page build's `index.html` and `host/index.html` load at `/` and `/host/`; the unslashed `/host` answers `301` to `/host/`.

Each configured app is served by its own static server bound to its `port`, so apps load at distinct origins — letting the host/hostee message channel and security envelope be exercised cross-origin, exactly as in production. The debug UI is hosted at `/` on a separate control server (default port `4280`), which also exposes the running-app manifest at `/__apps` and the compiled debug-UI assets under `/__debug/`.

## Production serving

`hf serve` serves one directory over one port, and its production behavior is fixed: text responses are brotli- or gzip-compressed per the client's `Accept-Encoding` (compressed bytes cached per file), every file carries a weak ETag and a matching `If-None-Match` answers `304`, directory URLs resolve to `index.html` with the `301` redirect described above, dotfiles and the `hf-serve.config.*` file answer `404`, only `GET`/`HEAD` are answered (anything else gets `405`), a failure inside the pipeline answers `500` instead of crashing the server, each request writes one access-log line, and `SIGINT`/`SIGTERM` close the server gracefully.

What varies is data, declared in `hf-serve.config.*`: the served `root`, the listen `port` and `host`, the `log` switch, and ordered `headers` rules — each rule matches by optional path `prefix`/`suffix`, and later rules override earlier ones one header at a time:

```json
{
  "root": "dist/site",
  "port": 8080,
  "headers": [{ "suffix": ".html", "headers": { "Cache-Control": "no-cache" } }]
}
```

No config is required at all: with none found, the working directory is served on port `4284` on every interface. The file is selected by `--config`, else — when `--root` names a directory carrying one — the artifact's own `<root>/hf-serve.config.json`, else discovered in the working directory. A platform-assigned `PORT` environment variable overrides the config's port, and the `--root`/`--port`/`--host` flags override everything — so on a host that injects `PORT`, `hf serve --root <dir>` needs no port flag at all.

Deliberately absent: SPA rewrites, extensionless `.html` rewriting, directory listings, `Range` requests, and CORS. Symlinked paths answer 404, and each response is read whole into memory (feature artifacts are small; there is no streaming path). The escape hatch is code, not config — custom steps prepend to the built-in pipeline (method guard → compression → header rules → file serving; rules sit inside compression so a rule-set `Cache-Control: no-transform` or `Content-Type` shapes what the compressor sees), so a step sees every request first and every response last, and either answers itself or transforms what `next()` returns:

```ts
import type { ServeStep } from '@hyperfrontend/features/server'
import { resolveServeConfig, startStaticServer } from '@hyperfrontend/features/server'

const cors: ServeStep = (_request, _context, next) => {
  const response = next()
  return { ...response, headers: { ...response.headers, 'Access-Control-Allow-Origin': '*' } }
}

const config = await resolveServeConfig({ cwd: process.cwd(), flags })
const handle = await startStaticServer(config, { steps: [cors] })
```

Steps are deliberately not expressible in the config file — config files stay data.

## API

| Export                                                  | Purpose                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `resolveDevConfig`                                      | Resolve `hf-dev.config.*` + CLI flags into concrete app servers.            |
| `startDevServer`                                        | Start the app servers and the debug-UI control server.                      |
| `validateDevConfig` / `validateApps` / `validateDevApp` | Runtime validation of the config shape.                                     |
| `createStaticHandler` / `serveFile`                     | Static-file request handling used by the app servers.                       |
| `resolveServeConfig`                                    | Resolve `hf-serve.config.*` + CLI flags into a concrete serving plan.       |
| `startStaticServer` / `createServeListener`             | Start the production static server, or host its request listener elsewhere. |
| `buildServeSteps` / `buildCompressionStep` / `runSteps` | The built-in `ServeStep` pipeline and the runner custom steps compose with. |
| `validateServeConfig` / `validateHeaderRule`            | Runtime validation of the serve-config shape.                               |

The config schemas (`apps`/`debug` and `root`/`port`/`host`/`headers`/`log`) and the `defineDevConfig()` / `defineServeConfig()` authoring helpers live in the main `@hyperfrontend/features` entry.
