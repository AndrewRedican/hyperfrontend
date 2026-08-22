# Gallery outer resurrection

Part of [Phase 2](README.md) · Guardrails: [plan index](../README.md) · Findings:
[F-018](../../findings/018-no-way-to-revive-a-session-whose-frame-died.md),
[F-019](../../findings/019-dead-iframe-left-mounted-paints-the-browser-crash-placeholder.md)

## Goal

Make the docs-site gallery heal a dead demo frame instead of leaving a corpse. Today
`DemoEmbed` handles only `open-timeout` and status snapshots; an `error` with reason
`unresponsive` leaves the dead iframe mounted, and Chrome paints its crash placeholder
inside the card (F-019). The pond already heals its inner fish frames
(`apps/demos/koi-pond/host/src/scene/resurrection.ts`); the outer boundary needs the same
policy.

## Files

- `apps/docs-site/src/components/demos/demo-embed.tsx` (the error subscription)
- Likely a small shared helper beside it (the backoff policy as a hook or plain module)
  so the logic is testable and reusable across embed surfaces
- Specs: the docs-site vitest surface for demo components (extend where the existing
  embed tests live)

## Design

- On `error {reason:'unresponsive'}`: destroy the shell (the corpse leaves the DOM), wait
  a grace period, reopen, with the same budget shape as the pond's inner policy: 4s
  grace, backoff 4/12/36s, 3 attempts per episode, and a 60 second stability period that
  restores the budget only after sustained presence.
- On giving up: destroy the shell and land in the existing offline presentation, now over
  an empty container rather than a mounted corpse.
- Reversibility: a session that comes back during grace cancels the pending reopen; the
  stability window arms only on real presence (mirror the pond policy's semantics,
  including re-running the grace after a return from hidden rather than reopening blind).
- Scope: the generic embed path, so clock and heartbeat inherit the healing; run a
  regression pass on both embeds (their open/close/expand flows are unchanged, only the
  previously-unhandled error path gains behavior).

## Specs

- Fake-timer suite over the policy: grace, backoff ladder, attempt budget, stability
  restore, cancel-on-recovery, defer-while-hidden with grace re-run on return.
- A `destroy` always precedes a reopen (no double-mounted shells).

## Documentation impact

- None shipped (docs-site internal component). The findings F-018/F-019 registry rows
  gain their graduation note in [phase 5](../phase-5-integration/04-findings.md) once the
  outer policy ships.

## Verification

```bash
npx nx test docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
npx nx format:write --projects=docs-site
```
