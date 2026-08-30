# Family Coordinates: Plotting the Solution Space

Status: DERIVED v1 (2026-08-29). Visualization input for the decision tool. Places the 12
architectural families of [families.md](families.md) on architecturally meaningful axes so
a plot carries evidence rather than decoration.

Inputs: [taxonomy.md](taxonomy.md) section 2 (the 12 latent dimensions, their poles, and
the attribute ids each dimension claims to explain), [families.md](families.md) sections 2,
3, 5 and 6 (the 12 families, their binding poles, and the mode-fork mapping),
[../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) (220 attributes x 30 units).

Every number below is computed from matrix cells by the rule stated in section 6, not
placed by eye. Two families sharing a coordinate share it because the evidence does not
separate them; those cases are listed in section 5 rather than nudged apart.

---

## 1. Axis selection

### 1.1 Admissibility: which dimensions may be an axis at all

A dimension can carry a spatial axis only if it passes all three tests.

**T1. It is a boundary-defining choice, not a consequence.** Taxonomy 3.2 dissolves the UX,
performance, and operational-complexity groups into surfaces derived from deeper choices.
Plotting a consequence would draw the same information twice and invite the reader to treat
a symptom as a decision.

**T2. Each family holds a single position on it.** If a family spans the scale, its
coordinate is a fiction. Measured as the within-family spread of the member units on the
first principal component of that dimension's own attribute block, against the
between-family spread (`ratio` below; higher is better).

**T3. It splits the family set.** Measured as the share of the 66 family pairs the
dimension separates by at least 12 points on a 0 to 100 scale.

| Dimension | Attributes explained | T3 split | T2 ratio | Admissible? |
|---|---|---|---|---|
| `dimension.integration-time` | 13 | 51/66 (77%) | 4.11 | yes |
| `dimension.assembly-locus` | 27 | 51/66 (77%) | 1.66 | yes |
| `dimension.adaptation-floor` | 19 | 49/66 (74%) | 0.72 | no (T2) |
| `dimension.roster-authority` | 9 | 49/66 (74%) | 0.52 | no (T2) |
| `dimension.dependency-economy` | 13 | 45/66 (68%) | 2.05 | yes |
| `dimension.orchestration-thickness` | 18 | 43/66 (65%) | 0.93 | no (T2) |
| `dimension.runtime-realm` | 29 | 34/66 (52%) | 1.06 | yes |
| `dimension.trust-ceiling` | 18 | 30/66 (45%) | 2.48 | yes, but see 1.2 |
| `dimension.composition-granularity` | 11 | 20/66 (30%) | 1.33 | yes, but binary |
| `dimension.release-actuation` | 7 | not computed | 0.54 | no (T2) |
| `dimension.contract-explicitness` | 8 | not computed | 0.31 | no (T2) |
| `dimension.delivery-governance` | 13 | not computed | 0.59 | no (T1, REQ-ENT-01) |

Rejections, stated plainly:

- **Orchestration thickness** fails T2 by construction. FC-5 and FC-3 in families.md ruled
  that thickness is not a boundary difference: `family.document-embedding` spans primitive
  frames to platform shells, and `family.lifecycle-orchestration` spans a loader library to
  a feed platform. A single point on this scale would be invented.
- **Adaptation floor, roster authority, release actuation, contract explicitness** are
  configuration choices made *inside* a family, so families occupy intervals. Contract
  explicitness is the worst offender (ratio 0.31): `family.document-embedding` alone spans
  bare postMessage conventions to the landscape's only fully gated contract.
- **Delivery governance** fails T1: taxonomy 2.12 and REQ-ENT-01 require it to select
  implementations and editions, never families. An axis built on it would let a vendor
  surface deform the architecture picture.
- **Composition granularity** passes T1 and T2 but has two values. As an axis it collapses
  24 of 66 pairs. It is better used as a marker distinction than a coordinate, and section 4
  covers what its absence costs the reader.
- **Trust ceiling** passes T1 and T2 but 9 of the 12 families sit at `trust.cooperative`, so
  it collapses 31 of 66 pairs. It is the landscape's sharpest eliminator
  (`security.untrusted-third-party-viable` is No for 27 of 30 units) and belongs in the
  engine as a hard filter, not as geometry. Section 5 says why encoding it spatially would
  actively mislead.

