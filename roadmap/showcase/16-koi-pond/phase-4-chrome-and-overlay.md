# Phase 4: Chrome and overlay (shipped)

All five sub-plans shipped by 2026-08-23 and their documents were collapsed into this
record; what remains here is only the residue [phase 5](phase-5-integration/README.md)
builds against. The roster became one interactive shoal panel that also carries the
overlay control, the interaction overlay speaks a single monochrome grammar (a
head-anchored gradient cone, stationary pearls, a sliding caret), and the vitals overlay
reports per koi under a named device tier.

## What shipped

| Delivered                                                          | Where it lives                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Unified shoal panel: add, remove, counts, presence, keyboard, pill | `host/src/scene/roster.ts` (`createShoalPanel`), `pond.css` `.koi-shoal*` |
| The floating interactions pill folded into the panel               | `components/interactions-toggle.ts` deleted                               |
| Head-anchored gradient cone                                        | `host/src/scene/interactions.ts` (`headCentre`, `CONE_WEDGES`)            |
| Pearl trace                                                        | `host/src/scene/pearl-trace.ts` (`advanceTrace`, `pearlAlpha`)            |
| Sliding caret, colour grammar deleted                              | `host/src/scene/sliding-caret.ts`, one ink in `interactions.ts`           |
| Vitals rows, tier boot record, roster-change lines                 | `host/src/components/vitals.ts`, `pond.ts` diagnostics                    |

Specs: `scene/__tests__/` gained `interactions.spec.ts`, `pearl-trace.spec.ts`,
`sliding-caret.spec.ts`, `caret-slide.spec.ts`, and `overlay-recorder.ts` (a recording
2D context, which is how canvas grammar is asserted); the panel extends `pond.spec.ts`
and the vitals additions extend `components/__tests__/vitals.spec.ts`.

## The shoal panel

Facts the [doctrine rewrite](phase-5-integration/03-doctrine-rewrites.md) describes and
[device checklist](phase-5-integration/05-device-acceptance.md) item 3 walks:

- `createShoalPanel(root, shoalState(), hooks)` mounts a `nav.koi-shoal` (z-index 165)
  over the water and contains its own pointer and click events so a press on it never
  strikes the pond. `pond.ts` refreshes it on every roster change, presence change, hover
  change, and resize.
- Every framework keeps a row whether or not one of its koi is swimming: presence dot,
  name linked to that fish's app, a count badge hidden at zero, an add control, and a
  nested list of the framework's living koi, each with its own numbered remove control.
- Focus is the keyboard's hover. A framework's name or add control lights every answering
  koi of that framework; one koi's remove control lights that koi alone; blur clears. A
  control stranded by a rewrite (it left with its koi, or the press that disabled it was
  the one that hit the cap) hands focus to the row's add control, else the newest koi's
  control, else the row's name, so a keyboard journey never ends mid-gesture.
- The cap is stated rather than merely enforced: at the ceiling every add control
  disables and names the tier ("A low-tier device seats 4 koi."), and the note line
  otherwise counts the room left. The last koi's remove control disables with "The pond
  is never empty."
- View-interactions is a labelled `aria-pressed` control inside the panel; the
  bottom-centre floating pill and its module are gone. The "Source on GitHub" link lives
  in the panel too.
- Under `PILL_BELOW_PX` (680px) the panel collapses to a pill instead of hiding, and the
  heading button is that pill, so a phone in the full scene keeps every gesture.
  `#pond[data-scene='card']` still hides the whole panel: a card is an invitation to
  expand and carries no chrome, which is what an
  [expand choreography](phase-5-integration/01-expand-choreography.md) swap lands in.

## The overlay grammar

One ink at varying alpha (`OVERLAY_INK`, white). No code path produces a coloured stroke;
escapes and depth passes read from path curvature and caret speed. A held koi reports no
intent and draws no cone and no caret.

