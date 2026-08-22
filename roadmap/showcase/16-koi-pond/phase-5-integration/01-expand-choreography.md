# Expand choreography

Part of [Phase 5](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §2](../recon.md#2-scene-signals-when-a-pond-can-know-card-vs-full)

## Goal

Expand and collapse become instance swaps instead of in-place rescales: expand destroys
the card session and cold-opens a full session in the overlay behind its curtain;
collapse destroys the full session and reopens a card session. This supersedes the
2026-08-09 decision to keep one session across expand (record the supersession in the
koi skill's decision notes and the demo working log, not in shipped prose).

## Files

- `apps/docs-site/src/components/demos/use-expanded-embed.tsx` (the choreography)
- `apps/docs-site/src/components/demos/cover-flow.tsx`
- `apps/docs-site/src/components/demos/demo-showcase.tsx`
- `apps/docs-site/src/components/demos/demo-embed.tsx`
- Specs: the docs-site demo component test surface (extend)

## Design

- **Expand**: destroy the card session's shell, open a fresh session in the overlay
  container. The new instance decides `full` through the existing first-proof
  `set-scene` (no new wire semantics); its curtain covers the trio load, so the visitor
  pays one curtain, never sees a half-built scene, and never sees the card world
  stretched.
- **Collapse**: destroy the full session, reopen a card session in the card container;
  the card re-decides its hourly fish (a collapse an hour later may greet a different
  koi; accepted and charming).
- **Escape and close-request**: the pond's `close-request` path now results in the
  collapse choreography (destroy full, reopen card); the close latch re-arm keeps
  working because the reopened card session starts fresh.
- **Scope decision (resolve at implementation, default koi-only)**: the choreography
  applies per demo via the manifest rather than globally. Clock and heartbeat keep
  today's single-session expand (destroying a heartbeat session on expand would reset
  its measured bpm for no benefit). Default: a manifest flag selecting the reopen
  choreography, set for the koi entry only.
- **Outer contract untouched**: 0.2.0, no outer shell repack; the choreography is pure
  gallery-side session management.
- The [outer resurrection](../phase-2-isolated-improvements/04-docs-embed-resurrection.md)
  policy applies to whichever instance is current; a pending revive for a destroyed
  instance cancels on the swap.

## Specs

- Expand destroys before opening (never two live pond sessions); collapse symmetric.
- Escape-in-pond lands in the collapse choreography.
- Non-koi demos keep single-session expand (manifest flag honored).
- Pending outer revives cancel on swap.

## Documentation impact

- None shipped beyond the koi skill notes in
  [03-doctrine-rewrites.md](03-doctrine-rewrites.md) (the gallery components are
  internal).

## Verification

```bash
npx nx test docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
npx nx format:write --projects=docs-site
```
