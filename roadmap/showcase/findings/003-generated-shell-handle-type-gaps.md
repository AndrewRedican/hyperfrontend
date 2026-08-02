# F-003 — Generated shell's `FeatureShellHandle` type omits `request`, `handle`, and `isDirty`

| Field        | Value                       |
| ------------ | --------------------------- |
| Category     | api-friction                |
| Severity     | medium                      |
| Surfaced by  | demo-clock 0.3.0 re-consume |
| Status       | open                        |
| Disposition  | —                           |
| Graduated to | —                           |

## What happened

The shell handle returned by a generated `createFeatureShell` supports the full 0.3.0 host surface at runtime — `request()`/`handle()` for correlated exchanges and the `isDirty` mirror of the feature's dirty state — but the tarball's generated `.d.ts` types only `open`/`close`/`destroy`/`send`/`on`/`isOpen`. Calling `shell.request('get-time')` from TypeScript fails to compile against the generated types and needs a cast, even though it works.

## Why it's friction (consumer lens)

The generated package advertises itself as the typed way to embed the feature, and its README documents dirty state and request/response as part of the session model. A consumer who reaches for those APIs gets a type error that reads like "this shell doesn't support that", when the truth is "the generated type is incomplete". The workaround (structural cast) throws away exactly the type safety the generated package exists to provide.

## Proposed fix / improvement

Emit `request`/`handle`/`isDirty` (and their payload-typed signatures, consistent with the typed `send`/`on`) in the generated handle interface. The lifecycle event union already includes `dirty-state`, so the omission looks like an oversight from when the primitives landed after the generator's first typed cut.

## Repro / evidence

```ts
import { createFeatureShell } from '@hyperfrontend/demo-clock-shell'
const shell = createFeatureShell({ container, url })
await shell.request('get-time') // TS2339: Property 'request' does not exist on type 'FeatureShellHandle'
```

Verified 2026-08-01 against the generator output of `@hyperfrontend/features@0.3.0` (`hf build` in a scratch project; generated `index.d.ts` handle members: open/close/destroy/send/on/isOpen only).
