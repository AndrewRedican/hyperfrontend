# Gradient cone

Part of [Phase 4](README.md) · Guardrails: [plan index](../README.md)

## Goal

The awareness cone stops detaching from the fish and stops having hard edges: origin
pulled back from the nose to the head center, and every cone boundary fades to
transparency.

## Files

- `apps/demos/koi-pond/host/src/scene/interactions.ts` (the painter)
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend where painter geometry
  is testable)

## Design

- **Origin**: derive the head center from the outline spine: the reported nose pulled
  back about 0.12 of the fish length along the reported heading. A cone anchored at the
  nose visually detaches on hard turns (the nose swings wide of the body); the head
  center stays inside the silhouette at every pose.
- **Gradient**: the cone fill fades to transparent at both lateral edges and at the far
  arc. Compose a radial gradient (near opaque-ish, far transparent) with an angular
  falloff toward the lateral edges; canvas gradient composition (for the angular
  component, either a second gradient pass with compositing or a segmented fill with
  per-segment alpha; implementation free, the requirement is no hard edge anywhere).
- Monochrome: the cone renders in the overlay's single ink; no intent coloring survives
  here (the deletion itself is [04-sliding-caret.md](04-sliding-caret.md)).

## Specs

- Origin math: for a set of poses (straight, mid-turn, hard turn), the computed origin
  lies on the spine segment between nose and body center.
- Whatever geometry helpers the painter extracts (origin pull-back, arc bounds) get unit
  coverage; the gradient itself is a visual check in the phase gate.

## Documentation impact

- None shipped here.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
