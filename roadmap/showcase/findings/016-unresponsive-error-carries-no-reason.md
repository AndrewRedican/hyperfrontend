# F-016 — the unresponsive-feature `error` event carries no `reason`, so an embedder cannot tell it from any other error

| Field        | Value         |
| ------------ | ------------- |
| Category     | api-friction  |
| Severity     | medium        |
| Surfaced by  | demo-koi-pond |
| Status       | open          |
| Disposition  | —             |
| Graduated to | —             |

## What happened

The host SDK's `error` events are the one channel an embedder has for "something is wrong with
this session", and two very different failures arrive on it in two different shapes:

- A connect timeout emits a structured payload: `{ reason: 'open-timeout', elapsedMs, displayMode }`
  (`host/lifecycle.ts`, the connect-timeout handler).
- The default `'emit'` unresponsive policy emits a plain
  `Error('Feature became unresponsive.')` — **no `reason` field, no missed-beat count, no
  `lastBeatAt`** (`applyUnresponsive` in `host/lifecycle.ts`), even though the SDK holds all of
  that in the `UnresponsiveInfo` it passes to callback policies.

An embedder that discriminates errors by `reason` — the shape the SDK itself teaches with
`open-timeout` — silently ignores the unresponsive signal, because `(<{reason?: string}>data).reason`
is `undefined`. Matching on the message string is the only alternative, and message strings are
not API.

## Why it's friction (consumer lens)

The docs-site gallery embed does exactly this discrimination: `shell.on('error', …)` checks
`data.reason === 'open-timeout'` to show its offline card. The unresponsive error sails past
that check, so a session whose feature has genuinely hung looks no different to the embed than
a healthy one — the one signal built to say "this feature stopped beating" is unusable without
either string-matching or replacing the whole policy with a callback just to learn _why_ it
fired. Diagnosing the koi pond's gallery behaviour required reading the SDK source to discover
that the unresponsive error was arriving and being discarded.

## Proposed fix / improvement

1. Emit the unresponsive error with the same structured shape the connect timeout uses:
   `{ reason: 'unresponsive', missedBeats, lastBeatAt, displayMode }` — the SDK already has all
   of it in hand at the call site.
2. Document `reason` as the discriminator on every SDK-originated `error` event.

## Repro / evidence

```bash
grep -n "reason: 'open-timeout'" libs/features/src/host/lifecycle.ts     # structured
grep -n 'Feature became unresponsive' libs/features/src/host/lifecycle.ts # bare Error, no reason
grep -n "reason === 'open-timeout'" apps/docs-site/src/components/demos/demo-embed.tsx
```

**Workaround in the demo:** none needed in-tree — the pond re-emits its `shoal` report every
ten seconds as a liveness roll call, so the gallery's proof-event deadline never depends on
distinguishing the unresponsive error. Any embedder that _does_ need the distinction still
cannot get it from the event alone.
