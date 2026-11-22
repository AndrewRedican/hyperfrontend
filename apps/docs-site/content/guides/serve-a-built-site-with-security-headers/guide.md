# How to serve a built site with security headers

You will serve the directory your bundler wrote from a Node.js process that sends a framing policy, a permissions policy, cross-origin isolation and cache lifetimes, each declared as a field or a rule instead of a header spelled by hand. A policy that is malformed stops the process at startup with one line per problem, where a hand-written header with a typo is sent as it is and ignored by the browser.

A static server sends files. Whether another site may frame a page and how long a hashed script stays in a cache are decided by response headers, and each is sent only when the server is told to send it. [`@hyperfrontend/server`](/docs/libraries/server) serves a directory with compression, entity tags and hidden dotfiles built in, and its [`/policy`](/docs/libraries/server/policy) entry turns declared fields into the header rules that server applies. To serve a built hyperfrontend feature, run [`hf serve`](/docs/libraries/features/server#production-serving) from [`@hyperfrontend/features`](/docs/libraries/features) instead: it is this server behind a command, and reads the same fields from a config file.

The examples serve a Vite-style build: `dist/index.html`, `dist/docs/index.html` and content-hashed files under `dist/assets/`. One file, `server.ts`, grows through the steps.

## 1. Install it

```bash
npm install @hyperfrontend/server
```

The package has no dependencies, so this adds one entry to `node_modules`.

## 2. Serve the directory

[`startStaticServer`](/docs/libraries/server#api-startStaticServer) takes every field in its final form: an absolute [`root`](/docs/libraries/server/policy#api-ResolvedServeConfig-prop-root), a [`port`](/docs/libraries/server/policy#api-ResolvedServeConfig-prop-port), the [`headers`](/docs/libraries/server/policy#api-ResolvedServeConfig-prop-headers) rules in order and the [`log`](/docs/libraries/server/policy#api-ResolvedServeConfig-prop-log) switch. Resolve the root yourself and take the port from wherever your deployment keeps it:

```ts
import { resolve } from 'node:path'
import { startStaticServer } from '@hyperfrontend/server'

const server = await startStaticServer({
  root: resolve('dist'),
  port: 8080,
  log: false,
  headers: [],
})

console.log(`Serving ${server.url}`)
```

Port `0` lets the operating system choose one; the handle's [`port`](/docs/libraries/server#api-StaticServerHandle-prop-port) and [`url`](/docs/libraries/server#api-StaticServerHandle-prop-url) report it. The process already [compresses](/docs/libraries/server/architecture#compression) text with brotli or gzip, answers a conditional request with 304, resolves a directory URL to its `index.html` and answers 404 for a dotfile.

## 3. Declare who may frame the site

[`expandHeaderPolicy`](/docs/libraries/server/policy#api-expandHeaderPolicy) turns declared fields into header rules. Start with [`embedders`](/docs/libraries/server/policy#api-ServeConfig-prop-embedders), the origins allowed to load the site in a frame, and pass the result as the server's `headers`:

```ts
import { expandHeaderPolicy } from '@hyperfrontend/server/policy'

const headers = expandHeaderPolicy({
  embedders: ["'self'"],
})
```

Declare the list even when it is short, since a page sent without one can be framed by any origin:

| `embedders`                          | Sent on every response                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `[]`                                 | `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`       |
| `["'self'"]`                         | `Content-Security-Policy: frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` |
| `["'self'", 'https://host.example']` | `Content-Security-Policy: frame-ancestors 'self' https://host.example`              |

A source that is malformed, or that would let every origin in, is refused before the server starts. `['self', 'host.example', 'https://Host.example/app']` throws this message:

```text
embedders[0] is a keyword and must carry its single quotes: 'self' or 'none'.
embedders[1] must start with a scheme and "://", as in https://host.example.
embedders[2] must be lowercase.
```

The [embedders grammar](/docs/libraries/server/policy#embedders) lists what a source may be.

## 4. Switch off the browser features the pages do not use

[`permissionsPolicy`](/docs/libraries/server/policy#api-ServeConfig-prop-permissionsPolicy) maps a feature name to the origins that may use it. An empty list disables the feature for the pages and every frame inside them; `['self']` keeps it for the site's own origin:

```ts
const headers = expandHeaderPolicy({
  embedders: ["'self'"],
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
})
```

This sends [`Permissions-Policy: camera=(), microphone=(), geolocation=()`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy). The [allowlist forms](/docs/libraries/server/policy#permissions-policy) cover the wildcard and named origins.

## 5. Isolate the origin when a page needs it

Add [`isolation`](/docs/libraries/server/policy#api-ServeConfig-prop-isolation) only when a page uses [`SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) or another API that requires [`crossOriginIsolated`](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated):

```ts
const headers = expandHeaderPolicy({
  embedders: ["'self'"],
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  isolation: 'require-corp',
})
```

It sends `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: cross-origin`. The cost is real: under `require-corp` a page loads an image, script or frame from another origin only when that resource opts in with a resource policy or CORS, and a page that another origin opens in a new window loses its `window.opener`. Choose `'credentialless'` when the pages load third-party images or scripts that send no such header.

## 6. Write the remaining headers as rules

The [`headers`](/docs/libraries/server/policy#api-ServeConfig-prop-headers) field takes the rules that are not a policy field. A [`ServeHeaderRule`](/docs/libraries/server/policy#api-ServeHeaderRule) names headers and bounds them with an optional [`prefix`](/docs/libraries/server/policy#api-ServeHeaderRule-prop-prefix) and [`suffix`](/docs/libraries/server/policy#api-ServeHeaderRule-prop-suffix); the [presets](/docs/libraries/server/policy#presets) build common ones. Send the fixed headers on every path, make pages revalidate, and let hashed files stay cached for a year:

```ts
import { expandHeaderPolicy, immutableAssets, nosniff, referrerPolicy } from '@hyperfrontend/server/policy'

const headers = expandHeaderPolicy({
  embedders: ["'self'"],
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  isolation: 'require-corp',
  headers: [
    // on every path
    nosniff(),
    referrerPolicy(),
    // pages revalidate, hashed files stay cached for a year
    { suffix: '.html', headers: { 'Cache-Control': 'no-cache' } },
    immutableAssets('/assets/'),
  ],
})
```

[`nosniff`](/docs/libraries/server/policy#api-nosniff) sends `X-Content-Type-Options: nosniff` and [`referrerPolicy`](/docs/libraries/server/policy#api-referrerPolicy) sends `Referrer-Policy: strict-origin-when-cross-origin`. [`immutableAssets`](/docs/libraries/server/policy#api-immutableAssets) sends `Cache-Control: public, max-age=31536000, immutable` under its prefix, so point it only at files whose name changes whenever their content does.

Rules apply in order, after the rules the fields expand into, and a later rule overrides an earlier one a header at a time. A rule is matched against the path of the file that is served, so the `.html` suffix covers `/` and `/docs/` as well.

An answer with a status of 400 or above takes every matching header except the cache headers, and is sent `Cache-Control: no-store` wherever a matching rule names one. The 404 for a file that is missing under `/assets/` carries the policy headers and `Cache-Control: no-store`, so the year written for the file is never given to its absence.

## 7. Answer a health probe ahead of the files

A [`ServeStep`](/docs/libraries/server#api-ServeStep) placed in front of the built-in steps sees every request first. Answer the probe's path with [`plainResponse`](/docs/libraries/server#api-plainResponse), pass everything else on, and hand the step to the server in [`steps`](/docs/libraries/server#api-StaticServeDeps-prop-steps):

```ts
import type { ServeStep } from '@hyperfrontend/server'
import { plainResponse } from '@hyperfrontend/server'

const health: ServeStep = (request, context, next) => {
  return request.url === '/healthz' ? plainResponse(200, 'ok') : next()
}

const server = await startStaticServer(
  {
    root: resolve('dist'),
    port: 8080,
    log: false,
    headers,
  },
  { steps: [health] }
)
```

What such a step answers by itself carries no header rule, since the built-in steps apply them: the probe gets a status, a content type and two bytes. The [`url`](/docs/libraries/server#api-StaticRequest-prop-url) it compares is the raw request target, query string included.

## 8. Turn on the access log

The access log has two halves, and prints only when both are there: [`log: true`](/docs/libraries/server/policy#api-ResolvedServeConfig-prop-log) in the first argument switches it on, and a [`log`](/docs/libraries/server#api-StaticServeDeps-prop-log) function in the second says where a line goes:

```ts
const server = await startStaticServer(
  {
    root: resolve('dist'),
    port: 8080,
    log: true,
    headers,
  },
  {
    log: (line) => console.log(line),
    steps: [health],
  }
)
```

Each request is one line of method, path without its query, and status. The checks at the end of this guide print these:

```text
HEAD / 200
HEAD /assets/index-4f2a9c1b.js 200
GET /assets/index-4f2a9c1b.js 304
GET /assets/index-4f2a9c1b.js 200
GET /.env 404
HEAD /assets/index-00000000.js 404
GET /healthz 200
```

The same function receives a line starting with `error` when a step throws, whatever the switch says.

## 9. Stop on a signal

[`waitForShutdown`](/docs/libraries/server#api-waitForShutdown) resolves on an interrupt or terminate signal, and the handle's [`close()`](/docs/libraries/server#api-StaticServerHandle) resolves once the server has stopped. End the file with both:

```ts
import { waitForShutdown } from '@hyperfrontend/server'

console.log(`Serving ${server.url}`)
await waitForShutdown()
await server.close()
```

Start the file with `node` itself, not through a package script, so the signal reaches the process. Node.js 22.18 or later runs `node server.ts` as it is; on an earlier release compile it and start the output the same way. Sent a terminate signal, the process exits with code 0.

## Check it worked

Start the server and ask it for a page, a hashed file, a dotfile and a name that does not exist in your own build. The answers below are the example site's. A page carries every declared header and revalidates:

```bash
curl -sI http://localhost:8080/
```

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 304
ETag: W/"130-1a2043c2ed5"
Content-Security-Policy: frame-ancestors 'self'
X-Frame-Options: SAMEORIGIN
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-cache
Vary: Accept-Encoding
Date: Sun, 22 Nov 2026 17:18:04 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

A hashed file carries the same policy with the long lifetime, and its entity tag, sent back, answers a conditional request with 304. Put one of your own hashed files in `ASSET`; the commands read the tag from the first answer:

```bash
ASSET=http://localhost:8080/assets/index-4f2a9c1b.js
SEEN=$(curl -sI $ASSET | grep -i -E '^(etag|cache-control)' | tr -d '\r')
echo "$SEEN"
TAG=$(echo "$SEEN" | sed -n 's/^ETag: //p')
curl -s -o /dev/null -w '%{http_code}\n' -H "If-None-Match: $TAG" $ASSET
```

```text
ETag: W/"23b4-1a2043c2ef4"
Cache-Control: public, max-age=31536000, immutable
304
```

A client that accepts brotli is sent the 9140-byte file in 381 bytes. Ask with a GET, since a HEAD always reports the uncompressed length:

```bash
curl -s -o /dev/null -D - -H 'Accept-Encoding: br' \
  $ASSET | grep -i -E '^content-(encoding|length)'
```

```text
Content-Length: 381
Content-Encoding: br
```

A dotfile answers 404, and a missing file under the cached prefix is a 404 that no cache may store, whatever lifetime the rule wrote for the file:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/.env
curl -sI http://localhost:8080/assets/index-00000000.js | grep -i -E '^(http|cache-control)'
```

```text
404
HTTP/1.1 404 Not Found
Cache-Control: no-store
```

The probe is answered without a header rule:

```bash
curl -si http://localhost:8080/healthz
```

```text
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Date: Sun, 22 Nov 2026 17:18:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 2

ok
```

Last, send the process a terminate signal with `kill -TERM` and read its exit code: 0, with one access-log line for each request above.
