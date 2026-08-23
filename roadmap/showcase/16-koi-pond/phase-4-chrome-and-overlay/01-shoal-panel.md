# Unified shoal panel

Part of [Phase 4](README.md) · Guardrails: [plan index](../README.md)

## Goal

One control surface for the shoal. The roster stops being a passive list and becomes the
panel that grows, shrinks, and inspects the shoal; the View-interactions toggle moves
inside it; phones keep it in the full scene as a collapsible pill.

## Files

- `apps/demos/koi-pond/host/src/scene/roster.ts` (replaced in presentation, retained in
  duty: it keeps its a11y responsibilities, including focus driving hover identity)
- `apps/demos/koi-pond/host/src/components/interactions-toggle.ts` (folds into the
  panel; the bottom-center pill retires)
- `apps/demos/koi-pond/host/src/styles/pond.css` (panel block, collapse-to-pill under
  680px, retirement of the standalone toggle styles)
- `apps/demos/koi-pond/host/src/scene/pond.ts` (wiring the panel to
  `addKoi`/`removeKoi` and the cap state)
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- **Rows**: one per framework: presence dot, framework name, an add button, a count
  badge, and a per-instance remove affordance when the count is above zero. Focus on a
  row still drives the hover identity of its fish (all instances of the framework
  highlight; the per-instance rows disambiguate).
- **Cap state**: at the tier cap, add buttons disable and the tier is named in the
  disabled reason (visitors on a low-tier phone learn why the pond refuses politely).
- **Toggle**: View-interactions becomes a labeled control inside the panel;
  `interactions-toggle.ts`'s behavior folds in; the floating pill and its styles are
  deleted.
- **Responsive**: under 680px the panel collapses to a pill instead of hiding, so phones
  finally get roster and controls in the full scene. The card scene still hides all
  chrome (existing `data-scene='card'` rule).
- **Keyboard**: every flow operable by keyboard: row focus, add, remove per instance,
  toggle; tab order stays coherent as rows gain and lose instance entries.

## Specs

- Panel state mirrors roster churn: add/remove reflect in counts, presence dots, and
  affordance states; cap disables adds with the tier name.
- Focus-to-hover identity still works per framework and per instance.
- Toggle round-trips the overlay state.
- Collapse threshold applies the pill state (class assertion; visual check in the phase
  gate).

## Documentation impact

- None shipped here; the koi skill's controls section is rewritten in
  [phase 5](../phase-5-integration/03-doctrine-rewrites.md).

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
