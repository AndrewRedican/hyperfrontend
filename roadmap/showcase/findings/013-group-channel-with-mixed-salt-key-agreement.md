# F-013 — a use case for a group channel: all participants mix in their salts and talk on one bus

| Field        | Value         |
| ------------ | ------------- |
| Category     | other         |
| Severity     | low           |
| Surfaced by  | demo-koi-pond |
| Status       | open          |
| Disposition  | —             |
| Graduated to | —             |

Not friction — an interesting use case the pond surfaced. Filed so the idea survives triage.

## What happened

The koi pond needs every fish to know where its neighbours are. The SDK's model is strictly
pairwise — one shell, one broker, one iframe, one channel, resolved by source window — so the
only shape available is hub-and-spoke: seven fish each report state to the host, the host
aggregates, filters, and re-sends each fish a personalised neighbourhood view. That casts the
host as a mandatory orchestrator-mediator for traffic that is semantically a broadcast, doubles
every payload's trip, and puts the host's relay cadence in the middle of everyone's latency. It
also multiplies exactly the per-message channel traffic that F-011 collapses under.

## The use case

A **group channel**: host and all hostees join one shared bus where every participant can talk
and listen at once, with no one relaying. Key agreement could be contributory — **each
participant mixes in its own salt**, and the group key is derived from everyone's contributions —
so no single party (host included) dictates the key, joining is an explicit act, and a rekey on
membership change falls out naturally. Onto the koi pond: each fish broadcasts its outline once,
all six others and the host hear it directly, and the host's relay loop — aggregation,
broad-phase filtering, per-fish fan-out — disappears; the host keeps only the roles that are
genuinely its own (pointer, pond geometry, sequencing).

## Why it's worth recording

- Many-to-many is the natural shape for any multi-feature scene with shared environmental state —
  the pond will not be the last demo that wants it.
- One send reaching N listeners structurally removes the O(N) relay fan-out and the mediator hop,
  rather than optimising them.
- The contributory-salt key agreement extends the existing salt/derivation vocabulary of the v1
  layer to N parties instead of replacing it with something foreign.

## Proposed fix / improvement

Nothing to fix — candidate v2 capability. Sketch: `createGroupChannel(name)` on host and feature
sides; membership handshake where each joiner contributes a salt; group key derived from the
mixed contributions; broadcast send; per-sender attribution on receive; rekey on join/leave.

## Repro / evidence

The workaround this idea would replace is the pond's relay:
`apps/demos/koi-pond/host/src/scene/relay.ts` (aggregate + broad-phase + per-fish `neighbors`
fan-out every 120 ms), consuming `outline` reports from seven `apps/demos/koi-pond/fish-*`
channels.