### 1.2 The pair

Split power alone would pick integration time and assembly locus, the two 77% dimensions.
They cannot be paired: their family positions correlate at |r| = 0.92, because a build-fused
architecture composes in the consumer's build almost by definition. The plot would be a
diagonal line carrying one fact.

The chosen pair is **integration time** and **runtime realm**.

- Integration time is the strongest family separator that survives all three tests (51/66,
  ratio 4.11, the best coherence of any dimension in the landscape) and it is the taxonomy's
  drift hinge (3.3): one answer about release trains positions a team and prices the
  contract machinery at the same time. It is also the axis on which the REQ-Q-04 question
  ("maybe you do not need microfrontends") is a position rather than a footnote.
- Runtime realm is the taxonomy's own single strongest factor: it explains 29 attributes,
  the largest block in the matrix, including the ~45-attribute mega-bundle that drives the
  isolation, contracts, UX, and performance groups. Its 52% split looks modest only because
  it honestly reports that 8 families share one realm; where it does separate, it separates
  the properties architects care most about.
- They are independent enough to spend plot area on: |r| = 0.66 across all 12 families, and
  |r| = 0.37 across the 7 microfrontend families. The residual correlation is a real
  structural fact (a single build implies a single realm), not axis redundancy.

### 1.3 Pole labels for a non-expert

**X axis, "when the parts are joined"** (`dimension.integration-time`):

| X | Label |
|---|---|
| 0 | Everything ships together: one build, one deploy, one release |
| ~55 | Each part ships on its own, and the page is assembled from whatever each team last published |
| 100 | Parts can join, leave, and change version while the page is still running |

**Y axis, "how separated the running parts are"** (`dimension.runtime-realm`):

| Y | Label |
|---|---|
| 0 | Everything runs in one shared runtime: one part's crash, stray style, or patched built-in reaches all of them |
| ~40 | Each part gets a simulated private runtime: honest accidents are absorbed, deliberate escapes are not |
| ~95 | Each part is its own browser document: the browser enforces the wall, and the parts talk by passing messages |

Y is about accidents, not adversaries. See section 5.

---

## 2. Coordinates

X = `dimension.integration-time`, Y = `dimension.runtime-realm`, both 0 to 100.

