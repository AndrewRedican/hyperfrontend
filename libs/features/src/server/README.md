# Server

Dev server and debug UI for testing host/hostee interactions (per-app static hosting plus display-mode, resize, message-log, and security controls), and the production static server behind `hf serve`.

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

A URL ending in `/` serves that directory's `index.html`, so a multi-page build's `index.html` and `host/index.html` load at `/` and `/host/`; the unslashed [`/host`](https://www.hyperfrontend.dev/docs/libraries/features/host/) answers `301` to `/host/`.

Each configured app is served by its own static server bound to its [`port`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-ResolvedDevApp-prop-port), so apps load at distinct origins, letting the host/hostee message channel and security envelope be exercised cross-origin, exactly as in production. The debug UI is hosted at `/` on a separate control server (default port `4280`, movable with the config's [`debug.port`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-ResolvedDevConfig-prop-debugPort) or the `--port` flag, which wins), which also exposes the running-app manifest at `/__apps` and the compiled debug-UI assets under `/__debug/`. Resolution fails loudly when an app's port equals the enabled debug UI's port, naming both.

## Production serving

The production static server is [`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/)'s: this entry re-exports it and adds the `hf-serve.config.*` resolution in front of it.

`hf serve` serves one directory over one port, and its production behavior is fixed: text responses are brotli- or gzip-compressed per the client's `Accept-Encoding` (compressed bytes cached per file), every file carries a weak ETag and a matching `If-None-Match` answers `304`, directory URLs resolve to `index.html` with the `301` redirect described above, dotfiles and the `hf-serve.config.*` file answer `404`, only [`GET`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET)/[`HEAD`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD) are answered (anything else gets `405`), a failure inside the pipeline answers `500` instead of crashing the server, each request writes one access-log line, and [`SIGINT`](https://nodejs.org/api/process.html#signal-events)/[`SIGTERM`](https://nodejs.org/api/process.html#signal-events) close the server gracefully.

What varies is data, declared in `hf-serve.config.*`: the served [`root`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-root), the listen [`port`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-port) and [`host`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-host), the [`log`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-log) switch, and ordered [`headers`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-headers) rules; each rule matches by optional path [`prefix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeHeaderRule-prop-prefix)/[`suffix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeHeaderRule-prop-suffix), and later rules override earlier ones one header at a time:

```json
{
  "root": "dist/site",
  "port": 8080,
  "headers": [{ "suffix": ".html", "headers": { "Cache-Control": "no-cache" } }]
}
```

Three more fields declare an intent in place of headers spelled by hand. Each expands into one rule that matches every path, and the three are placed in this order ahead of the [`headers`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-headers) rules, so an authored rule still overrides any header they set:

| Field                                                                                                                     | Declares                                                                                                                   | Sends                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-embedders)                 | The origins allowed to frame the site; `[]` allows none                                                                    | `Content-Security-Policy` holding one `frame-ancestors` directive, plus `X-Frame-Options` when the list is empty, `'none'` or `'self'` alone |
| [`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-permissionsPolicy) | For each browser feature, the origins allowed to use it; `[]` disables the feature and `["self"]` keeps it for this origin | One `Permissions-Policy` header                                                                                                              |
| [`isolation`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-isolation)                 | Cross-origin isolation, as `"require-corp"` or `"credentialless"`                                                          | `Cross-Origin-Opener-Policy: same-origin`, the declared `Cross-Origin-Embedder-Policy`, and `Cross-Origin-Resource-Policy: cross-origin`     |

```json
{
  "root": "dist/site",
  "embedders": ["'self'", "https://host.example"],
  "permissionsPolicy": { "camera": [], "geolocation": ["self"] },
  "isolation": "credentialless",
  "headers": [{ "suffix": ".html", "headers": { "Cache-Control": "no-cache" } }]
}
```

For a feature, [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-embedders) is the list of hosts allowed to embed it. An entry is `'self'` or `scheme://host` with an optional leading `*.` label and an optional port. An entry that would permit every origin (`*`, `https:`, a `*` host), carries a path, lacks a scheme or is not lowercase ASCII is refused. Once the field is declared, a rule that sets `Content-Security-Policy` must carry a `frame-ancestors` directive of its own, because a rule replaces the header whole; a rule bounded by a prefix or suffix may list different sources, and a rule for every path must list the same ones. The [policy reference](https://www.hyperfrontend.dev/docs/libraries/server/policy/) has the full grammar of both fields.

A bound counts only when it excludes a path: a prefix of `/` and an empty prefix or suffix bound nothing. A bound is matched against the path of the file that is served, in the spelling the file system stores: where a volume ignores letter case, `/HOST/index.html` reaches `host/index.html` and is sent the headers of a rule bounded by `/host/`, and so is a request that names the directory by a Windows short name. Write a bound the way the directory lists the name.

Every response `hf serve` gives carries the rules that match it, error answers included: a 400, a 403, a 404, a 405 for a method other than GET and HEAD, and the 500 of a request the server failed on. No error answer takes a cache header from a rule as written, so the year written for a hashed file is never sent with the 404 for a missing one. Where a matching rule names `Cache-Control`, [`Expires`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expires), `Surrogate-Control`, `X-Accel-Expires` or a header whose name ends in `-Cache-Control`, the error is sent `Cache-Control: no-store` in its place. Where none does, a 400, 403, 404 or 405 carries no cache header. The 500 is marked `Cache-Control: no-store` whatever the rules say.

No rule sets `Transfer-Encoding`, [`Trailer`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Trailer), [`Connection`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Connection), `Keep-Alive`, [`Upgrade`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Upgrade) or [`TE`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/TE) on any response: each is skipped, as the content length is, because the server frames the body and decides when a connection closes. A response that serves no file is matched by its path as requested. Two replies sit outside the rules: Node.js's own to a request it cannot parse, which never reaches the server's code, and what a custom step answers by itself when the pipeline is extended in code.

[`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-permissionsPolicy) restricts what the served documents may use, whatever a host delegates to them. It is not the feature config's [`permissions`](https://www.hyperfrontend.dev/docs/libraries/features/#api-FeatureConfig-prop-permissions), which lists what the feature asks its host for: a permission the feature declares and the serve config disables stays off. [`isolation`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-isolation) severs the opener of a window a cross-origin host opens onto the site, so a feature served this way cannot complete a popup or standalone session. `hf build` reads the `hf-serve.config.json` in the project's `public/` directory, or beside the feature config, and warns about either disagreement.

The config is checked whole when it loads. Every problem is reported at once, one per line, and a field the config does not take is a problem (`$schema` excepted), so a mistyped field cannot leave a policy unsent. A release of this package that predates [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-embedders) and [`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-permissionsPolicy) ignores both without an error and sends neither header: where the server is pinned separately from the config, confirm the headers on a deployed response before relying on them.

A config written in TypeScript can compose the header presets, which this entry re-exports from [`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/policy/):

```ts
import { defineServeConfig } from '@hyperfrontend/features'
import { contentSecurityPolicy, immutableAssets, nosniff } from '@hyperfrontend/features/server'

const embedders = ["'self'", 'https://host.example']

export default defineServeConfig({
  embedders,
  headers: [
    nosniff(),
    contentSecurityPolicy({ embedders, directives: { 'img-src': ["'self'", 'data:'] } }, { suffix: '.html' }),
    immutableAssets('/assets/'),
  ],
})
```

No config is required at all: with none found, the working directory is served on port `4284` on every interface. The file is selected by `--config`, else (when `--root` names a directory carrying one) the artifact's own `<root>/hf-serve.config.json`, else discovered in the working directory. A platform-assigned [`PORT`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runServe) environment variable overrides the config's port, and the `--root`/`--port`/`--host` flags override everything, so on a host that injects [`PORT`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runServe), `hf serve --root <dir>` needs no port flag at all.

Deliberately absent: SPA rewrites, extensionless `.html` rewriting, directory listings, [`Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range) requests, and CORS. Symlinked paths answer 404, and each response is read whole into memory (feature artifacts are small; there is no streaming path). The escape hatch is code, not config: custom steps prepend to the built-in pipeline (method guard → compression → header rules → file serving; rules sit inside compression so a rule-set `Cache-Control: no-transform` or `Content-Type` shapes what the compressor sees), so a step sees every request first and every response last, and either answers itself or transforms what `next()` returns:

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

Steps are deliberately not expressible in the config file: config files stay data.

## API

| Export                                                                                                                                                                                                                                                                                                                                                                                                                                          | Purpose                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`resolveDevConfig`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-resolveDevConfig)                                                                                                                                                                                                                                                                                                                                        | Resolve `hf-dev.config.*` + CLI flags into concrete app servers.                                                                                           |
| [`startDevServer`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-startDevServer)                                                                                                                                                                                                                                                                                                                                            | Start the app servers and the debug-UI control server.                                                                                                     |
| [`validateDevConfig`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-validateDevConfig) / [`validateApps`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-validateApps) / [`validateDevApp`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-validateDevApp)                                                                                                                            | Runtime validation of the config shape.                                                                                                                    |
| [`createStaticHandler`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-createStaticHandler) / [`serveFile`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-serveFile)                                                                                                                                                                                                                                     | Static-file request handling used by the app servers.                                                                                                      |
| [`resolveServeConfig`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-resolveServeConfig)                                                                                                                                                                                                                                                                                                                                    | Resolve `hf-serve.config.*` + CLI flags into a concrete serving plan.                                                                                      |
| [`startStaticServer`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-startStaticServer) / [`createServeListener`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-createServeListener)                                                                                                                                                                                                                     | Start the production static server, or host its request listener elsewhere.                                                                                |
| [`buildServeSteps`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-buildServeSteps) / [`buildCompressionStep`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-buildCompressionStep) / [`runSteps`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-runSteps)                                                                                                                            | The built-in [`ServeStep`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-ServeStep) pipeline and the runner custom steps compose with. |
| [`validateServeConfig`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-validateServeConfig) / [`validateHeaderRule`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-validateHeaderRule)                                                                                                                                                                                                                   | Runtime validation of the serve-config shape.                                                                                                              |
| [`checkServeConfig`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-checkServeConfig) / [`checkEmbedders`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-checkEmbedders) / [`checkPermissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-checkPermissionsPolicy)                                                                                                          | Every problem of a serve config, or of one policy field, as data.                                                                                          |
| [`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-expandHeaderPolicy) / [`applyHeaderRules`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-applyHeaderRules)                                                                                                                                                                                                                         | Expand the policy fields into ordered rules, and fold rules into the headers of one path.                                                                  |
| [`embedders`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-embedders) / [`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-permissionsPolicy) / [`crossOriginIsolation`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-crossOriginIsolation) / [`contentSecurityPolicy`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-contentSecurityPolicy) | Presets for the policy headers, each returning one rule a TypeScript config can scope to a prefix or suffix.                                               |
| [`nosniff`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-nosniff) / [`referrerPolicy`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-referrerPolicy) / [`strictTransportSecurity`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-strictTransportSecurity) / [`immutableAssets`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-immutableAssets)                 | Presets for the common hardening and cache headers.                                                                                                        |
| [`frameAncestors`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-frameAncestors) / [`frameAncestorsOf`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-frameAncestorsOf) / [`permitsEveryOrigin`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-permitsEveryOrigin) / [`matchesEveryPath`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-matchesEveryPath)       | Write a `frame-ancestors` directive, read the ones a policy declares, and tell whether a source permits every origin or a rule's bounds exclude no path.   |

The config schemas ([`apps`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-ResolvedDevConfig-prop-apps)/[`debug`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-ResolvedDevConfig-prop-debug) and [`root`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-root)/[`port`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-port)/[`host`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-host)/[`headers`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-headers)/[`log`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ResolvedServeConfig-prop-log)) and the `defineDevConfig()` / `defineServeConfig()` authoring helpers live in the main [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/) entry.
