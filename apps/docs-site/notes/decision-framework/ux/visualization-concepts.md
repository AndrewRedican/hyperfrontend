# Visualization Concepts

Status: DERIVED v1 (2026-08-29). Deliverables 10 (candidate visual models) and 18
(visualization concepts, one or more spatial/3D) per MASTER.md section 16, Phase 10.
Requirements served: REQ-UI-01 (representations must improve understanding, never
decorate), REQ-UI-02 (flagship interactive quality; answering visibly changes the feasible
space; canonical data stays renderer-independent), REQ-UI-03 (dependency policy with
explicit evaluation), REQ-UI-04 (eight aspects per concept, at least one ambitious
spatial/3D), REQ-AUD-01 (architect and non-specialist audiences), REQ-DATA-01 (the dataset
is the product, the page is one interface).

Research snapshot: August 2026. Feasibility claims are grounded in the docs-site
dependency inventory read from committed package.json files on 2026-08-28 and are not
repeated here.

Inputs, linked and not restated (REQ-OPS-03): the report model, statuses, storage, exports,
and lead rules in [report-design.md](report-design.md); the twelve latent dimensions in
[../model/taxonomy.md](../model/taxonomy.md) section 2; families and their consequence
fields in [../model/families.md](../model/families.md); the ranked question set and gain
numbers in [../model/questions.md](../model/questions.md) section 2; edge types and
progressive disclosure in [../model/question-graph.md](../model/question-graph.md);
constraint bindings and elimination verification in
[../model/constraints.md](../model/constraints.md); evaluation steps and outputs in
[../model/decision-engine.md](../model/decision-engine.md); the canonical collection layout
in [../model/schema-proposal.md](../model/schema-proposal.md) 7.1; gap records and
relaxation offers in [../positioning/market-gaps.md](../positioning/market-gaps.md).

Nothing here is an implementation plan. Section 5 records what already exists so these
concepts read as the roadmap beyond it rather than a proposal to rebuild it.

---

## 1. Selection method (`viz.method.*`)

### 1.1 Admission criteria

A concept is admitted only if it passes all five (REQ-UI-01, REQ-UI-02):

1. **Teaches a relationship the prose cannot.** If a paragraph does the job, the paragraph
   wins.
2. **Consumes canonical data only.** No reasoning, no thresholds, and no elimination logic
   inside a renderer (REQ-DATA-01). Every view is a projection of the same JSON that the
   CLI, the report engine, and an LLM read.
3. **Reacts to answers.** Answering a question must visibly change the feasible space:
   collapse, recede, disconnect, fade, or reveal a dimension. A static picture of the
   landscape is documentation, not this deliverable.
4. **Has a non-visual equivalent that is not a downgrade.** The same information must be
   available as text, table, or list to a screen-reader user and to anyone who turns the
   visual off.
5. **Degrades to something useful on a phone.** Sophistication on a large screen may never
   make the assessment inaccessible on a small one (REQ-UI-03).

### 1.2 Candidate slate and disposition

| Candidate (REQ-UI-01 list) | Disposition |
|---|---|
| Guided decision journey | Selected: `viz.concept.guided-journey` |
| Constraint-driven solution-space map that collapses as answers arrive | Selected: `viz.concept.collapsing-space` |
| Capability matrix explorer for architects | Selected: `viz.concept.matrix-explorer` |
| Dimensional landscape over the twelve latent dimensions | Selected: `viz.concept.dimension-landscape` |
| Spatial 3D constellation of families | Selected: `viz.concept.constellation` (the ambitious spatial concept) |
| Set-intersection view of constraint combinations | Folded into `viz.concept.collapsing-space` as its set mode. A standalone Venn over 16 questions is unreadable past three sets, and the interesting content (which combinations are jointly unsatisfiable) is already a first-class object: the exclusion relations and gap records |
| Topology map linking organizational shape to architecture | Folded into `viz.concept.guided-journey` at the `question.topology.confirm` node, where the model already infers a topology and asks for confirmation. A separate map would invite users to self-select a topology, which topology.md explicitly refuses to do |
| Interactive decision graph | Folded into `viz.concept.guided-journey` as its trace view. The graph's value to a user is "why am I being asked this and what did my answer do", which is the derivation block, not a node-link diagram of all 16 questions |
| Heatmaps | Folded into `viz.concept.matrix-explorer` as a density colouring of the same grid |

Rejections are recorded rather than deleted so a later reviewer can reopen them
(REQ-ORCH-09).