| Family id | X | Y | Evidence fixing X | Evidence fixing Y |
|---|---|---|---|---|
| `family.modular-monolith` | 0 | 0 | `buildtime.host-build-consumes-participants`=y, `composition.phase.deploy-unit-per-participant`=n, `deployment.host-rebuild-required`=y, `ownership.deploy-schedule-ownership`=n, `contracts.drift-surface`=n, `operations.deploy-time-contract-verification`=y | `runtime.shared-js-realm`=y, `runtime.primordials-blast-radius`=y, `isolation.document-boundary`=n, every `isolation.*` cell n |
| `family.spa-routing` | 0 | 0 | identical cells to modular monolith on all six decoupling attributes | identical: one document, one realm, `isolation.failure.post-mount-exception`=n |
| `family.server-templates` | 5 | 0 | as above except `operations.deploy-time-contract-verification`=c | override O1 (section 6): its `isolation.document-boundary`=y and `contracts.serialized-boundary`=y describe page-to-page navigation of one application, not a wall between participants (`runtime.concurrent-participants`=n) |
| `family.islands` | 5 | 13 | `buildtime.host-build-consumes-participants`=y, `contracts.drift-surface`=n, `deployment.host-rebuild-required`=y; override O2 for `runtime.late-participant-registration`=c | `isolation.failure.post-mount-exception`=c is the only non-zero cell: an island's hydration can fail without taking the page down, and nothing else is bounded |
| `family.package-composition` | 6 | 0 | monorepo and bit match modular monolith exactly; only commercetools-frontend carries `deployment.host-rebuild-required`=c and `contracts.drift-surface`=y, which is the whole of the family's displacement from 0 | `runtime.shared-js-realm`=y across all three members; package boundaries are build-time constructs |
| `family.route-partition` | 53 | 93 | `composition.phase.deploy-unit-per-participant`=yyy, `ownership.deploy-schedule-ownership`=yyy, `contracts.drift-surface`=yyy, `deployment.host-rebuild-required`=nnn; both runtime-live attributes are NA because there is no running document to change | `isolation.document-boundary`=yyy, `isolation.css.outbound`/`.inbound`=y, `isolation.lifecycle.reclaim`=yyy, `contracts.serialized-boundary`=y; participants never co-reside (`runtime.concurrent-participants`=nnn) |
| `family.custom-element-composition` | 62 | 12 | deploy-decoupled block unanimous except entando's `composition.phase.deploy-unit-per-participant`=c; `runtime.late-participant-registration`=y (a new tag can be defined at any time) but `runtime.loaded-version-hot-swap`=n (a tag name cannot be redefined: `runtime.global-registration-collision`) | `runtime.shared-js-realm`=yy, `runtime.primordials-blast-radius`=yy; the only separation is style scoping, `isolation.css.outbound`=y and `.inbound`=c for web-components-composition, both n for entando |
| `family.server-fragment-assembly` | 73 | 6 | deploy-decoupled block unanimous; each request re-resolves the composition, so `runtime.late-participant-registration`/`loaded-version-hot-swap` reach y or c on opencomponents and web-fragments while the classic members stay n. Band 55 to 89, see section 5 | `runtime.shared-js-realm`=y, `ux.natural-layout-flow`=y, all client-side `isolation.*` cells n once the fragments are delivered. Server-side process isolation is real but is an assembly-locus fact, carried by the depth channel |
| `family.module-graph-federation` | 78 | 0 | decoupling block 1.00 across all three members; `runtime.late-participant-registration`=y for module-federation (2.0 `registerRemotes`), c for import maps, `runtime.loaded-version-hot-swap`=n | zero separation of any kind: `isolation.failure.post-mount-exception`=nnn, `isolation.lifecycle.reclaim`=nnn, `runtime.primordials-blast-radius`=yyy. Identical to the monolith on this axis, and that is the finding |
| `family.lifecycle-orchestration` | 83 | 6 | decoupling block 1.00; `runtime.late-participant-registration`=yy (registration and feed publication are both live), `runtime.loaded-version-hot-swap`=c/n | `isolation.failure.lifecycle-quarantine` lifts it barely off zero: a failing app can be unmounted, but `runtime.shared-js-realm`=yy and in-realm damage still reaches everyone |
| `family.document-embedding` | 97 | 95 | decoupling block 0.94 (hyperfrontend's `deployment.host-rebuild-required`=c), both runtime-live attributes y across all members | override O3 (section 6): read at iframe mode, `isolation.document-boundary`=y, `isolation.css.outbound`/`.inbound`=y, `isolation.failure.post-mount-exception`=y, `isolation.lifecycle.reclaim`=y, `isolation.recovery.in-page`=y, `contracts.serialized-boundary`=y, `ux.natural-layout-flow`=n |
| `family.virtualized-rehosting` | 100 | 38 | the only family scoring 1.00 on both blocks: `runtime.late-participant-registration`=yyy and `runtime.loaded-version-hot-swap`=yyy | simulated, partial, and member-dependent: `isolation.js.virtualized-global`=y/c, `isolation.dom.virtualized`=ccc, `isolation.css.outbound`=cc/y, but `isolation.recovery.in-page`=cc/n and `security.isolation-escape-hatches` documented. Band 23 to 58, see section 5 |

Sanity reading of the plot: the five honest alternatives occupy the bottom-left corner, the
shared-realm microfrontend families form a low band on the right, virtualized rehosting sits
above them, and only document embedding and route partitioning reach the top. That is the
landscape the taxonomy describes, drawn rather than asserted.

---

## 3. The third channel: where composition happens

**Dimension**: `dimension.assembly-locus` (taxonomy 2.4). It explains 27 attributes, the
second largest block, splits 51 of 66 family pairs, and each family holds one pole
(ratio 1.66).

It is not an axis because its family positions correlate at |r| = 0.92 with integration
time. As a third channel that redundancy costs nothing, and it does the one job the two axes
cannot: it separates the families that assemble on a server from the families that assemble
in the browser. Three of the four microfrontend collisions on the 2-D plot are resolved by
it alone.

**Poles in plain language**: 0 = "put together in your build, before anything ships";
50 = "put together by a server on every request, before the browser sees the page";
100 = "put together by the browser while the page runs".

| Family id | Z | Evidence |
|---|---|---|
| `family.modular-monolith` | 0 | `locus.consumer-build`; `ssr.static-hosting-sufficient` and composition both resolved in one build |
| `family.package-composition` | 0 | `locus.consumer-build`; `buildtime.host-build-consumes-participants`=y |
| `family.spa-routing` | 0 | `locus.consumer-build`; `composition.exec.client-composed`=n (lazy chunks are one build's artifacts) |
| `family.server-templates` | 10 | `locus.consumer-build`, lifted only because each document is rendered on the request path (`ssr.composed-page`=y) from that one build |
| `family.islands` | 10 | `locus.consumer-build` with build-time prerender plus optional request-time island render (`ssr.static-prerender`, dual-mode cells) |
| `family.route-partition` | 45 | `locus.request-path` but routing only: `composition.kind.http-route-partition`=y while `contracts.http-request-contract`=n and `ssr.html-fragment-contract`=n. The tier forwards, it does not assemble markup |
| `family.server-fragment-assembly` | 55 | `locus.request-path` assembling markup: `contracts.http-request-contract`=y, `ssr.html-fragment-contract`=y, `ssr.streaming-assembly`, `performance.request-time-server-fanout`=y, `ssr.static-hosting-sufficient`=n |
| `family.custom-element-composition` | 100 | `locus.client-runtime`; `composition.exec.client-composed`=y. Entando's platform server is a delivery-governance fact, not an assembly locus |
| `family.module-graph-federation` | 100 | `locus.client-runtime`; `deployment.participants-static-artifacts`=y, `performance.pre-render-orchestration-fetch`=y |
| `family.lifecycle-orchestration` | 100 | `locus.client-runtime`; `performance.client-composition-runtime`=y |
| `family.virtualized-rehosting` | 100 | `locus.client-runtime`; the composer fetches each app's own HTML entry in the browser (`composition.kind.html-entry`) |
| `family.document-embedding` | 100 | `locus.client-runtime`; each participant is a separately served document that the browser, not a composer tier, places |

**What it should mean visually.** Depth, read as distance from the viewer, with the browser
end nearest. A family at Z=100 is composed in front of the user, in the device you cannot
control; a family at Z=0 is composed far behind, in a pipeline you own entirely. Encode it
as depth (a z-offset with perspective) rather than size: size reads as importance or
magnitude and this scale has neither. If the renderer is 2-D, use a shadow offset or a
three-step border treatment, and never a color ramp, which the eye will read as a fourth
quantity. Three steps only: the scale has three poles, and the within-pole refinements
(route partition at 45, server templates and islands at 10) are the only evidence-backed
sub-positions.

Operationally the channel answers one hard constraint: everything at Z=45 or above on the
server side (route partition, server fragment assembly) requires the organization to run
origins on the production request path (`deployment.strategy-service-in-path`,
`ownership.runtime-operational-ownership`), which is a mismatch for static-hosting shops
(`ssr.static-hosting-sufficient`=n).

---

## 4. Adjacency

Each family's nearest neighbours by Euclidean distance over (X, Y, Z), plus the
decision-relevant edges out of each cluster even where they are long, with the single
property that separates each pair. These drive the "if you relax X, you land here"
affordances. Distance is in coordinate units; it is not a migration cost (see section 5),
and a long edge is not a weak affordance: the two most useful moves in the landscape
(package composition to federation, virtualized rehosting to document embedding) are both
long.

| Family | Neighbour | Dist | The one property that differs | Relax-and-land-here reading |
|---|---|---|---|---|
| `family.modular-monolith` | `family.spa-routing` | 0 | Where the walls are: enforced source module rules vs lazy route chunks. No runtime or lifecycle attribute separates them | Neither buys independence; choosing between them is a codebase-shape question |
| `family.modular-monolith` | `family.package-composition` | 6 | Whether boundaries are reified as versioned packages (`buildtime.central-input-for-participant-build`) | Want per-team review and release rhythm without runtime change: move to packages |
| `family.package-composition` | `family.module-graph-federation` | 123 | Integration phase only: the same import graph resolved at load time instead of build time | The canonical first microfrontend step: relax "one build resolves everything" and you land here, paying `contracts.drift-surface`=y for `ownership.deploy-schedule-ownership`=y |
| `family.spa-routing` | `family.server-templates` | 11 | Rendering model: client SPA vs server-rendered MPA | Neither changes ownership; this is a stack choice |
| `family.islands` | `family.server-templates` | 13 | Per-region client hydration (`isolation.failure.post-mount-exception`=c) | Need interactive regions on a mostly static page without any MFE cost |
| `family.islands` | `family.server-fragment-assembly` | 82 | Fragment ownership: one build vs independently deployed services | Relax "one build owns every island" and islands become request-path fragment assembly |
| `family.route-partition` | `family.document-embedding` | 70 | Co-residence: participants appear serially vs together in one page (`runtime.concurrent-participants` n vs y) | Need two teams on one screen while keeping browser-enforced separation: this is the only move that keeps Y |
| `family.route-partition` | `family.server-fragment-assembly` | 90 | Composition granularity: whole navigation vs region of one page | Need two teams on one screen and already run server origins: assemble fragments instead of forwarding routes |
| `family.server-fragment-assembly` | `family.module-graph-federation` | 46 | The boundary contract: an HTTP endpoint returning HTML vs a JS module import | Relax "the server assembles it" and the browser assembles it, trading composed first paint (`ux.composed-first-paint`) for static hosting |
| `family.server-fragment-assembly` | `family.custom-element-composition` | 47 | Assembly locus alone: request path vs client runtime. Same integration phase, near-identical runtime separation | The plot-collision pair: distinguished only by depth |
| `family.custom-element-composition` | `family.module-graph-federation` | 20 | Dependency economy: each element carries its own copies (`performance.shared-dependency-dedup`=n) vs one negotiated copy per page (=y) | Payload budget bites at many co-displayed units: relax "no shared machinery" and you land in federation, buying `coordination.shared-dependency-governance` |
| `family.module-graph-federation` | `family.lifecycle-orchestration` | 8 | The seam: an imported module vs an exported mount/unmount contract (`composition.kind.lifecycle-contract`) | Not a trade so much as a stacking: federation loads, an orchestrator mounts. Cost of the move is the adaptation floor, level 3 to level 4 |
| `family.lifecycle-orchestration` | `family.virtualized-rehosting` | 36 | Adaptation demand: edit every participant's bootstrap vs consume its deployed HTML entry under a simulated realm | A participant nobody may modify eliminates lifecycle orchestration outright; relax the bootstrap edit and you land in rehosting, paying `performance.sandbox-execution-tax` |
| `family.virtualized-rehosting` | `family.document-embedding` | 57 | Who enforces the boundary: a framework simulating it vs the browser | Need the wall to hold against anything other than accidents: this is the only move, and it is the only one that raises the trust ceiling |
| `family.document-embedding` | `family.virtualized-rehosting` | 57 | As above, read in reverse | Need natural layout flow, one accessibility tree, and no per-unit document boot, and the participants are trusted: relax the browser boundary |

Two structural notes for the affordance engine:

- Every edge out of the baseline cluster crosses the X axis at once. There is no gradual
  path: `contracts.drift-surface` flips from n to y in a single step, and that flip creates
  the entire demand that `dimension.contract-explicitness` answers.
- The only edge that raises the trust ceiling is virtualized rehosting to document
  embedding, and even then only conditionally (cross-origin plus sandbox). Every other edge
  moves within `trust.cooperative`.

---

## 5. What the plot cannot show

State these next to the visualization; without them the geometry claims precision the
evidence does not support.

1. **Y is not security.** A high Y means accidents do not cross: styles, exceptions, leaked
   timers, patched built-ins. It does not mean the parts are safe from each other. A
   same-origin unsandboxed frame sits at Y=95 and still holds host-origin authority
   (`isolation.origin.host-authority`, `security.host-dom-reach`). Trust is a separate,
   gated dimension (taxonomy 2.2, 3.1): `trust.distinct-principal` requires cross-origin
   serving plus sandbox or CSP, and `security.untrusted-third-party-viable` is No for 27 of
   30 units. The engine must apply it as a filter; the plot must not imply it.
2. **The plot does not say whether two teams can appear on one screen.** Route partitioning
   reaches Y=93 by never letting participants co-reside at all
   (`runtime.concurrent-participants`=n), which is the opposite situation from document
   embedding at Y=95, where they co-reside behind browser walls. Composition granularity is
   off the plot; two families at the same height can be opposites on it.
3. **The plot does not show adoption cost.** `dimension.adaptation-floor` was rejected as an
   axis because families span it, but it is often the deciding constraint. Module-graph
   federation and lifecycle orchestration sit 8 units apart and demand level 3 and level 4
   respectively; document embedding and virtualized rehosting sit far from everything and
   demand level 1. Position implies nothing about how much you must change your apps.
4. **Distance is not migration distance.** Package composition to module-graph federation is
   123 units on the plot and one conceptual step (the same import graph, resolved later).
   Modular monolith to spa routing is 0 units and still a codebase rewrite for an existing
   separate application (level 6 extraction).
5. **The axes are ordered poles with refinement, not measurements.** A 20-point gap is not
   twice a 10-point gap. Only the ordering and the collisions are claims.
6. **Families are points; several real products are not.** Mode-forked units occupy
   different positions per configuration (taxonomy 3.5, families.md 6.3): luigi splits
   across document embedding and custom-element composition, web-fragments across server
   fragment assembly and virtualized rehosting, micro-app-jd across its proxy and iframe
   modes, and the same-origin versus cross-origin posture moves iframe composition and
   hyperfrontend within document embedding. A configuration is what gets a coordinate, never
   a brand.
7. **Family coordinates are centres of real bands.** The widest: virtualized rehosting spans
   Y = 23 to 58 across qiankun, micro-app-jd, and wujie, because sandbox strength genuinely
   differs; server fragment assembly spans X = 55 to 89, because opencomponents and
   web-fragments reach runtime-live behaviour the classic members do not; custom-element
   composition spans Y = 0 to 23 because shadow DOM is optional. Render these as bands or
   halos if the medium allows, not as tight dots.
8. **The layers have no coordinates.** zephyr-cloud and picard-js (families.md 6.1) attach
   to a family rather than occupying a position; plotting them as points would invent a
   family the landscape does not have.
9. **Off-plot dimensions still decide cases.** Roster authority, release actuation, contract
   explicitness, orchestration thickness, and delivery governance are all invisible here and
   each is decisive for some adopter. Two families at one point can have entirely different
   operational profiles.
10. **Unknowns are excluded, not zeroed.** `?` and NA cells are dropped pairwise, so a
    family with sparse evidence is positioned on less of it. Route partitioning's X rests on
    the decoupling block alone, since both runtime-live attributes are NA for every member.

---

## 6. Reproduction

Coding: y=1, n=0, c=0.5; `?` and NA excluded pairwise. Family value = mean over member
units listed in families.md section 2, mode-corrected per families.md 6.3.

X = round(55 x D + 45 x L), where

- D = mean over `composition.phase.deploy-unit-per-participant`,
  `ownership.deploy-schedule-ownership`, `contracts.drift-surface`, and the complements of
  `buildtime.host-build-consumes-participants`, `deployment.host-rebuild-required`,
  `operations.deploy-time-contract-verification`.
- L = mean over `runtime.late-participant-registration`, `runtime.loaded-version-hot-swap`.

Y = round(100 x S), where S = mean over the complements of `runtime.shared-js-realm`,
`runtime.primordials-blast-radius`, `contracts.sync-calls`, `ux.natural-layout-flow`, and
the direct values of `isolation.document-boundary`, `isolation.js.virtualized-global`,
`isolation.dom.virtualized`, `isolation.css.outbound`, `isolation.css.inbound`,
`isolation.failure.post-mount-exception`, `isolation.lifecycle.reclaim`,
`isolation.recovery.in-page`, `contracts.serialized-boundary`.

Z is the `dimension.assembly-locus` pole (0, 50, 100) with the two within-pole refinements
evidenced in section 3.

Documented overrides, each an instance of the taxonomy 3.4 pattern (one attribute, two
upstream causes):

- **O1** `server-rendered-templates`: `isolation.document-boundary`=y,
  `isolation.lifecycle.reclaim`=y, `contracts.serialized-boundary`=y are scored 0 for Y.
  They describe navigation between pages of one application, not a boundary between
  participants; the family's participants are template partials in one codebase and
  `runtime.concurrent-participants`=n. Without the override the family plots at Y=100, above
  every iframe strategy.
- **O2** `islands-architecture`: `runtime.late-participant-registration`=c is scored 0 for
  X. It describes deferred hydration of islands from one build, not admission of an
  independently shipped participant (`contracts.drift-surface`=n,
  `buildtime.host-build-consumes-participants`=y).
- **O3** `luigi` is read at its iframe-mode values for the Y of `family.document-embedding`.
  Its stored cells (`isolation.document-boundary`=c, `runtime.shared-js-realm`=c,
  `contracts.serialized-boundary`=c) average two modes that families.md 6.3 maps to two
  different families.
- **O4** `web-fragments` is excluded from the Y of `family.server-fragment-assembly`. Its
  virtualized-realm cells belong to its client reframing mode, which maps to
  `family.virtualized-rehosting`; in its pierced-gateway mode the delivered page is one
  shared document. It is retained for X, where both modes agree.

---

## 7. Collisions

Pairs whose X and Y both fall within 12 points, which is the smallest gap the plot can be
asked to render as a real difference.

| Pair | dX | dY | dZ | Status |
|---|---|---|---|---|
| `family.server-fragment-assembly` ~ `family.custom-element-composition` | 11 | 6 | 45 | resolved by depth |
| `family.server-fragment-assembly` ~ `family.module-graph-federation` | 5 | 6 | 45 | resolved by depth |
| `family.server-fragment-assembly` ~ `family.lifecycle-orchestration` | 10 | 0 | 45 | resolved by depth |
| `family.module-graph-federation` ~ `family.lifecycle-orchestration` | 5 | 6 | 0 | unresolved |
| `family.modular-monolith` ~ `family.spa-routing` | 0 | 0 | 0 | unresolved |
| `family.modular-monolith` ~ `family.package-composition` | 6 | 0 | 0 | unresolved |
| `family.modular-monolith` ~ `family.server-templates` | 5 | 0 | 10 | unresolved |
| `family.package-composition` ~ `family.spa-routing` | 6 | 0 | 0 | unresolved |
| `family.package-composition` ~ `family.server-templates` | 1 | 0 | 10 | unresolved |
| `family.spa-routing` ~ `family.server-templates` | 5 | 0 | 10 | unresolved |

Both unresolved groups are findings, not defects.

**Module-graph federation and lifecycle orchestration are genuinely one point.** Same
integration phase, same shared realm, same client assembly, same dependency economy, same
trust ceiling. They differ only in the seam (a module import versus an exported mount and
unmount contract) and in the adaptation floor that follows from it (level 3 versus level 4).
families.md 3.4 and 3.5 record that they are frequently stacked in practice: federation
loads, an orchestrator mounts. The tool should render them as one labelled cluster the
reader can open, not as two dots pushed apart.

**The five honest alternatives are one region.** Modular monolith, package composition, spa
routing, and server templates are mutually indistinguishable on all three encodings, and
islands separates only on Y (13, from `isolation.failure.post-mount-exception`=c). This is
exactly what families.md section 5 asserts in prose: they form one group because they share
every position that dissolves the microfrontend question load. The plot should draw one
region labelled with the group's shared consequence (drift structurally impossible, no
per-team deploy schedule) and let the reader choose inside it on grounds the architecture
axes do not measure.
