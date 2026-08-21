# F-018 — A dead frame and a slow frame raise the same error, and nothing brings a dead session back

| Field        | Value         |
| ------------ | ------------- |
| Category     | api-friction  |
| Severity     | high          |
| Surfaced by  | demo-koi-pond |
| Status       | open          |
| Disposition  | —             |
| Graduated to | —             |

## What happened

On Android, the OS can kill one embedded feature's frame while the host page keeps
running. From the host's side the only signal is `error { reason: 'unresponsive',
missedBeats, lastBeatAt }`, which is exactly what a frame that is alive but briefly
starved also produces. The payload carries nothing that distinguishes "this frame's
process is gone" from "this frame will beat again in a second", and the SDK offers no
policy for coming back from the first case: `onUnresponsive` can `emit` or `unmount`,
but neither re-opens, and there is no reopen-with-backoff affordance at all.

## Why it's friction (consumer lens)

Mobile browsers reserve the right to kill any frame. A host that embeds long-lived
features must treat that as ordinary weather, yet the SDK's vocabulary for it is one
ambiguous error and a shrug. Every consumer who wants a self-healing page has to
hand-roll the same machine: a grace period so a merely slow frame is not torn down
under its visitor, a re-open call, a backoff, an attempt cap, and a stability window
that restores the budget. The koi pond now carries exactly that module; every other
host will need to write it again.

## Proposed fix / improvement

Either or both of:

1. Enrich the verdict: since the host SDK owns the iframe it can probe a same-origin
   frame's document (and observe load/crash signals generally) and say
   `unresponsive` vs `frame-gone` instead of one blended reason.
2. Offer a revival policy on the shell options, e.g.
   `onUnresponsive: { reopen: { graceMs, backoff, attempts } }`, built on the already
   legal open-after-death sequence (`open()` destroys the old mount first).

## Repro / evidence

Open any embedded feature, then silence its frame without a close (kill the process,
or clear its intervals from devtools). ~3s later the host receives only
`error { reason: 'unresponsive' }`; nothing distinguishes it from a hung-but-alive
frame, and no SDK call short of hand-rolled `open()` policy brings the feature back.
The koi pond's workaround is `apps/demos/koi-pond/host/src/scene/resurrection.ts`.