---

## 2. The five concepts

Each concept states the eight REQ-UI-04 aspects under stable ids.

### 2.1 `viz.concept.guided-journey` : progressive constraint interview

- **`viz.concept.guided-journey.learn`**: what their own circumstances imply. The user
  learns that a handful of structural facts (who deploys, whether one screen mixes owners,
  what may be modified, whether anyone is distrusted) decide most of the answer, and that
  each answer has a consequence they can inspect. Terminology is taught progressively rather
  than assumed (REQ-AUD-01), and the honest outcomes stay reachable: "you do not need
  microfrontends", "no current strong match", "viable only if this changes".
- **`viz.concept.guided-journey.interaction`**: one question at a time from the ranked set,
  with follow-ups appearing only when unlocked (`edge.unlocks`), vacuous questions
  disappearing (`edge.prunes`), and a warning shown at ask time when a hard answer would be
  jointly unsatisfiable with an earlier one (`edge.warns`). Two phrasings per question,
  architect and circumstance, toggled globally. Answers are reversible; the model recomputes
  on every change. A "why this question" affordance shows the dimension it exposes and what
  it can eliminate; a "what did my answers do" trace shows the derivation blocks.
- **`viz.concept.guided-journey.a11y`**: this is the accessible baseline for every other
  concept. Native form controls in a single-column flow, one fieldset per question, labels
  and descriptions associated properly, and live-region announcements for space changes
  ("three approaches eliminated"). Keyboard: standard tab and arrow semantics, no custom
  keymap needed. Screen reader: the entire assessment is readable and completable as text.
  Reduced motion: nothing animates except optional transitions, which are removed under
  `prefers-reduced-motion`.
- **`viz.concept.guided-journey.mobile`**: the primary mobile experience. Single column,
  large targets, the solution-space summary collapsing into a sticky count that expands on
  demand.
- **`viz.concept.guided-journey.render`**: React client island inside the static export;
  plain DOM. No canvas, no SVG beyond icons.
