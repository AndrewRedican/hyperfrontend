# F-005 — `shell.on` handlers are implicitly `any`: the published entry types reference root exports that don't exist

| Field        | Value                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| Category     | packaging                                                                      |
| Severity     | medium                                                                         |
| Surfaced by  | demo-heartbeat (vanilla-TS host page consuming `@hyperfrontend/features/host`) |
| Status       | open                                                                           |
| Disposition  | —                                                                              |
| Graduated to | —                                                                              |

## What happened

In `@hyperfrontend/features@0.4.0` as installed from the registry, both subpath declaration files open with imports from the package root:

- `host/index.d.ts`: `import { ViewportPayload, ShellOptions, PresentPayload, RequestOptions, RequestHandler, EventHandler, DisplayMode } from '..'`
- `hostee/index.d.ts`: `import { RequestOptions, RequestHandler, EventHandler, DisplayMode, FeatureOptions } from '..'` and `export { …, ViewportPayload } from '..'`

But the root `index.d.ts` export list does not include `EventHandler`, `ViewportPayload`, or `PresentPayload`. With `skipLibCheck` (every scaffold default) the broken import itself is silenced, and the knock-on effect lands in consumer code instead: `ShellHandle.on(event, handler: EventHandler)` resolves `EventHandler` to an error type, so every `shell.on('beat', (data) => …)` callback fails `tsc` under `strict` with:

```
error TS7006: Parameter 'data' implicitly has an 'any' type.
```

The same applies to `feature.on(…)` on the hostee handle.

## Why it's friction (consumer lens)

Subscribing to events is the first thing a host does, and the very first callback written fails the strict-mode typecheck through no fault of the consumer. The error points at the consumer's own arrow function, not at the package, so it reads like a mistake in the demo code — it takes digging through the installed `.d.ts` files to discover the missing root exports. `EventHandler` also cannot be imported from anywhere public to annotate the parameter manually (it is absent from both the root and the subpath export lists), so the only options are annotating `data: unknown` by hand on every subscription or disabling `noImplicitAny`.

## Proposed fix / improvement

Export `EventHandler`, `ViewportPayload`, and `PresentPayload` from the root entry (or make the subpath `.d.ts` bundles self-contained so they never import from `'..'`). A CI check that typechecks a strict consumer fixture against the packed tarball would catch any future drift between subpath imports and the root export list.

## Repro / evidence

```bash
npm install @hyperfrontend/features@0.4.0
grep -n "from '..'" node_modules/@hyperfrontend/features/host/index.d.ts   # imports EventHandler, ViewportPayload, PresentPayload
grep -n "EventHandler" node_modules/@hyperfrontend/features/index.d.ts     # no matches in the export list
```

Minimal failing consumer (`strict: true`):

```typescript
import { createShell, mountEmbedded } from '@hyperfrontend/features/host'

const shell = createShell({ modes: { embedded: mountEmbedded }, container: '#stage' })
shell.on('beat', (data) => console.log(data)) // TS7006: Parameter 'data' implicitly has an 'any' type.
```

Workaround used in demo-heartbeat: annotate every subscription callback parameter as `data: unknown` explicitly.