- **Anchor**: `headCentre(outline)` pulls back from the reported nose by
  `HEAD_CENTRE_ALONG` (0.12) of the reported body length, so the cone stays inside the
  silhouette through hard turns. The caret orbits the same centre.
- **Cone**: half-angle `CONE_HALF_RAD` 0.5 rad (presentational; the brain's perception is
  a time horizon), radius the koi's own reported `intent.reachPx`, filled as 32 wedges
  cut by even steps of ink over a radial fade, so it runs out of ink at the lateral edges
  and at the horizon rather than ending on a line.
- **Pearls**: drawn from the outline's own `path` (the host predicts nothing), spaced
  `PEARL_SPACING_BODIES` 0.1 of the reporting koi's length, at most `PEARL_MAX` 10
  alight, 5 to 6px across, alpha ramping `PEARL_NOSE_ALPHA` 0.8 to `PEARL_HORIZON_ALPHA`
  0.1 by distance from the nose. A pearl never moves once placed: `advanceTrace` consumes
  what the nose has passed, keeps what the fresh path still runs through, cuts from the
  first pearl more than `PEARL_TOLERANCE_PX` (4px) off the fresh path along with
  everything beyond it, mints from the last survivor, and leaves pearls past a drawn-in
  horizon alone. An outline without a path draws no trace and no error.
- **Caret**: a double chevron riding `CARET_ORBIT_BODIES` 0.42 of the body out from the
  head centre, sliding at `CARET_SLIDE_RAD_S` 2 rad/s toward the committed heading (the
  intent's target, else the path's far end, else the reported heading), which outruns any
  helm the brain has, so it arrives before the body does. A koi first seen already
  committed starts on its decision instead of sliding in from an angle nothing chose.
- The painter keeps one chain and one caret angle per instance, drops both when that koi
  leaves the pond, and clears both when the overlay is switched off.

## The vitals overlay

- One probe row per living koi, keyed and labelled by instance: `data-instance` carries
  the id and the row reads the framework's name with the ordinal its id spells, so a row
  and the log lines about that koi need no arithmetic between them. Rows arrive and leave
  with the layers the scene holds.
- The boot record states the device beside the screen facts:
  `cores=… memory=…GB|unreported tier=… cap=…`. The memory signal is recorded because
  `tier=middle` alone cannot tell a middling device from one that withheld it.
- Roster churn and refusals are log lines through the existing `onDiagnostic` seam:
  `added` and `removed` name the instance and the roster size the change left
  (`4 of 4 koi`), and `shoal:refused` names the tier (`low-tier device seats 4`) or the
  never-empty rule. Everything survives the persist round-trip into the localStorage
  keepsake.
- Probe semantics are unchanged: classification pierces shadow roots, never calls
  `getContext`, and a cross-origin koi classifies as inaccessible rather than dead.

## What the gate verified, and what remains

- The pond gate is green: `nx run-many -t test build lint typecheck -p demo-koi-pond`,
  364 unit tests.
- Browser (composed build under SwiftShader): the vitals surface was walked directly.
  Rows render unclipped at their labels, the boot line carries the tier and cap, and
  driven churn wrote `added`, `shoal:refused` with the tier named, and `removed` into the
  persisted log.
- Left to [device acceptance](phase-5-integration/05-device-acceptance.md) items 3, 4,
  and 7, where they belong: the panel and its pill under a real thumb, cone attachment
  through hard turns on a moving shoal, pearls consumed rather than sliding, the caret
  leading turns, and `?vitals=1` in both the card and the expanded instance.
- The guide extraction markers in `pond.ts` (`survive-close`, `retry-open`,
  `relay-fanout`) survived the panel rewrite;
  [02-guides-verification](phase-5-integration/02-guides-verification.md) re-runs the
  extraction against them.
- No new SDK friction surfaced in this phase; [04-findings](phase-5-integration/04-findings.md)
  inherits nothing from it.