- **`viz.concept.guided-journey.deps`**: none beyond what the docs-site already ships.
- **`viz.concept.guided-journey.perf`**: trivial. The question set and family list are
  kilobytes; evaluation is a pass over answered questions. Assessment state persists to one
  versioned localStorage key with an in-memory fallback where storage is denied
  (report-design.md section 7; the site's existing consent store is the precedent).
- **`viz.concept.guided-journey.data`**: `questions.json`, `question-graph.json`,
  `constraints.json`, `derive-rules.json`, `families.json`, `engine-rules.json`, plus
  `meta.json` for the pinned versions stamped into every assessment
  (schema-proposal.md 7.1). The component performs no elimination of its own; it renders
  `EngineOutputs`.

### 2.2 `viz.concept.collapsing-space` : the solution space, watched as it closes

- **`viz.concept.collapsing-space.learn`**: that architecture selection is elimination, not
  scoring. The user sees all twelve families and their units present at the start, and
  watches regions leave as each answer binds a constraint, with the eliminating constraint
  attached to each departure. Two further lessons come free: which single answers are
  expensive (rank 2 alone removes five of twelve families; rank 3 makes an entire cluster of
  later questions vacuous), and that some pairs of requirements empty the space, which is
  where a gap record appears instead of a recommendation.
- **`viz.concept.collapsing-space.interaction`**: a spatial arrangement of the twelve
  families as regions, sized by the number of units they contain and positioned by their
  two most separating dimensions (integration time against runtime realm by default,
  swappable). Answering dims a region, moves it out of the live field, and leaves a labelled
  trace edge to the constraint that removed it. Hovering or focusing a departed region says
  what would bring it back, taken from the relaxation ledger. A set mode overlays the
  constraint combination currently bound and highlights the intersection; when the
  intersection is empty the gap record is rendered in place rather than an empty state.
  Rewinding an answer restores the region along the same path.
- **`viz.concept.collapsing-space.a11y`**: the visual is a mirror of an ordered list that is
  always present and always primary: surviving families, then eliminated families each with
  its eliminating constraint and its reopening relaxation. The canvas or SVG layer is
  `aria-hidden` and every interactive element exists in the list, so keyboard and screen
  reader users get the causal content without the picture. Departures are announced through
  a polite live region. Under `prefers-reduced-motion` regions change state instantly with
  no travel, and the trace edges are drawn statically.
- **`viz.concept.collapsing-space.mobile`**: the sidebar list form is the mobile default
  (this already exists in the shipped implementation). The spatial field appears at wide
  breakpoints or on explicit request, never as the only way to see what survived.
- **`viz.concept.collapsing-space.render`**: hand-rolled SVG for up to a few dozen regions,
  or canvas 2D if the unit-level view (30 points) is animated. The tesseract background
  component is the workspace precedent for projection and animation on raw canvas with no
  library.
- **`viz.concept.collapsing-space.deps`**: none. Layout is a small fixed set of positions
  derived from dimension poles, not a force simulation, which is precisely the case where
  d3 would not earn its bundle.
- **`viz.concept.collapsing-space.perf`**: twelve regions and thirty units are trivial for
  either renderer. Animation uses the repo-mandated built-in-copy timers and Math, and stops
  entirely when the field is off-screen or motion is reduced.
- **`viz.concept.collapsing-space.data`**: `families.json`, `matrix.json` or the 21 KB
  compact grid for unit membership, `constraints.json` for the elimination labels,
  `relations.json` for the jointly-unsatisfiable overlays, `relaxation.json` for the
  reopening text, `gaps.json` for the empty-intersection case. Positions come from
  `dimensions.json` poles, so re-cutting a dimension moves the picture without a code change.

### 2.3 `viz.concept.matrix-explorer` : the evidence grid for architects

- **`viz.concept.matrix-explorer.learn`**: what the framework actually believes and why.
  An architect can go straight to the 220 by 30 grid, read a cell, see its condition, its
  claim type (browser guarantee, framework guarantee, officially supported, common pattern,
  inference), its confidence, its evidence references, and its verification date. This is
  the surface that lets an expert argue with an individual assumption instead of dismissing
  the whole thing (REQ-FRAME-02), and it is the fastest way to discover that a "yes" and a
  "conditional" are not the same claim.
- **`viz.concept.matrix-explorer.interaction`**: a virtualized grid with attribute groups
  collapsible down the side and units across the top. Filters: by attribute group, by value,
  by claim type, by confidence, and by "differs from my current survivors". Column pinning
  for head-to-head comparison of two or three units. Clicking a cell opens the condition and
  evidence. A density colouring mode shows where the landscape agrees (the near-uniform
  guard rows) and where it splits. Answers from the journey project onto the grid as a
  survivor filter, so an architect can start from the interview or from the evidence and
  meet in the middle.
- **`viz.concept.matrix-explorer.a11y`**: a real table with real headers, row and column
  scope, and a caption stating the snapshot date; virtualization preserves header
  association and announces the visible range. Keyboard: full grid navigation with arrow
  keys, Home and End for row and column extremes, and Enter to open a cell's evidence in a
  dialog with managed focus and Escape to return. Colour never carries meaning alone: every
  cell shows its letter value as text, and the density mode is an overlay on top of the
  letters. Reduced motion removes scroll animation only.
- **`viz.concept.matrix-explorer.mobile`**: a grid of this size is not usable on a phone, so
  mobile gets the unit-centric form instead: pick a unit, read its column as a grouped list,
  and compare against at most one other unit at a time. The same data, a different
  projection, no loss of evidence.
- **`viz.concept.matrix-explorer.render`**: React with windowed rendering; plain DOM table
  semantics preserved. No canvas, because the accessible table is the point.
- **`viz.concept.matrix-explorer.deps`**: none required. Windowing is a scroll calculation
  over a fixed row height, not a library-scale problem at 220 rows.
- **`viz.concept.matrix-explorer.perf`**: the compact grid is 21 KB and is fetched once on
  first use, following the site's static-JSON search-index pattern. Per-cell evidence lives
  in the per-unit column files, which total 1.7 MB across 30 files and average under 60 KB
  each, so they are fetched per unit on demand and never bundled. Rendering is bounded by
  the visible window rather than by 6600 verdicts.
- **`viz.concept.matrix-explorer.data`**: `attributes.json` for definitions and groups,
  `columns/<unit>.json` for values with conditions, claim types, confidence, and evidence,
  `matrix.json` or the compact projection for the grid itself, `implementations.json` and
  `aliases.json` for unit identity and brand resolution, `staleness.json` and `meta.json`
  for the review dates shown beside every claim.

### 2.4 `viz.concept.dimension-landscape` : the twelve dimensions as axes

- **`viz.concept.dimension-landscape.learn`**: why the landscape has the shape it has.
  Parallel coordinates over the twelve latent dimensions show that units are not scattered:
  they run in bundles, and the bundles are the families. The user learns which dimensions
  actually separate the field (runtime realm, integration time, adaptation floor), which are
  consequences rather than choices (the user experience and performance surfaces resolved
  into other dimensions and are shown as derived, not as axes), and where their own
  requirements sit on each axis. A per-unit radar view answers the second question an
  architect asks: what shape is this one thing.
- **`viz.concept.dimension-landscape.interaction`**: each dimension is an axis with its
  ordered poles; each unit is a polyline. Brushing a range on an axis is exactly binding a
  constraint, so the brush and the interview are two spellings of the same act, and brushing
  updates the same survivor set. Axis reordering shows which adjacencies make the bundles
  visible. Selecting a polyline pins one unit and shows its radar beside the field. Hovering
  an axis label explains the dimension and names the attributes that load on it, so the axis
  itself is falsifiable rather than asserted.
- **`viz.concept.dimension-landscape.a11y`**: the accessible primary is a table of units by
  dimension poles, sortable and filterable by the same brushes, with each brush expressed as
  a named constraint binding in text. Axis brushing is keyboard-operable through paired
  min and max controls per axis rather than only by pointer drag. Polylines carry accessible
  names and are reachable in tab order in the pinned-selection mode. Reduced motion removes
  polyline transitions; brush results apply instantly.
- **`viz.concept.dimension-landscape.mobile`**: twelve axes do not fit a phone. Mobile shows
  three axes at a time with a chooser, or the per-unit radar, which is legible small. The
  brush-as-constraint text list remains the full-fidelity fallback.
- **`viz.concept.dimension-landscape.render`**: hand-rolled SVG. Thirty polylines across
  twelve axes is a small drawing; the scales are ordinal poles, not continuous data, so the
  usual reason to reach for a charting library does not apply.
- **`viz.concept.dimension-landscape.deps`**: none. This is the concept where the d3
  question is most tempting and least justified: ordinal axes and thirty polylines need
  arithmetic, not a scale library. If a later variant needs zoom and pan machinery or a
  force layout, that is the moment to re-evaluate, not before.
- **`viz.concept.dimension-landscape.perf`**: 30 by 12 is nothing. The cost is legibility,
  not computation, which is why axis reordering and pinning matter more than rendering
  speed.
- **`viz.concept.dimension-landscape.data`**: `dimensions.json` for axes and pole order,
  `scales.json` for ordered scales such as the migration levels, `matrix.json` for unit
  positions, `families.json` for bundle colouring and naming, `constraints.json` to turn a
  brush into a named binding.

### 2.5 `viz.concept.constellation` : the spatial concept, a navigable field of families

- **`viz.concept.constellation.learn`**: the shape of the trade space as a place rather than
  a table. Three of the twelve dimensions become the three spatial axes, chosen by the user
  from a short list of meaningful triples (for example runtime realm by integration time by
  adaptation floor). Units are points; families are the clusters those points form, which
  makes the honest clustering visible: the user sees that some branded products sit almost
  on top of each other, and that the distances that look large in marketing are small here.
  Moving the camera teaches which separations survive from every angle and which are
  artefacts of one projection. As answers arrive, eliminated regions recede and dim, and the
  remaining field re-centres, so the user physically watches their constraints carve out a
  neighbourhood. This is the one concept where spatial navigation genuinely adds a mental
  model rather than decoration: the relationships being shown are three-way, and three-way
  structure is what a flat view cannot hold.
- **`viz.concept.constellation.interaction`**: orbit, zoom, and axis reassignment. Selecting
  a point opens the unit's card with its family, its distinguishing cells, and links into
  the matrix explorer. Eliminated points fall out of the field with their eliminating
  constraint labelled on the way out; a rewind restores them. A guided tour mode flies
  between named viewpoints ("here is where trust separates the field"; "here is where
  adaptation cost does") for readers who do not want to drive. Axis triples are constrained
  to combinations the taxonomy considers non-redundant, so the view cannot be configured
  into nonsense.
- **`viz.concept.constellation.a11y`**: treated as an enhancement over a complete text
  experience, never as the only route. The scene is `aria-hidden`; beside it sits a
  structured list of families with their member units and the same three coordinates stated
  as pole names, which is the accessible truth of the picture. Keyboard: camera controls are
  operable from the keyboard, and unit selection happens through the adjacent list rather
  than by pointing into a canvas. Under `prefers-reduced-motion` the camera stops animating
  entirely: viewpoint changes cut rather than fly, and idle drift is disabled. No content
  exists only in the scene.
- **`viz.concept.constellation.mobile`**: not the default on a phone. Mobile gets the family
  list with the same coordinates, and an opt-in low-density scene (families as clusters
  only, no per-unit points, no idle animation) for devices that can carry it. Device
  capability and reduced-motion are both checked before the scene mounts, and the fallback
  is a first-class view rather than an apology.
- **`viz.concept.constellation.render`**: two credible routes, both already proven in this
  workspace. Route A is hand-rolled canvas 2D with projection maths, which is exactly what
  the site's existing animated four-dimensional tesseract background does today; thirty
  points, twelve labelled hulls, and an orbiting camera are well inside that technique, and
  it ships zero new dependencies. Route B is real WebGL for lit geometry, depth cues, and
  smooth instancing. CSS 3D transforms are a third partial route for a staged card variant,
  proven by the demos cover flow.
- **`viz.concept.constellation.deps`**: this is the only concept in the set that can
  justify a new dependency, and only under Route B. See section 3 for the verdict; the
  recommendation is Route A.
- **`viz.concept.constellation.perf`**: 30 points and 12 hulls is a small scene under either
  route; the real costs are the animation loop on low-end devices and, under Route B, the
  bundle. Mitigations: mount on explicit request rather than on page load, stop the loop
  when off-screen or when motion is reduced, cap the device pixel ratio, and use the
  repo-mandated built-in-copy Math and timers in the loop.
- **`viz.concept.constellation.data`**: `dimensions.json` for the axis triples and pole
  ordering, `matrix.json` for positions, `families.json` for cluster membership and naming,
  `implementations.json` for the unit cards, `constraints.json` and `engine-rules.json` for
  which points are currently eliminated and why. The scene holds no knowledge of its own: it
  is a projection of the same collections the report engine reads.

---

## 3. Dependency-policy verdict (`viz.policy.*`)

Grounded in the docs-site dependency inventory (2026-08-28).
REQ-UI-03 requires an explicit evaluation, not a preference.

### 3.1 What is achievable with existing workspace capabilities (`viz.policy.in-hand`)

Everything in concepts 1 through 4, and Route A of concept 5. The docs-site already ships
React 19 client islands inside a static export, Tailwind, a client-rendered diagram library,
a static-JSON fetch-on-first-use pattern, a localStorage store with a storage-denied
fallback, hand-rolled canvas 2D with projection maths in production, CSS 3D transforms in
production, and hand-rolled interactive widgets with keyboard handling. Hand-rolled SVG
charts (bars, radars, parallel coordinates, weighted grids) are in reach with no new
dependency.

### 3.2 What would genuinely require a new dependency (`viz.policy.new-dep`)

- **three.js**: only for true WebGL, meaning lit meshes, real materials, camera controls out
  of the box, and instancing at thousands of objects. Concept 5 Route B is the only concept
  that asks for that, and it asks for it as polish rather than as capability: the
  relationships it shows are fully expressible with 30 projected points on a canvas. The
  workspace's only three.js lives inside a frozen demo that may not be extended, so this
  would be a genuinely new docs-site dependency and the first one the policy has to
  adjudicate.
- **d3**: justified only by layouts the arithmetic does not cover, such as force-directed
  graphs, chord or sankey diagrams, or heavy axis, zoom, and brush machinery. None of the
  five concepts needs one: the layouts here are ordinal poles and fixed positions, and the
  matrix explorer is deliberately a table rather than a chart.

### 3.3 Recommendation (`viz.policy.verdict`)

Ship concepts 1 through 4 and concept 5 Route A with no new dependency. If a real WebGL
scene is later judged to add enough for concept 5 to be worth a dependency decision, prefer
the second route the capabilities inventory identifies: build it as a separately hosted
mini-application and embed it through the shell and iframe machinery the site already uses
for the demo gallery, which keeps the docs bundle clean, gives the scene its own failure
boundary and fallback card, and dogfoods the product being documented. Adding `three` to the
docs-site directly stays available as a deliberate, separately argued decision, with a
dynamically imported island and a static fallback render as its minimum conditions.

Standing conditions on any visual, dependency or not: it must not be the only route to any
information; it must respect `prefers-reduced-motion`; it must not be the mobile default
unless it is legible small; animation code must use the repo's built-in-copy Math and timers;
and any new persisted key must be added to the site's privacy inventory alongside the
existing three.

---

## 4. Recommended combination and order (`viz.plan.*`)

### 4.1 The rule that governs the whole plan (`viz.rule.no-spectacle-dependency`)

The useful assessment must survive without any visual spectacle. Concretely: with every
concept from 2.2 to 2.5 removed, a user must still be able to answer questions, see what
their answers eliminated and why, reach any of the seven outcomes including
`outcome.no-strong-match` and `outcome.no-mfe-needed`, read the counterfactuals and the
relaxation path, and export the report as printable HTML, Markdown, or JSON. Every
visualization is therefore progressive enhancement over the same JSON and the same engine
output, and the acceptance test for each is that turning it off costs presentation and
never information.

### 4.2 Ordering

| Wave | Ships | Why here |
|---|---|---|
| 1 | `viz.concept.guided-journey` plus the deterministic report and its exports | It is the whole product for most readers; everything else is a lens on its output. Already partly shipped (section 5) |
| 2 | `viz.concept.collapsing-space` beside the journey | Highest teaching value per unit of effort: it turns the interview from a form into a visible argument. The shipped sidebar list is already its degenerate one-dimensional form, so this is an upgrade path rather than a new surface |
| 3 | `viz.concept.matrix-explorer` | Serves the second audience directly (REQ-AUD-01) and is the credibility surface: it is what an architect opens when they want to disagree. Depends on nothing but the published dataset |
| 4 | `viz.concept.dimension-landscape` | Best once the dimensions are stable and the audience already understands the families; brushing is only meaningful to someone who has seen the constraints work |
| 5 | `viz.concept.constellation` (Route A) | Last, and optional. It is the exploratory and flagship surface, and it is the only one whose absence costs nothing informational |

### 4.3 Combination notes

- Waves 2, 4, and 5 are three projections of one selection state. They should share a single
  survivor model so that brushing an axis, answering a question, and watching a region fall
  out are the same event seen three ways. If they ever disagree, the projection is wrong,
  not the engine.
- Wave 3 is the evidence direction and must stay reachable without answering anything: an
  architect arriving cold goes straight to the grid (REQ-AUD-01), and the journey's answers
  are an optional filter on it.
- The first-principles framing appears exactly at its five sanctioned placements from
  report-design.md section 11 and nowhere else; no visualization repeats the promotion.
- Instrumentation, if any, follows the site's consent-gated analytics pattern and may never
  carry answer content or the local label (report-design.md section 7).

---

## 5. Relationship to the shipped first implementation (`viz.baseline.*`)

A first interactive implementation now exists in the docs-site at
`apps/docs-site/src/app/docs/choose-an-approach` (route page plus the
`src/components/decision-explorer.tsx` island, reading a canonical dataset module). It is
wave 1 with the beginnings of wave 2: a progressively disclosed question set with dual
architect and circumstance phrasings, per-answer consequence and hard-versus-preference
labelling, a live solution-space list beside the questions that strikes through eliminated
families and highlights favoured ones, the three honest outcome states (open,
no-microfrontends-needed, no-match), a deterministic Markdown report with an
answers-and-what-they-decided section, an eliminated-by-which-answer section, and a
what-would-change-this section, plus local persistence with an explicit clear action and a
storage-denied fallback.

These five concepts are therefore the roadmap beyond that page, not a proposal to replace
it:

- `viz.baseline.gap.collapse`: the existing sidebar is the list form of
  `viz.concept.collapsing-space`; the spatial field, the constraint labels on departure, and
  the reopening hints from the relaxation ledger are the upgrade.
- `viz.baseline.gap.evidence`: there is no matrix explorer yet, so the evidence layer that
  makes the assessment arguable is entirely ahead.
- `viz.baseline.gap.dimensions`: the twelve dimensions are not yet visible to a reader in
  any form.
- `viz.baseline.gap.spatial`: no spatial concept exists yet, which is consistent with its
  place last in the ordering.
- `viz.baseline.gap.exports`: the shipped report is Markdown to clipboard; printable HTML,
  print-to-PDF, JSON with the derivation graph, and the re-importable snapshot remain
  (report-design.md section 10).
- `viz.baseline.gap.trace`: the derivation blocks, versioned assessments with the
  newer-research notice, gap records, and the ordered relaxation path are modelled but not
  yet rendered.

Any future work on that page inherits the rule in 4.1: the assessment must remain complete
and exportable with every visual turned off.
