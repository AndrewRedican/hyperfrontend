# F-020 — A feature opened directly cannot learn it has no host, so an adaptive boot waits out a deadline nobody will answer

| Field        | Value                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Category     | missing-feature                                                                                            |
| Severity     | medium                                                                                                     |
| Surfaced by  | demo-koi-pond                                                                                              |
| Status       | triaged                                                                                                    |
| Disposition  | api-refinement                                                                                             |
| Graduated to | [koi pond phase 2, SDK `hosted` signal](../16-koi-pond/phase-2-isolated-improvements.md#the-hosted-signal) |

## What happened

The koi pond is a feature app that needs to boot differently when the docs-site gallery
hosts it versus when someone opens its URL directly. The published SDK resolves its host
window synchronously inside `createFeature` (an embedding iframe's parent, a host-opened
window's opener, or nothing), but the returned handle exposes no trace of that fact.
Opened directly, `ready()` never settles, `displayMode` stays `null`, no lifecycle event
fires, and `send` is a no-op; the only signal that nobody will ever announce anything is
the silence itself.

## Why it's friction (consumer lens)

The docs are firm that runtime modes are protocol facts, not URL guesses, and that a
feature never sniffs `window.parent`. That doctrine is right, but it leaves an adaptive
boot with two bad options: violate it with a `window.parent === window` check, or gate the
direct-visit path behind a fallback deadline that every real visitor waits out on every
load. The SDK is the one party allowed to know whether a host window exists, it computes
the answer synchronously, and it keeps the answer to itself.

## Proposed fix / improvement

A readonly `hosted: boolean` on `FeatureHandle`, set by the time `createFeature` returns:
`true` when a parent or opener window exists (the channel is armed toward it), `false`
when the document is top-level. It should promise nothing about the host actually
speaking; connection state already belongs to `ready()` and the lifecycle events.

## Repro / evidence

Open any packaged feature's URL directly in a tab: `createFeature` returns a handle whose
`ready()` stays pending and whose `displayMode` stays `null` forever, indistinguishable
without a deadline from a slow host. In the published source, `resolveHostWindow`
(`libs/features/src/hostee/lifecycle.ts`) computes the host window and keeps it
module-internal.
