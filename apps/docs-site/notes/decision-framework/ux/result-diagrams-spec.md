# Result Diagrams: Implementable Specification

Status: SPEC v1 (2026-08-29). Replaces the scatter plot in
`apps/docs-site/src/components/decision/solution-space-map.tsx` and adds a second diagram
beside it. Synthesises one design exploration and six independent judging passes (three per
diagram).

Inputs: [../model/family-coordinates.md](../model/family-coordinates.md) (cited below as FC
with section numbers), [visualization-concepts.md](visualization-concepts.md) (REQ-DATA-01,
REQ-UI-01 to REQ-UI-04), `apps/docs-site/src/data/decision-framework.ts`,
`apps/docs-site/src/lib/decision-engine.ts`.

Two diagrams:

- **Diagram 1, The Banded Landscape.** What the twelve approaches are and where the reader's
  answers closed the space. Replaces the scatter in the "The solution space, after your
  answers" section of `result-view.tsx`.
- **Diagram 2, The Independence Seam.** What the reader's own delivery topology looks like,
  and the one place independence is won or lost. A new section below it.

---

## 0. The measurement that overrides every proposal's breakpoints

Every proposal specified its layout tiers in viewport pixels. The render surface is not the
viewport. From `apps/docs-site/src/app/docs/layout.tsx` and `components/sidebar.tsx`:

```
max-w-7xl                    1280
  minus lg:px-8               -64
  minus sidebar w-64         -256
  minus sidebar pr-8          -32
  minus collapse rail w-5     -20
  minus main lg:pl-8          -32
                             ----
main column, sidebar open     876 px   at any viewport >= 1376 px
main column, sidebar closed  1156 px   (collapse is a reader action, not a breakpoint)
```

Consequences that are binding on both diagrams:

1. **Tiers are container-relative, not viewport-relative.** Use a `@container` query on the
   figure wrapper (`container-type: inline-size`), or a `ResizeObserver`-free CSS fallback of
   viewport tiers offset by 404 px. Named tiers below are always container widths.
2. **No design may promise anything above 876 px unconditionally.** Any proposal step keyed
   to "1280 px and up" fires only when the reader has collapsed the sidebar. Treat 1156 px as
   an optional bonus tier, never as where the design works.
3. **Three columns of equal width in the main column are about 228 px each** after a row
   header and gutters. That is enough for a stacked block card and not enough for two things
   side by side. This single number settles the largest disagreement between the judges (see
   1.1).

---

# Diagram 1: The Banded Landscape

## 1.1 The chosen design, and why it beat the alternatives

**Chosen: a nine-cell banded grid.** Continuous position is abandoned. Column is an
integration-time band, row is a runtime-realm band, and each cell holds zero or more cards.
A card is a cluster the evidence does not separate, never a dot placed by eye. Seven cards
hold twelve families across five of nine cells.

Structurally this is the merge of two proposals that were the same artifact with different
execution: **Nine Cells** (which the legibility lens picked) and **Pole Grid** (which the
honesty lens picked). They agreed on the geometry and disagreed on discipline. The synthesis
takes Nine Cells' stacking and Pole Grid's verification rules, and then makes one change
neither proposed, for the reason in 1.1.3.

### 1.1.1 Why not the Joining Ladder (the reader-value lens's winner)

The reader-value lens ranked the one-axis Ladder first, on the strength of its 47-point gap
block being the model's single most decision-relevant claim (FC 4: every edge out of the
baseline cluster crosses X at once, `contracts.drift-surface` flips n to y in one step).
That claim is correct and is grafted in below as The Cliff.

The Ladder loses on two facts, not on taste:

- **It cannot do the job the section is titled for.** The section heading in
  `result-view.tsx:240` is "The solution space, after your answers". The Ladder's own
  proposal concedes "a ladder cannot show a 2-D emptiness", and the four empty combinations
  are the only thing here a list cannot carry. A diagram that cannot show the space is not a
  candidate for the space slot.
- **Its geometry is inverted against the container.** The main column is 876 px wide and the
  Ladder is roughly 900 to 1100 px tall at its emptiest, before the reader has answered
  anything. It asks for height, which the container does not have to spare, and declines the
  width, which the container does have. Its desktop overview strip then re-draws the original
  defect: twelve dots at true X on a 0 to 100 line, which its own sketch renders as
  `0|<5 overlapping dots>`, marked `aria-hidden`. That is the bottom-left pile-up shrunk and
  hidden rather than solved.

### 1.1.2 Why not the Cut Ledger

Its two best ideas are real and are grafted in as text (near-miss versus overdetermined, and
the tension inside the reader's own requirements). The grid they arrive in is not: column
headers are bare rank integers with gaps in the sequence, so nothing means anything until the
reader travels to a numbered legend and back, once per mark. It also overlaps the shipped
`EliminationCascade` almost entirely, and it is blank at zero answers, which is exactly when
the space section must be at its most useful.

Its position strip additionally manufactures a boundary the evidence forbids: equal-thirds
bands put a cut at 67, between custom-element composition (X 62) and request-path fragment
assembly (X 73), an 11-point gap that FC 7 lists as a collision. That is a fabricated
difference in the one channel whose stated purpose is to show where the model does not
separate.

### 1.1.3 The objection the reader-value lens raised, and how this design answers it

The reader-value lens ranked Pole Grid **last**, for one reason: it seats
`family.document-embedding`, the family HyperFrontend implements, in the top-right cell of a
nine-box matrix published on HyperFrontend's own docs site. Two decades of consultant 2x2s
have trained readers that top-right is the winner's box, and once that reading lands, every
honest caveat printed underneath is discounted as throat-clearing. The honesty lens
independently named this Pole Grid's risk 1 and pre-committed to inverting Y as the remedy.
Nine Cells has the identical defect and never mentions it.

This is not a soft worry. It is measurable in the dataset: `document-embedding` is favored by
**9 answers, more than any other family** (verified; next highest is virtualized rehosting at
7, then route partitioning at 6). The reader's own answers will already push toward that
family more than any other. A layout that adds a positional endorsement on top of that is
compounding a bias the page cannot afford.

**The answer: invert the runtime-realm axis. R1 (one shared runtime) is the top row, R3
(separate documents) is the bottom row.**

The reader-value lens objected that inversion "destroys the browser-wall-is-above-you
metaphor the whole encoding rests on". That objection does not survive FC 5.1, which is
explicit that Y is not security and that the separated end is precisely where a reader
wrongly reads "secure". The metaphor being sacrificed is the one the model already disowns.
Inversion therefore costs nothing the research wants kept, and it buys three things:

1. `document-embedding` lands **bottom-right**, which carries no winner's-box grammar.
2. Reading order top to bottom becomes "one shared runtime, then simulated, then separate
   documents", which is increasing separation and increasing cost, in the order the prose
   discusses them.
3. The fat row (8 of 12 families share one runtime) is at the top, so the finding "almost
   everything in this landscape runs in one shared runtime" is the first thing the eye meets,
   drawn rather than asserted.

The independent check the honesty lens asked for is still required and is listed in the build
order: someone not on this page's authoring path confirms the corner no longer reads as a
verdict. If it still does, the next remedy is to drop the C column's visual emphasis, not to
re-invert.

### 1.1.4 The objection the honesty lens raised against Nine Cells, and how it is answered

The honesty lens caught Nine Cells printing six wrong implementation counts in the channel it
had itself nominated as the honest replacement for node radius, and misciting FC 7 to justify
its column split. Both are fixed by rule, not by care:

- Counts are computed, deduped by implementation id, and asserted at build time (2.4). The
  true counts are in 2.3. The claim that the 73 to 78 gap is "a FC 7 unresolvable collision"
  is false (FC 7 lists that pair as "resolved by depth"); the three-column split is justified
  instead by the 12-point rule alone, which is sufficient and is what 3.1 states.
- Reach markers are drawn only where a documented band actually crosses a band cut. Of FC
  5.7's three documented spreads, only virtualized rehosting's (Y 23 to 58, against a cut at
  25.5) crosses one. Custom-element's Y 0 to 23 sits entirely inside R1 and gets no marker.

---

## 1.2 Data contract

### 1.2.1 Read from `decision-framework.ts`

| Path | Used for |
|---|---|
| `families[].id` | keys, cluster membership, engine joins |
| `families[].name` | **the card title and the member chip label. Never `plainName`.** |
| `families[].plainName` | body text inside an opened disclosure only |
| `families[].kind` | emerald (microfrontend) versus slate (baseline) fill, paired with a text badge |
| `families[].definition` | opened disclosure body |
| `families[].boundary` | opened disclosure, one line, "what crosses the boundary" |
| `families[].costs[0]` | fifth column at the 1156 px bonus tier only |
| `families[].position.x` | band derivation and the true-value ruler tick |
| `families[].position.y` | band derivation and the true-value ruler tick |
| `families[].position.depth` | the depth track glyph and within-cell card order |
| `axes.x.label`, `.low`, `.high` | column header pole sentences |
| `axes.y.label`, `.low`, `.high` | row header pole sentences |
| `implementations[].families[]` | per-card implementation count, deduped by `implementations[].id` |
| `metadata.researchSnapshot`, `.lastReviewed` | the "what this cannot show" strip provenance line |

`plainName` is 64 to 178 characters. Rendering it as an unwrapped SVG `<text>` is the
proximate cause of the current illegibility (`solution-space-map.tsx:157` and `:206`): a
178-character string is roughly 980 user units wide inside a 760-unit viewBox. `name` is 16
to 33 characters. **This rule is normative and must be restated in the component's JSDoc, or
a future edit reintroduces the same bug into the new layout.**

### 1.2.2 Read from `EngineResult`

| Path | Used for |
|---|---|
| `surviving[]` | live state, live counts in band headers |
| `eliminated[].family.id` | struck member chips |
| `eliminated[].by.answerId`, `.questionId` | the "Ruled out by: <answer label>" line |
| `favored` | the "your answers point here" caret |
| `answered[]` | resolving answer ids to labels; the "changed nothing" count |
| `outcome` | zero-answer framing versus post-answer framing |
| `hyperfrontend.viable` | the primary ring, paired with an explicit text chip |

### 1.2.3 Three derived fields the engine must add first

The renderer holds no reasoning (REQ-DATA-01). These belong in
`apps/docs-site/src/lib/decision-engine.ts`, not in the component.

```ts
/** Every answer that eliminates a family, beyond the one the engine attributed. */
alsoEliminatedBy: Map<string, Elimination[]>
/** Every answered question whose answer favors a family, for the tension line. */
favoredBy: Map<string, AnsweredQuestion[]>
/** Answered questions whose answer neither eliminated nor favored anything. */
inertAnswers: AnsweredQuestion[]
```

`evaluate()` today attributes each elimination to whichever question comes first in dataset
order (`if (!eliminatedBy.has(familyId))` at `decision-engine.ts:167`). That first match is
arbitrary with respect to cause: up to ten distinct answers can eliminate
`family.server-templates` and nine can eliminate `family.spa-routing` (verified). Printing
the first match alone as "the" cause is a dishonesty the page already ships.
`alsoEliminatedBy` is what makes 1.2.5's near-miss line legal.

### 1.2.4 A fourth field on `Family`, projected from FC 7

```ts
/** Families the evidence does not separate, projected from family-coordinates.md section 7. */
clusterId?: 'cluster.build-fused-five' | 'cluster.federation-lifecycle'
```

Two clusters, both mandated verbatim by FC 7:

- `cluster.build-fused-five`: `modular-monolith`, `package-composition`, `spa-routing`,
  `server-templates`, `islands`. FC 7: "The plot should draw one region labelled with the
  group's shared consequence ... and let the reader choose inside it on grounds the
  architecture axes do not measure."
- `cluster.federation-lifecycle`: `module-graph-federation`, `lifecycle-orchestration`.
  FC 7: "render them as one labelled cluster the reader can open, not as two dots pushed
  apart."

This is a data field rather than a renderer threshold for a specific reason. The mechanical
rule (same cell, same depth pole, pairwise dX and dY both within 12) does **not** reproduce
FC 7: islands sits at Y 13 against the others' Y 0, a 13-point separation that is one point
above the threshold, so a purely mechanical clustering would split it out and contradict FC
7's explicit instruction. Encoding the finding as data and asserting against it (2.4) is
honest; encoding a fudge factor in the renderer to reach the same answer is not.

Islands' one real difference is not suppressed. Its member chip carries the annotation "the
only one of the five where a failure is bounded to one region", from FC 2's evidence column
(`isolation.failure.post-mount-exception`=c).

### 1.2.5 What renders when a relevant question is unanswered

The grid has no unanswered state, because it is a landscape before it is an assessment. At
zero answers every cell is live, no chip is struck, and the counts read "5 of 5 still fit".
The framing line above the grid changes instead:

- `outcome === 'open'` (nothing answered): "Twelve approaches, surveyed in August 2026. Nothing
  is ruled out yet, because you have not told us anything."
- otherwise: "N of 12 approaches still fit your answers."

This is the deliberate difference from the Cut Ledger, which is blank until answered. A
survey is a legitimate thing to look at cold.

Per-element unanswered behaviour:

| Element | Unanswered |
|---|---|
| Cell state | `live`. Never `closed`, which asserts a cause. |
| Member chip | no strike, no reason line |
| "Ruled out by" | absent |
| Near-miss line | absent (requires at least one elimination) |
| Tension line | absent (requires at least one elimination and one favor) |
| "N of your answers changed nothing" | absent while `inertAnswers` is empty |
| Reach markers, ruler ticks, depth track, counts, empty-cell sentences | always rendered; they are properties of the landscape, not of the reader |

---

## 1.3 Layout geometry, and the collision proof

### 1.3.1 Band derivation, computed at build time

Cuts are placed at the gaps in the data that exceed the model's own smallest renderable
difference of 12 points (FC 7). Verified against the shipped dataset:

```
X sorted   0, 0, 5, 5, 6 | 53, 62, 73, 78, 83 | 97, 100
X gaps > 12:  6 -> 53 = 47      83 -> 97 = 14        (exactly two)
Y sorted   0, 0, 0, 0, 0, 6, 6, 12, 13 | 38 | 93, 95
Y gaps > 12:  13 -> 38 = 25     38 -> 93 = 55        (exactly two)
```

Two gaps on each axis, so three bands on each axis. The split is forced by the data, not
chosen. A four-column split would have to cut at the 73 to 78 gap, which is 5 points, well
inside the collision threshold.

Cuts are placed at the midpoint of the qualifying gap: X at 29.5 and 90; Y at 25.5 and 65.5.

| Band | Range | Header sentence (from `axes`, plus the literal range) |
|---|---|---|
| Column A | X 0 to 6 | Everything ships together: one build, one deploy, one release |
| Column B | X 53 to 83 | Each part ships on its own, and the page is assembled from whatever each team last published |
| Column C | X 97 to 100 | Parts join, leave and change version while the page is still running |
| Row R1 (top) | Y 0 to 13 | One shared runtime: a fault, a stray style or a patched built-in reaches all of them |
| Row R2 | Y ~38 | Each part gets a simulated private runtime |
| Row R3 (bottom) | Y 93 to 95 | Each part is its own browser document. **This is about accidents, not attackers.** |

The R3 warning is permanent header text, not a footnote, because that row is precisely where
a reader otherwise reads "secure" (FC 5.1).

### 1.3.2 Occupancy: seven cards in five cells

| Cell | Cards |
|---|---|
| A, R1 | 1: cluster "One build, one deploy" (5 members) |
| B, R1 | 3: Request-path fragment assembly; Custom-element composition; cluster "Loaded, then mounted" (2 members) |
| B, R3 | 1: URL route partitioning |
| C, R2 | 1: Virtualized-realm rehosting |
| C, R3 | 1: Separate-document embedding |
| A R2, A R3, B R2, C R1 | empty |

### 1.3.3 The collision rule, stated as an invariant

> **No label in this diagram has a position. Every label is a block-level element in normal
> flow inside a CSS grid cell. Two block elements in normal flow cannot occupy the same
> block position. Therefore no two labels can collide, at any container width, for any
> family name length, for any number of families.**

There is no collision-detection pass, no label repulsion, no leader lines, no jitter, and no
depth cue doing rescue work. Legibility is a property of the layout algorithm rather than of
the data.

### 1.3.4 The collision case worked through

**Case 1: the five-way origin pile-up, which is the diagnosed root cause.**

In the shipped scatter, with `WIDTH = 760`, `PAD = 68`, the plot area is 624 units for 100
points, so 6.24 units per point:

| Family | X, Y | plotted x, y | `plainName` chars | label width at fontSize 11 |
|---|---|---|---|---|
| modular-monolith | 0, 0 | 68.0, 392.0 | 81 | ~446 units |
| spa-routing | 0, 0 | 68.0, 392.0 | 64 | ~352 units |
| server-templates | 5, 0 | 99.2, 392.0 | 83 | ~457 units |
| islands | 5, 13 | 99.2, 351.4 | 107 | ~589 units |
| package-composition | 6, 0 | 105.4, 392.0 | 89 | ~490 units |

Five centred labels whose anchors span 37 units horizontally and 41 units vertically, each
between 352 and 589 units wide. Every label is roughly ten times wider than the distance
between its anchor and its neighbour's. Three of them share an identical y. Overlap is total
and no styling can dissolve it, because the coordinates are honest: FC 7 states these five
are one region.

In the banded grid those five families are **one card**, in cell (A, R1). Their names are
member chips stacked inside it. Five positioned labels become zero positioned labels. The
collision does not need to be avoided because it no longer exists as a rendering problem: it
has become the card's content, which is what FC 7 asks the tool to do.

**Case 2: the densest surviving cell, at the real container width.**

Cell (B, R1) holds three cards: request-path fragment assembly, custom-element composition,
and the federation-plus-lifecycle cluster. This is the cell the legibility lens and the
honesty lens disagreed about, and the container measurement settles it.

Column width at the 876 px main column:

```
876  container
-132  row header column
 -16  gutter A|B
 -28  cliff gutter (see 1.3.5)
 -16  gutter B|C
----
 684  for three columns  =  228 px each
-24   card padding (12 each side)
----
 204  px of content width per card
```

Three cards stack as full-width block rows with `gap: 8px` and `align-items: start`. The
longest title in that cell, "Request-path fragment assembly" (30 chars), at 13 px with an
average advance of about 0.55 em is roughly 215 px, so it wraps to two lines inside 204 px.
Wrapping is not a defect here: a wrapped block heading is still one heading on its own
baselines, and nothing sits beside it to contend with.

For contrast, the runner-up proposal put those same three marks into two side-by-side depth
lanes inside that column. Two lanes inside 204 px is 94 px per lane after a gutter, which
renders a 30-character title at about eleven characters per line, three lines per chip. That
is horizontal contention reintroduced in the cell that is already the densest, which is a
smaller version of the failure being fixed. The full-width stack is chosen for exactly this
reason.

**Case 3: the pair FC 5.2 warns about.**

Route partitioning (53, 93) and separate-document embedding (97, 95) sit at nearly identical
Y and are opposites on co-residence. In the grid they share row R3 but occupy different
columns, each alone in its cell, and each card states the fact in words: route partitioning
carries "participants never appear on one screen", document embedding carries "two teams on
one screen, behind browser-enforced walls". The distinction FC 5.2 says the plot structurally
cannot show is stated rather than implied, and there is no proximity to misread.

### 1.3.5 Element sizes and spacing

| Element | Value |
|---|---|
| Row header column | 132 px fixed, `align-self: start` |
| Column gutter, ordinary | 16 px |
| Cliff gutter (A to B) | 28 px, with a 4 px double rule centred in it |
| Gap B to C | 16 px, ordinary (see below) |
| Card padding | 12 px |
| Gap between cards in a cell | 8 px |
| Card title | 13 px / 600 weight |
| Member chip | 12 px, 4 px vertical gap |
| Depth track glyph | 14 px monospace, always immediately followed by its words |
| Row height | `min-content`, `align-items: start` |

**The Cliff.** The A to B gutter is the one place this design spends ink on distance, and it
spends it on the one distance the model asserts is a discontinuity rather than a magnitude
(FC 4: "Every edge out of the baseline cluster crosses the X axis at once. There is no
gradual path: `contracts.drift-surface` flips from n to y in a single step"). It is 28 px
against the ordinary 16 px, a ratio of 1.75 against the underlying 47 to 14 ratio of 3.36. The
gutter is deliberately not drawn to true proportion: a 54 px gutter would cost the columns 38
px they cannot spare at 876 px. The relative ordering is preserved, the ratio is not claimed,
and the caption carries the numbers. It reads: "No gradual path. Crossing here flips contract
drift from structurally impossible to permanent, in one step."

**Depth track.** Three positions, per FC 3's instruction of three steps only, never a colour
ramp, never size: `#..` composed in your build, `.#.` composed by a server on each request,
`..#` composed in the browser. Cards sort within a cell by this track, and the cell caption
states the rule so vertical order inside a cell is meaningful rather than arbitrary.

**True-value rulers** (at container >= 720 px). A 1 px tick strip under the column headers and
beside the row headers, ticked at every family's real coordinate, lighting on card hover and
focus. This makes the banding falsifiable at a glance: the reader can see the 47-point void
the first cut sits in. Ticks, never free-floating dots.

**Reach marker.** Exactly one card gets one: virtualized rehosting, whose documented band
(Y 23 to 58, FC 5.7) is the only one that crosses a cut (25.5). It renders as a small notch
on the card's upper edge reaching toward R1, labelled "members span Y 23 to 58; sandbox
strength genuinely differs". The other two documented spreads (custom-element Y 0 to 23,
fragment assembly X 55 to 89) sit entirely inside their own band and are stated in the
opened disclosure without a marker, because a marker would imply a reach the data does not
support.

### 1.3.6 Counts, and the four families with none

Implementation counts are computed and deduped by `implementations[].id`. Three
implementations span two families each and must not be double-counted: `impl.web-fragments`
(fragment assembly and virtualized rehosting), `impl.luigi` (document embedding and
custom-element composition), `impl.picard-js` (federation and lifecycle orchestration).

Verified counts:

| Card | Count |
|---|---|
| URL route partitioning | 2 |
| Request-path fragment assembly | 3 |
| Custom-element composition | 2 |
| Loaded, then mounted (federation + lifecycle) | **6**, not 7: `impl.picard-js` spans both |
| Virtualized-realm rehosting | 4 |
| Separate-document embedding | 3 |
| One build, one deploy (five baselines) | 2 across the whole cluster |

Four of the five baselines have zero catalogued implementations. Their chips read **"not a
product category"**, never "0 implementations". A bare zero reads as unsupported or abandoned
when these are the honest recommendation for a large share of readers, and the shipped
scatter is worse still: it sizes them at minimum radius
(`radius: 15 + min(implCount, 6) * 2.6`), so the options the framework most wants taken
seriously are drawn smallest. Count is a numeral chip. Nothing anywhere encodes magnitude as
size.

### 1.3.7 The four cell states

Each is a border treatment plus explicit words, never colour alone.

| State | Border | Words |
|---|---|---|
| live | solid | live counts in the header |
| partly ruled out | solid | member chips struck, each naming the answer responsible |
| closed by your answers | dashed, muted | "Closed by: <answer label>" |
| never occupied | none | faint centred sentence, immutable |

The last two must never look alike. An empty cell reads "Nothing in this landscape sits
here"; a closed cell names a cause. Empty-cell sentences are typeset as content, because
they are the payload:

- (A, R2) and (A, R3): "Nothing here. No approach in this landscape reaches a simulated
  realm, or puts its parts in separate documents, while shipping them in one build."
- (B, R2): "Nothing here. No independently shipped approach in this landscape uses a
  simulated private runtime."
- (C, R1): "Nothing here. Nothing that admits parts into a running page keeps them all in one
  fully shared runtime."

If those sentences are ever shortened to a dash, the design breaks.

### 1.3.8 The two lines grafted from the Cut Ledger

Both are single lines of text on a closed or partly-closed card, never a lane of marks. Both
require the derived fields in 1.2.3.

- **Near-miss versus overdetermined.** "Ruled out by 1 of your answers" against "ruled out 5
  ways". One is a live alternative behind a single answer the reader might revisit; the other
  is dead five independent ways. No other proposal carries this and no list gives it.
- **The tension line.** "3 of your answers pointed here, and a fourth ruled it out." This is
  the most actionable sentence any of the four proposals produced: it names which of the
  reader's own stated requirements stands between them and the approach the rest of their
  answers keep selecting. `eliminates` and `favors` are disjoint for every answer in the
  dataset (verified across all 45 answers), so a family never carries both marks for one
  answer.

Wording discipline, taken from the Cut Ledger and binding: quote the actual answer and its
consequence. Never phrase it as an invitation to relax. "At least one piece is shipped by
people you cannot direct" is a fact about the world, not a preference, and given that
`document-embedding` is the dataset's most-favored family, a relaxation nudge here is exactly
the bias this page cannot afford.

---

## 1.4 Responsive behaviour

### Narrow, container < 600 px (the phone, and the printed column)

**What it is:** a single column of stacked sections in DOM order, which is column-major:
all of column A, then the cliff, then column B, then column C. No DOM reordering, no
duplicated content, no horizontal scroll at any width.

Column-major is deliberate. The deploy question is the one on which "you may not need
microfrontends" is a position rather than a footnote (FC 1.2), so a phone reader meets the
five baselines first and the story runs in decision order.

- Each section is headed by its integration-time band sentence plus a live count ("Each part
  ships on its own, X 53 to 83, 4 of 5 still fit"), `position: sticky; top: 0`, so the axis
  is on screen for the whole scroll of that band.
- Occupied cells inside a section appear as sub-headed groups ("one shared runtime").
- Unoccupied rows for that column collapse to **one line**, not three empty boxes: "No
  approach in this band reaches a simulated realm or separate documents."
- Cards render collapsed to title, depth track, member count and state badge. Tapping expands
  definition, members, boundary and the near-miss line in place.
- **Eliminated cards collapse to one line.** The diagram gets shorter as the assessment gets
  more decided, which matters most at 390 px.
- The Cliff becomes a full-width labelled rule between the A and B sections carrying the same
  sentence, so the model's strongest structural claim survives the reflow. This is the point
  on which the banded grid beats the runner-up, whose narrow layout drops X entirely.
- The rulers are dropped. Twelve ticks in 350 px cannot render a 1-point gap honestly, and the
  cards already carry their coordinates in the disclosure.
- Post-answer, a toggle offers an alternative ordering: "still standing / one constraint away
  / ruled out several times over". Not a replacement, because band order is the landscape, but
  on a phone after answering, that is the ordering that matches what the reader wants next.

### Mid, 600 to 899 px

The 3x3 grid is intact. Cards are permanently collapsed to title, depth track and count, with
details behind a disclosure. Row heights are `min-content` with `align-items: start`, so the
sparse R2 and R3 rows stay one card tall and the tall R1 row is not padded to match.

### Wide, 900 px and up (reached only with the sidebar collapsed)

Full nine-cell grid, cells placed by explicit `grid-area` so the visual arrangement is
independent of the column-major DOM order. Column headers across the top carry the pole
sentence, the literal numeric range and the live count. Row headers down the left carry
theirs. Both true-value rulers appear. Cards show their member chips without expanding.

### Bonus, 1156 px (sidebar collapsed at a wide viewport)

A fifth column appears carrying one line per surviving card: `costs[0]`. This is spent on
cost rather than on revealing `plainName`, because a line of cost per surviving option is
worth more per pixel and it keeps a reader from mistaking "still fits" for "recommended".

### Always, at every width

A fixed four-item strip below the grid, visible content and never a collapsed footnote,
stating what the grid cannot show (FC 5): adoption cost is invisible and often decisive;
trust is a separate gate, not a height; whether two teams can share a screen is not on either
axis; and roster authority, release actuation, contract explicitness and orchestration
thickness still decide real cases. Plus the provenance line from `metadata`.

One sentence sits under the grid stating the thing the old plot was good at and this one only
implies: "Eight of the twelve approaches run in one shared runtime."

---

## 1.5 Interaction, keyboard, screen reader, reduced motion

**There is no mirror list.** The grid is already text in the DOM: one source, no drift
between the visual and the accessible version. Nothing is `aria-hidden` and no content exists
only in a rendered shape.

**Structure.** Each cell is a `<section aria-labelledby="colB rowR1">` referencing both band
headers, so a screen reader announces "Each part ships on its own, one shared runtime" on
entry and cell membership is spoken rather than implied by pixels. Cards are `<article>`
elements with a heading and an accessible name carrying every channel the visuals encode:
"Module-graph federation and client lifecycle orchestration, 2 approaches, composed in the
browser, 6 implementations, still fits."

`<table>` is deliberately not used. Table semantics are exact for a two-axis grid and break
under the `display: block` reflow the phone layout needs. Browsers drop implicit table
semantics when table elements are given a non-table `display`, so a table would give correct
semantics on desktop and broken ones on a phone. One honest structure in both layouts is
preferred.

**Keyboard.** Tab order follows DOM order, column-major, A then B then C, which matches the
phone reading order and the primary decision axis. Expanders are real
`<button aria-expanded aria-controls>`. Every family link is reachable. No custom keymap,
no roving tabindex, no canvas to point into. Escape collapses an open card and returns focus
to its button.

**The name filter.** A small text input above the grid matches family names, opens the
containing card and flashes the cell. This is not polish: grouping five baselines behind "One
build, one deploy" hides "islands" from a reader hunting for it by name, and the filter is the
fix for a defect the grouping itself introduces.

**Screen-reader text on state.** A struck member chip carries both the strike and the words
"ruled out by: <answer label>", with `<s>` wrapping and a visually hidden prefix so the strike
is announced and not merely seen. The primary ring on `document-embedding` is paired with an
explicit "where hyperfrontend sits" chip.

**Live region.** One polite region for the whole component. Region-level facts first, then
item-level, because the region sentence is the one that changes what the reader does next:
"Separate documents is now closed. Two approaches ruled out. Four still fit, in three of nine
combinations." Focus is never moved.

**Reduced motion.** The only transitions are card state changes (opacity and strike-through)
and disclosure toggles. Under `prefers-reduced-motion: reduce` both are removed and applied
instantly, and the disclosure toggles the `hidden` attribute rather than animating height.
**Nothing ever translates, because nothing has a position to translate from.** This is a real
dividend of abandoning position: the collapse story is state, not travel, so reduced-motion
readers get the identical experience rather than a degraded one.

**Print.** First-class, because the result page already prints as the decision record
(`result-view.tsx` carries `print:` styles). On print: every disclosure expands, the "what
this cannot show" strip inlines, the empty-cell treatment renders as a light rule, the filter
and the ordering toggle are `print:hidden`, and the grid paginates by row.

---

## 1.6 Theme treatment

Tokens are defined once on `:root`; only the values are redefined for dark. Nothing has its
only definition inside a dark block.

| Role | Light | Dark |
|---|---|---|
| Figure ground | `bg-white` | `dark:bg-slate-950` |
| Cell ground | `bg-slate-50` | `dark:bg-slate-900/40` |
| Cell border, live | `border-slate-200` | `dark:border-slate-800` |
| Cell border, closed | `border-slate-300 border-dashed` | `dark:border-slate-700 border-dashed` |
| Card title | `text-slate-900` | `dark:text-white` |
| Body and chips | `text-slate-700` | `dark:text-slate-200` |
| Muted, empty-cell sentences | `text-slate-500` | `dark:text-slate-400` |
| Microfrontend card accent | `border-l-emerald-600` | `dark:border-l-emerald-400` |
| Baseline card accent | `border-l-slate-400` | `dark:border-l-slate-500` |
| Hyperfrontend ring | `ring-primary-500` | `dark:ring-primary-400` |
| Eliminated chip | `text-slate-500 line-through decoration-slate-400` | `dark:text-slate-400 decoration-slate-500` |
| Ruler tick | `bg-slate-300` | `dark:bg-slate-700` |
| Cliff rule | `border-slate-400` | `dark:border-slate-500` |

Notes that matter:

- The muted sentences use slate-500 / slate-400, not the slate-300 / slate-700 the current
  plot uses for its ruled-out labels (`solution-space-map.tsx:155`), which fails 4.5:1 on both
  grounds.
- The dashed eliminated border is slate-300 / slate-700, not lighter, so it clears 3:1 as a
  non-text indicator.
- Emerald, slate and the primary ring are each paired with a visible text badge. The four cell
  states are distinguished by border style plus a sentence. Nothing is carried by hue, so the
  figure survives greyscale print and every common colour-vision deficiency.
- The empty-cell hatch, where one is used, is a `repeating-linear-gradient` over `currentColor`
  at low alpha, so it inverts with the theme for free.
- Focus ring: 2 px `primary-500` at offset 2, on the button, never on a group wrapper.

---

## 1.7 ASCII sketch

### Wide (container >= 900 px). Y inverted: shared runtime on top, so no corner reads as a winner's box.

```
  Twelve approaches, surveyed August 2026.  7 of 12 still fit your answers.   [ filter: ____ ]

  true-X ruler   0-5-6                     53--62--73-78-83              97-100
                 |||                       |   |   |  |  |               |   |
             +- A  ONE BUILD, ONE DEPLOY -+ || +- B  EACH SHIPS ON ITS OWN -+ +- C  JOINS A RUNNING PAGE -+
             |     X 0-6 . 5 of 5 fit     | || |   X 53-83 . 4 of 5 fit      | |  X 97-100 . 2 of 2 fit    |
+----------+ +----------------------------+ || +-----------------------------+ +---------------------------+
| R1  ONE  | | #..  ONE BUILD, ONE DEPLOY | || | .#. Request-path fragment   | |                           |
| SHARED   | |      5 approaches          | || |     assembly                | |    Nothing here.          |
| RUNTIME  | | The evidence does not      | || |     server . 3 impl         | |    Nothing that admits    |
|          | | separate these five: drift | || +-----------------------------+ |    parts into a running   |
| Y 0-13   | | structurally impossible,   | || | ..# Custom-element          | |    page keeps them all    |
|          | | no per-team deploy         | || |     composition             | |    in one fully shared    |
| a fault  | | schedule.                  | || |     browser . 2 impl        | |    runtime.               |
| reaches  | |  > Modular monolith        | || +-----------------------------+ |                           |
| all      | |  > Package-boundary comp.  | || | ..# LOADED, THEN MOUNTED    | |                           |
|          | |  > Route-chunked single    | || |     2 approaches, one point | |                           |
|          | |  > Server-rendered tmpl.   | || |     browser . 6 impl        | |                           |
|          | |  > Islands architecture *  | || |  They differ in the seam:   | |                           |
|          | | * the only one of the five | || |  federation loads, an       | |                           |
|          | |   where a failure is       | || |  orchestrator mounts.       | |                           |
|          | |   bounded to one region    | || |  > Module-graph federation  | |                           |
|          | | not a product category     | || |  > Client lifecycle orch.   | |                           |
+----------+ +----------------------------+ || +-----------------------------+ +---------------------------+
| R2 SIMU- | |                            | || |                             | | ..# Virtualized-realm     |
| LATED    | |     Nothing here.          | || |    Nothing here.            | |     rehosting             |
| PRIVATE  | |     No approach reaches a  | || |    No independently shipped | |     browser . 4 impl      |
| RUNTIME  | |     simulated realm while  | || |    approach uses a          | |  ^ members span Y 23-58;  |
| Y ~38    | |     shipping in one build. | || |    simulated realm.         | |    sandbox strength       |
|          | |                            | || |                             | |    genuinely differs      |
+----------+ +----------------------------+ || +-----------------------------+ +---------------------------+
| R3  ITS  | |                            | || | .#. URL route partitioning  | | ..# Separate-document     |
| OWN      | |     Nothing here.          | || |     server . 2 impl         | |     embedding        (HF) |
| BROWSER  | |     No approach puts its   | || |  !! participants NEVER      | |     browser . 3 impl      |
| DOCUMENT | |     parts in separate      | || |     appear on one screen    | |  two teams on one screen, |
| Y 93-95  | |     documents while        | || |                             | |  behind browser-enforced  |
|          | |     shipping in one build. | || |                             | |  walls                    |
| accidents| |                            | || |                             | |                           |
| not      | |                            | || |                             | |                           |
| attackers| |                            | || |                             | |                           |
+----------+ +----------------------------+ || +-----------------------------+ +---------------------------+
                                            ||
       || THE CLIFF - no gradual path. Crossing here flips contract drift from
          structurally impossible to permanent, in one step.  (47 points of axis
          with nothing in it; the B-to-C gap is 14 and is drawn as an ordinary gap.)

  depth track   #.. composed in your build   .#. composed by a server on each request
                ..# composed in the browser      (cards sort by it within a cell)

  Eight of the twelve approaches run in one shared runtime.

  WHAT THIS CANNOT SHOW
   adoption cost, often decisive  |  trust: a separate gate, not a height
   whether two teams can share a screen  |  roster authority, release actuation,
   contract explicitness, orchestration thickness
   Surveyed August 2026, last reviewed 2026-08-29.
```

### After answering: the four cell states, border plus words, never colour alone

```
 +--------------------+  +====================+  , - - - - - - - - - ,   (no border)
 | live               |  | partly ruled out   |  ' closed by your    '    Nothing here.
 | solid border       |  | members struck,    |  ' answers: dashed,  '    Immutable. Never
 | live count in the  |  | each naming its    |  ' muted, and it     '    changes with your
 | band header        |  | own answer         |  ' names the cause   '    answers.
 +--------------------+  +====================+  ' - - - - - - - - - '

  On a closed or partly-closed card:
    Ruled out by 1 of your answers: "Everything must ship together in one coordinated release"
    3 of your answers pointed here, and a fourth ruled it out.
  Below the grid:
    5 of your answers changed nothing.  [v]
```

### Narrow (container < 600 px). Same DOM, column-major, no reordering, no horizontal scroll.

```
  Twelve approaches. 7 of 12 still fit.   [ filter: ______ ]

 [ sticky ] A . EVERYTHING SHIPS TOGETHER
            X 0-6 . 5 of 5 still fit
   one shared runtime
     #.. ONE BUILD, ONE DEPLOY . 5 approaches   [v]
         not a product category
   No approach in this band reaches a simulated
   realm or separate documents.

 ========== THE CLIFF: no gradual path ==========
  Crossing here flips contract drift from
  structurally impossible to permanent, in one
  step. 47 points of axis with nothing in it.
 ================================================

 [ sticky ] B . EACH PART SHIPS ON ITS OWN
            X 53-83 . 4 of 5 still fit
   one shared runtime
     .#. Request-path fragment assembly   [v]
     ..# Custom-element composition       [v]
     ..# Loaded, then mounted . 2         [v]
   separate browser documents
     .#. URL route partitioning           [v]
         !! never two owners on one screen
   No approach in this band uses a simulated realm.

 [ sticky ] C . JOINS A RUNNING PAGE
            X 97-100 . 2 of 2 still fit
   simulated private runtime
     ..# Virtualized-realm rehosting      [v]
   separate browser documents
     ..# Separate-document embedding (HF) [v]
   No approach in this band keeps everything in
   one fully shared runtime.

  [ order by: band | what your answers did ]
  Eight of twelve run in one shared runtime.
  WHAT THIS CANNOT SHOW  ...
```

---

## 1.8 What this diagram deliberately does not show, and why

| Refusal | Why |
|---|---|
| **No within-cell position.** Two cards in a cell are not "close"; they are unseparated by these two axes. | That is a statement about the evidence, not about the architectures. The cell caption says so, and the depth track is the only ordering, with its rule printed. |
| **Band widths are not measurements.** Each header prints its literal numeric range. | FC 5.5: only the ordering and the collisions are claims. A 20-point gap is not twice a 10-point gap. |
| **Empty cells say "nothing in this landscape sits here", never "impossible".** | The dataset holds 30 surveyed units as of August 2026 and has no authority to declare a region uninhabitable. |
| **No arrows between cells.** FC 4's relax-and-land-here edges appear as text inside an opened card, naming the destination and the one differing property, with no line drawn. | FC 5.4: cell adjacency is not migration cost. An arrow in a grid reads as a cheap move. Package composition to federation is 123 units and one conceptual step; modular monolith to SPA routing is 0 units and a rewrite. Those edges also live in the research workspace and not in the shipped dataset, so drawing them would either invent them in the renderer or imply a topology the projection does not carry. |
| **No adoption cost anywhere.** | FC 5.3: `dimension.adaptation-floor` was rejected as an axis because families span it, and it is often the deciding constraint. Position implies nothing about how much you must change your apps. |
| **Height is never security.** The R3 row header permanently disowns the reading. | FC 5.1: a same-origin unsandboxed frame sits at Y 95 and still holds host-origin authority. Trust is a gated filter in the engine, deliberately not geometry. |
| **Same row is never same capability.** Route partitioning states "participants never appear on one screen" on its own card. | FC 5.2: it reaches R3 by never letting participants co-reside, which is the opposite situation from document embedding. |
| **No ranking inside the "One build, one deploy" cluster, and no tie-break.** | FC 7 is explicit that the choice among those five is made on grounds these axes do not measure. The card states the shared consequence and hands off. |
| **No ranking of survivors against each other, anywhere.** | The engine computes no preference order over survivors, so the diagram invents none. `favored` renders as a caret plus a sentence about the reader's own answers, never as a rank. |
| **No magnitude channel at all.** No size, no arrow length, no colour ramp. | FC 3 forbids the ramp by name; the other two would invent magnitude. Implementation count is a numeral. |
| **No brands, no vendors, no editions.** Cards hold family names only. | FC 5.6: a configuration is what gets a coordinate, never a brand. Mode-forked products would need two positions. |
| **No layers.** `zephyr-cloud` and `picard-js` are not plotted as entities. | FC 5.8: they attach to a family rather than occupying a position; plotting them would invent a family the landscape does not have. |

---

# Diagram 2: The Independence Seam

## 2.1 The chosen design, and why it beat the alternatives

**Chosen: a four-band vertical stack, read top to bottom, whose single dominant mark is a
seam that is welded, gapped, or gapped-by-preference.** Bands are WHO SHIPS EACH PIECE, WHAT
EACH PARTY HANDS OVER, WHERE THE PARTS ARE JOINED, WHAT THE USER SEES. The subject is the
reader's own delivery topology, not the family landscape.

Two of three lenses ranked it first, and the container measurement in section 0 is what
confirms them.

**Why not Delivery Lanes** (the honesty lens's winner, and the most rigorously verified
proposal in the set). Every derivation it claimed holds: I re-verified that
`question.delivery.server-capacity#static-only` eliminates exactly one family
(`server-fragment-assembly`) and that `question.delivery.first-paint#crawlable-required`
eliminates exactly the five depth-100 families. Its `answerId -> element` table is the single
best governance idea in the batch and is grafted in below. But its geometry is inverted
against the container: five equal `1fr` columns in an 876 px main column is about 160 px per
cell, and those cells must carry answer labels that run 37 to 104 characters with a median of
72 (verified). A 72-character label at 160 px is roughly eighteen characters per line, so four
ragged lines, ten of them at once. Its escalation rule makes this worse rather than better:
"above roughly 1400 px the derivation lines expand to the full answer text inline" fires at a
viewport where the container is still 876 px, so the reader's reward for a bigger monitor is
more sentence text in the same 160 px columns. It also asks the reader to learn roughly ten
distinct glyph encodings with no focal point, and concedes five to six screenfuls on a phone.

**Why not Frame and Join.** Its best idea, that the assessment never asks what you do today
so no element may describe your current architecture, is grafted in as a caption. The
two-panel frame that surrounds it then undermines it: computed CHANGED and unchanged delta
chips assert a before-and-after the model has no basis for, and the left panel's join band,
the visual centre at desktop, is deliberately empty, so the default impression is a hole where
the subject should be. It also has a verifiable encoding error: its row axis is "whether
`integrationPhase` contains 'runtime-live'", presented as fully determined by the dataset, but
`module-graph-federation` and `lifecycle-orchestration` both read
`'deploy-decoupled, conditionally runtime-live'` (verified), so the stated rule places them in
a different cell from the one its own sketch draws. Its tablet tier is also unbuildable: a
three-column join grid inside a half-width cell of an 876 px container is about 95 px per
column, holding chips like "Route-chunked single application" at eleven characters per line.

### 2.1.1 The objection the honesty lens raised, and how the final design answers it

The honesty lens ranked the Seam second and named a real defect, which I verified: **the mark
that carries the whole verdict depicts a reader's answer, while the proposal's rationale sells
it as depicting the families.** Its argument was that the five baselines "are not five dots,
they are one welded seam", because for all five the answer is the same no. That is false
against the dataset: `question.deploy.independence#valuable-not-required` is
`strong-preference` with `eliminates: []`, so it gaps the seam while all five baselines
survive. The load-bearing mark and the collision it claims to resolve are different objects
that merely correlate under some answers.

Two corrections, both structural:

1. **The seam gets four states, not two,** so it depicts what it actually reads (2.3.3). The
   third state exists precisely because `#valuable-not-required` is a preference and must not
   render as a fact.
2. **The five-baseline collision claim moves to where the collision actually resolves:** the
   composition-position row in band 3, carrying Delivery Lanes' sentence verbatim in substance.
   The Seam was wrong about where its own best content lived, not wrong to want it.

The honesty lens and the legibility lens independently caught a second defect: the proposal
assigned dashed-with-no-fill to both "a party you cannot direct" and "not yet established",
defending it as "both outside the fill". Those are categorically different epistemic states, a
known hard constraint and an absence of information, and fusing them means the reader cannot
tell a fact from a gap without reading the label. Fixed in 2.3.2 with four distinct
treatments.

### 2.1.2 The objection the legibility lens raised

Bottom-up reading. The proposal needed a left rail saying "read from the bottom up" and
conceded a visual-versus-DOM order mismatch, and that rail is a wide-only affordance, so the
phone, the harder case, gets none. **The final design runs top-down.** Bands are numbered,
DOM order equals visual order equals focus order, and direction lives on the connectors. The
"delivery flows upward toward the user" metaphor is not worth a reading instruction. The
proposal itself named this flip as its fallback; it is taken as the default.

---

## 2.2 Data contract

### 2.2.1 The governing rule, grafted from Delivery Lanes and binding

> **An element may be drawn only if a named answer id produces it.** Implement it as an
> explicit `answerId -> element` table in a data module. Anything absent from that table is
> not drawn, ever. Enforced at review: if someone wants to draw a registry, an environment, or
> a pipeline stage, the question is which answer id produced it.

This is what stops a delivery diagram drifting into invented CI/CD detail, and it is also the
hard cap on band 3, which otherwise attracts every gated fact and becomes the cluttered thing
this replaces.

### 2.2.2 Question to element mapping, with the unanswered rendering

| Element | Source | Unanswered |
|---|---|---|
| Party lanes, count and kind | `question.ownership.composition-parties` only | ONE solid "your team" card (the reader is always a party) plus a dotted button "Who else ships a piece? Not asked yet" |
| Ghost strip | same, on `#several-teams` / `#outside-party` / `#no-deploy-control` | absent |
| Control glyph (slashed arrow) | `#outside-party`, or both directions on `#no-deploy-control` | absent |
| Artifact card text | `question.migration.participant-ceiling`, all four answers | dotted cards, "what each party hands over is not established" |
| Seam state | `question.deploy.independence`, plus `#no-deploy-control` from Q1 | a single neutral dotted rule, "the release boundary: not yet decided by your answers" |
| Composition positions | derived from `families[].position.depth`, three poles | all three live, caption says so |
| Position strike | derived: no surviving family sits at that pole | never struck |
| Operator line | `question.delivery.server-capacity` | "who runs the composition point: not asked yet" |
| Contract line | shared `families[].boundary` of survivors | "your answers still allow N different contracts" |
| Boundary strength | `question.trust.malicious-participant`, `question.failure.containment` | seam says "accidents", never "attackers" |
| Admission arrow | `question.roster.runtime-admission` (gated on `#outside-party`) | never unlocked: absent entirely |
| Page shape | `question.granularity.single-screen` only | ONE rectangle, dotted internal divider, "we have not asked whether one screen ever mixes owners". It does **not** default to two. |
| Divider glyph | `#seams-acceptable` / `#must-survive` / `#contain-malice`, three distinct glyphs | absent |
| Region link | `question.contracts.sync-calls` | absent |
| Dependency annotation | `question.coordination.upgrade-train`, `.deps.major-coexistence`, `.deps.payload-budget`, all gated on `#mixed-screen` | never unlocked: one grey line, "framework-copy questions only arise once two teams share a screen". Unlocked but unanswered: dotted chip. |
| Seat inversion | `question.host.negotiability` | reader owns bands 3 and 4 |

Unanswered is never a default and never a plausible-looking guess. Every unanswered element is
a real `<button>` that moves focus to the question that would fill it, with an accessible name
like "Not established: who builds and ships each piece. Answer question 1." The emptiest
version of the diagram is therefore its most useful navigation.

Placeholder copy must be short phrasings authored per question. Do **not** use `question.circumstance`, which runs 108 to 248 characters (verified).

### 2.2.3 Fields read

From the dataset: `families[].position.depth` (the three poles), `families[].name` (chips),
`families[].boundary` (the contract line), `families[].clusterId` (the same field diagram 1
adds, reused for the baseline cluster chip), `questions[].answers[].label`,
`.answerClass`, `.consequence`, `hyperfrontendFloor[].side` and `.summary` and
`.conflictsWith`, `axes` (not used; band labels are authored).

From the engine: `answered[]`, `surviving[]`, `eliminated[].family.id` and `.by`,
`alsoEliminatedBy` (2.1.3 of diagram 1's contract, shared).

### 2.2.4 One dataset task, worth doing regardless

The three assembly-locus pole labels have no home in the shipped data:
`FamilyPosition.depth` documents only the two ends ("0 is composed in your build, 100 is
composed in the browser"), and the request-path pole exists only in the workspace markdown.
Add the three poles to `axes` in `decision-framework.ts` rather than hardcoding the prose in a
component, or the labels stop round-tripping to the research.

---

## 2.3 Layout geometry, and the collision proof

### 2.3.1 The collision rule

> **Bands are full-width block sections in a single column. Within a band, parties are at most
> two grid columns at wide and at most two block rows at narrow. Family names appear only as
> wrapped inline-flex chips inside a composition position. Nothing in this diagram is
> positioned by a coordinate.**

### 2.3.2 The four ownership treatments, never sharing a channel

This is the fix for the defect two lenses caught.

| Meaning | Treatment |
|---|---|
| Your team | solid primary tint, solid border |
| Another team at your company | solid slate tint, solid border |
| A party you cannot direct | hatched (`repeating-linear-gradient` over `currentColor`), solid border |
| Not established | **dotted** border, no fill, no hatch |

Hatch is hue-independent and inverts with the theme for free. Every lane also carries its
label in words, so no meaning rests on fill or hue.

Separately, and on a different channel: **the delivery rails encode `answerClass`.** Solid for
`hard`, dashed for `strong-preference`, hairline-dashed for `weak-preference`, dotted for
unanswered. `AnswerClass` has three values (verified), and the runner-up that proposed this
collapsed the two preferences into one dash. Use all four treatments. This matters concretely:
`#page-per-team`, `#probably-later`, `#seams-acceptable` and `#credible-ask` all eliminate
nothing, and without this channel each would be drawn with the same ink as a hard elimination.

### 2.3.3 The seam: four states

| State | Trigger | Mark |
|---|---|---|
| WELDED | `question.deploy.independence#train-mandated` | a solid bar with a diagonal hatch drawn in `currentColor`; delivery arrows pass through unbroken. Caption: "one build joins them; nothing crosses independently." |
| GAPPED (hard) | `#independent`, or `question.ownership.composition-parties#no-deploy-control` | two hairlines with clear air between and a contract chip in the gap; arrowheads stop and do not touch across it. Caption: "each side crosses on its own schedule; contract drift is structurally possible here." On `#no-deploy-control` it adds "entailed by ownership, not chosen." |
| GAPPED BY PREFERENCE | `#valuable-not-required` | the same geometry with a **dashed tie** across the gap and the caption "available, not required. You ranked this; you did not require it." |
| UNDECIDED | unanswered | a single neutral dotted rule, "the release boundary: not yet decided by your answers." |

The seam is the only element that goes full-bleed, breaking out of the figure padding, at
every width. It is the anchor of the composition and it is legible at 320 px because it needs
no text to read.

### 2.3.4 Composition positions, and the collision case worked through

Band 3 holds three positions derived from `position.depth`. The twelve families partition
cleanly with no straddlers (verified): 5 at the build pole (depth 0 to 10), 2 at the
request-path pole (45, 55), 5 at the browser pole (100).

| Position | Families | Chips drawn |
|---|---|---|
| in your build, before anything ships | 5 baselines | **1** cluster chip |
| on the request path (two sub-rows) | route-partition (45) "a router forwards each navigation"; fragment assembly (55) "a composer assembles the markup" | 2 |
| in the browser, while the page runs | custom-element, {federation + lifecycle}, virtualized, document-embedding | **4** |

The request path keeps its two sub-rows because the evidence distinguishes them and because
the engine acts on the distinction: `#static-only` eliminates only `server-fragment-assembly`,
so it strikes the "composer assembles" sub-row and annotates the forward sub-row with the
dataset's own wording, "confined to routing infrastructure that already exists". A design that
merges the request path into one row cannot express that and will mis-attribute the cause,
which is exactly the error the third proposal commits.

**The worked collision case.** The densest element in this diagram is the browser position at
zero answers: four chips. Chip labels are `family.name`, 22 to 30 characters there, so about
160 to 215 px each at 13 px. At the 876 px container the band content row is about 744 px
after the rail and padding, so chips wrap two per line, two lines. At 390 px the content row
is about 350 px, so one per line, four lines. In both cases the chips are wrapped inline-flex
children: the flex line box guarantees the horizontal separation and the wrap guarantees the
vertical separation. **The five-family build pole, which is the pile-up that broke the
scatter, draws one chip, not five.** Its cluster chip carries the sentence, taken from
Delivery Lanes and better than any alternative in the batch:

> 5 approaches compose here, and nothing about your delivery topology separates them. Choose
> inside this group on grounds these stages do not measure.

The strike rule is general, never hardcoded to two answers: a position is struck when no
surviving family sits at that pole, and the caption names the responsible answers from
`eliminated[].by` across that pole's families, one named cause per family. It happens to
produce two clean cases: `#static-only` strikes the assemble sub-row alone, and
`#crawlable-required` strikes the entire browser position because it eliminates exactly the
five depth-100 families (verified).

### 2.3.5 Element sizes and spacing

| Element | Value |
|---|---|
| Band card padding | 16 px |
| Gap between bands | 0, with a 1 px rule; the seam band breaks the padding |
| Left rail (wide only) | 132 px, band number plus a downward arrow |
| Right provenance rail (wide only) | 160 px of chips |
| Party column, wide, two parties | (876 − 132 − 160 − 16 gutter − 72 ghost) / 2 = about 248 px each |
| Ghost strip | 72 px, dotted |
| Seam bar height | 28 px welded, 2 x 2 px hairlines with 20 px air when gapped |
| Page rectangle (band 4) | fixed 16:10 aspect at every width |
| Composition chip | 12 px text, 6 px gap, wrapping inline-flex |

The page rectangle in band 4 keeps a literal aspect at every width and is the one figurative
mark in the diagram. Shrinking it to an icon would destroy the `#mixed-screen` versus
`#page-per-team` distinction, which is its whole job.

---

## 2.4 Responsive behaviour

### Narrow, container < 640 px

**What it is:** the same four bands as full-width cards, in the same order, with party columns
becoming party rows. A vertical stack is already the shape a phone wants, so this is a reflow
rather than a shrink, and the desktop adds columns to it rather than the phone subtracting
them.

- Party columns become rows, each prefixed by its own repeated label and treatment ("Your team
  ->", "A party you cannot direct ->"). The trace-a-party-downward affordance is genuinely
  lost; the repeated per-row label replaces it, and that substitution is stated in the figure
  rather than hidden.
- The seam goes full-bleed, edge to edge, breaking the card padding. It is the only element
  that does, so it stays the anchor at 320 px.
- The left rail and the right provenance rail are not rendered. Each band's "from your answer
  to ..." chip drops under the band heading as a full-width button.
- The three composition positions become a plain vertical list, struck ones keeping their
  strike and their reason on a second line.
- The ghost strip becomes a single dotted row rather than a narrow column.
- In `#page-per-team` the two page rectangles stack with the navigate glyph rotated 90 degrees
  between them, matching the pattern already used in `elimination-cascade.tsx:87`.
- No horizontal scrolling at any width, and no minimum width. The current map hard-codes
  `min-w-[640px]` inside an `overflow-x-auto` container (`solution-space-map.tsx:76-77`);
  neither diagram in this spec has a scroll container anywhere.

### Wide, container >= 640 px

Bands become horizontal rows with party columns, and the figure gains two rails:

- A left rail with the band number and a downward arrow, so delivery direction is drawn rather
  than instructed.
- A right rail of provenance chips, one per band, each a real button reading "from your answer
  to: <question>" that scrolls to and focuses that question. For bands whose questions were
  never unlocked it reads "not asked, and why".

Party columns earn their keep here: a party holds one column from its card in band 1, through
its artifact in band 2, to where its output lands in band 4, so a delivery rail can be
followed as one continuous line. Rails are drawn only at this tier.

### Cap

The figure stops growing at 876 px and centres. Extra width, on the rare collapsed-sidebar
view, goes to the rails, which expand from chips to full sentences naming the answer that
produced each band. The wide layout adds no information the narrow one lacks; it adds the
continuous trace and the provenance rail, both of which are navigation rather than content.

---

## 2.5 Interaction, keyboard, screen reader, reduced motion

**DOM-first construction is the accessibility decision, not a styling preference.** Everything
except the connectors and the hatch is real text in real elements, so it reflows, respects
text zoom to 200 percent, and is selectable and translatable. A single monolithic SVG would
have made the narrow reflow impossible and the text unzoomable.

**Connectors.** Small inline SVGs, each in its own grid area with
`preserveAspectRatio="none"`, so they stretch to whatever the grid gives them with no
measurement pass, no `ResizeObserver`, and no new dependency. All are `aria-hidden`, and each
one's meaning is duplicated as visually hidden text inside the element it points into.

**Reading order.** DOM order equals delivery order equals visual order equals focus order, top
to bottom. No `column-reverse`, no `order`, no grid-row trickery that would desynchronise
focus from the visual.

**Screen-reader parity is a one-sentence thesis, not a data dump.** A paragraph at the top of
the figure states the whole topology from the same values that drive the marks. It is
**visible**, not visually hidden: it is the takeaway, and the highest-value single artifact in
any of the three proposals.

> Your team and one party you cannot direct each ship a separately deployed app. They are
> joined in the browser, while the page runs. At least one screen shows both at once.

Wording rule, binding: only `question.trust.malicious-participant#contain-malice` licenses
adversarial language. In every other state the seam and the boundary say "accidents", never
"attackers" and never "safe" (FC 5.1). The proposal's own sample thesis violated this by
asserting "the boundary between them is enforced by the browser" as an established fact; the
thesis states what the reader answered, not what a mechanism guarantees.

**Requirement, never promise.** `#must-survive` and `#contain-malice` and
`#crawlable-required` render as "you required: ..." chips. Nothing depicts a barrier as
delivered. The same applies to the `#seams-acceptable` divider, which comes from an answer
saying a seam would be tolerable **or** engineered away.

**Three divider glyphs, three questions, never blurred.** A visible seam line
(`#seams-acceptable`), a wall labelled "you required: one region may fail without the others"
(`#must-survive`), a doubled wall labelled "you required: it holds even if that piece is
compromised" (`#contain-malice`). Blurring them would lose the FC 5.2 distinction the plot
structurally cannot show, which is half the reason this diagram exists.

**Keyboard.** Exactly two kinds of interactive element, both real `<button>`s in DOM order:
the provenance chips, and the "not asked yet" placeholders. Both jump to and focus the
originating question. No roving tabindex, no custom keymap, no drag, no pointer-only
affordance. Every fact is present as text whether or not anything is activated.

**Struck positions** use a real `<s>` with a visually hidden "ruled out by:" prefix, so the
strike is announced and not merely seen.

**Live region.** One polite region, one summary sentence per recomputation, never per element:
"Composition narrowed to: in the browser, while the page runs. Two positions closed."

**Reduced motion.** The only motion is a 200 ms tint-and-strike transition when an answer
lands. Under `prefers-reduced-motion: reduce` it is removed and state changes cut instantly.
No idle animation, no auto-play, no camera, nothing that would need stopping off-screen.
Changing an early answer prunes later ones (`pruneAnswers`), so several bands can change at
once: the transition must be a single coordinated pass, and the live region announces one
summary rather than per-element changes.

**Print.** Every disclosure expands, the rails inline under their bands, the seat-inversion
frame prints as a labelled border, and the figure paginates by band.

---

## 2.6 Theme treatment

| Role | Light | Dark |
|---|---|---|
| Band card | `bg-white` / `border-slate-200` | `dark:bg-slate-900/40` / `dark:border-slate-800` |
| Band heading | `text-slate-900` | `dark:text-white` |
| Your team fill | `bg-primary-50` / `border-primary-500` | `dark:bg-primary-950/40` / `dark:border-primary-400` |
| Another team fill | `bg-slate-100` / `border-slate-400` | `dark:bg-slate-800` / `dark:border-slate-500` |
| Cannot direct | hatch over `currentColor` at 0.12 alpha / `border-slate-400` | same hatch / `dark:border-slate-500` |
| Not established | no fill / `border-slate-300 border-dotted` | no fill / `dark:border-slate-600 border-dotted` |
| Seam, welded | `bg-slate-700` with `currentColor` hatch | `dark:bg-slate-300` |
| Seam, gapped | `border-slate-600` hairlines | `dark:border-slate-400` |
| Live position | `text-emerald-700` / `border-emerald-600` | `dark:text-emerald-300` / `dark:border-emerald-400` |
| Struck position | `text-slate-500 line-through decoration-slate-400` | `dark:text-slate-400 decoration-slate-500` |
| Hyperfrontend chip | `ring-primary-500` plus "where hyperfrontend sits" | `dark:ring-primary-400` |
| Requirement chip | `bg-slate-100 text-slate-700` | `dark:bg-slate-800 dark:text-slate-200` |

The hatch is drawn with `currentColor` at low alpha so one pattern definition inverts
correctly rather than needing a per-theme duplicate. The seam hatch likewise. Colour never
carries meaning alone: ownership is fill-versus-hatch-versus-dotted plus a written label; the
seam verdict is weld-versus-gap geometry plus a written label; struck positions are
`line-through` plus a reason sentence. The figure survives greyscale and every common
colour-vision deficiency.

---

## 2.7 ASCII sketch

### Wide (container >= 640 px). Top-down. Shown with: Q1 `#outside-party`, Q2 `#independent`, Q3 `#page-per-team`, Q4 `#wrap-as-is`, Q7 `#static-only`.

```
+---------------------------------------------------------------------------------+
| Your delivery topology                              5 of 16 questions answered   |
| Your team and one party you cannot direct each ship a separately deployed app.   |
| They are joined in the browser, while the page runs. Each page belongs to one    |
| team and you move between them by navigating.                                    |
| Drawn from 5 answers. This describes constraints you reported, not a system      |
| anyone observed: the assessment never asks what you do today.                    |
+-----+-------------------------------------------------------------+-------------+
| 1   | WHO BUILDS AND SHIPS EACH PIECE                              | from your   |
|  |  |  +-------------------+ +///////////////////+ +. . . . . .+  | answer to   |
|  |  |  | ### your team     | +//a party you//////+ . however    .  |  Q1  >      |
|  |  |  |                   | +//cannot direct////+ . many       .  |             |
|  v  |  +---------+---------+ +//////////+////////+ . others     .  |             |
|     |            |      -(/)-           |          . count      .  |             |
|     |            |   you cannot direct  |          . unknown    .  |             |
+-----+------------|----------------------|----------+. . . . . .+--+-------------+
| 2   | WHAT EACH PARTY HANDS OVER                                   |  Q2  >      |
|  |  |  +-------------------+ +///////////////////+                |  Q4  >      |
|  |  |  | a deployed app,   | | [LOCK] a deployed |                |             |
|  |  |  | exactly as it     | | app, exactly as   |                |             |
|  |  |  | already runs      | | it already runs   |                |             |
|  v  |  +---------+---------+ +---------+---------+                |             |
|     |  one modification ceiling was recorded and is shown for      |             |
|     |  every party. Nothing about it can change.                   |             |
+-----+------------|----------------------|--------------------------+-------------+
| 3     WHERE THE PARTS ARE JOINED                       <- the seam    Q2  >      |
|       ================================================================  Q7  >    |
|         |            |                                       |              |
|         - - - - -| an embed URL plus a message protocol |- - - -              |
|         |            |                                       |              |
|       ================================================================          |
|       each side crosses on its own schedule. Contract drift is                   |
|       structurally possible here.                                                |
|                                                                                  |
|       composed ...                                                               |
|        (X) in your build, before anything ships                                  |
|            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   ruled out by "A team must be    |
|            > 5 approaches compose here, and nothing about your delivery          |
|              topology separates them. Choose inside this group on grounds        |
|              these stages do not measure.                                        |
|        (o) on the request path: a router forwards each navigation   still open   |
|        (X) on the request path: a composer assembles the markup                  |
|            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   ruled out by "You ship files   |
|                                                    to a CDN"                     |
|        (o) in the browser, while the page runs                      still open   |
|            > Custom-element composition   > Loaded, then mounted (2)             |
|            > Virtualized-realm rehosting  > Separate-document embedding  (HF)    |
|       who runs the composition point: you ship files to a CDN and operate        |
|       nothing on the request path.                                               |
+-----+-------------------------------------------------------------+-------------+
| 4   | WHAT THE USER SEES                                           |  Q3  >      |
|     |   +----------------------+   <=> navigate   +--------------+ |             |
|     |   | ### your team's page |----------------->|////their//// | |             |
|     |   |                      |<-----------------|////page///// | |             |
|     |   +----------------------+                  +--------------+ |             |
|     |   never on one screen; you move between them by navigating    |             |
+-----+-------------------------------------------------------------+-------------+
  ### you   ///// a party you cannot direct   . . . not established, or not asked
  rails: solid = a hard answer   dashed = a preference   dotted = unanswered

  THE SEAM, the one mark that carries the verdict - four states:

  WELDED (#train-mandated)          GAPPED, hard (#independent)
  ################################  ================================
  # one build joins them.        #   |          |            |
  # nothing crosses              #     - -| contract |- -
  # independently.               #   |          |            |
  ################################  ================================
  arrows pass through unbroken      arrowheads stop; air between

  GAPPED BY PREFERENCE              UNDECIDED (unanswered)
  (#valuable-not-required)          . . . . . . . . . . . . . . . .
  ================================   the release boundary: not yet
    - - - - - dashed tie - - - -     decided by your answers
  ================================
  available, not required. You
  ranked this; you did not require it.
```

### Narrow (container < 640 px). Same four bands, columns become rows, seam full-bleed.

```
+------------------------------+
| Your delivery topology       |
| 5 of 16 questions answered   |
| Your team and one party you  |
| cannot direct each ship a    |
| separately deployed app...   |
+------------------------------+
| 1 . WHO SHIPS EACH PIECE     |
| ### your team                |
| /// a party you cannot direct|
|     -(/)- you cannot direct  |
| . . however many others . .  |
| [ from your answer to Q1 > ] |
+--------------|---------------+
               v
| 2 . WHAT EACH HANDS OVER     |
| ### your team ->             |
|     a deployed app, as is    |
| /// that party ->            |
|     [LOCK] a deployed app,   |
|     exactly as it already    |
|     runs                     |
| one ceiling was recorded and |
| is shown for every party     |
+--------------|---------------+
               v
+==============================+   <- full-bleed, breaks the padding
| 3 . WHERE PARTS ARE JOINED   |
|  ==========================  |
|   - -| an embed URL |- -     |
|  ==========================  |
|  each side crosses on its    |
|  own schedule. Drift is      |
|  structurally possible here. |
|                              |
|  (X) in your build           |
|      ruled out by "A team    |
|      must be able to ship on |
|      its own schedule"       |
|      > 5 approaches compose  |
|        here, and nothing in  |
|        your topology         |
|        separates them.       |
|  (o) request path: a router  |
|      forwards each nav       |
|  (X) request path: a         |
|      composer assembles      |
|      ruled out by "You ship  |
|      files to a CDN"         |
|  (o) in the browser          |
|      > Custom-element comp.  |
|      > Loaded, then mounted  |
|      > Virtualized rehosting |
|      > Separate-document     |
|        embedding        (HF) |
+==============================+
               v
| 4 . WHAT THE USER SEES       |
|  +------------------------+  |
|  | ### your team's page   |  |
|  +------------------------+  |
|            ^ navigate        |
|  +------------------------+  |
|  | //// their page //////  | |
|  +------------------------+  |
|  never on one screen         |
+------------------------------+

ZERO ANSWERS - honest, and still worth looking at

+------------------------------+
| Nothing here is known yet.   |
| Every band is drawn from an  |
| answer you have not given.   |
| 1 . [ ### your team ]        |
|     . who else ships a       |
|     . piece? Not asked yet > |
| 2 . . what each party hands  |
|     . over: not established >|
| 3 . . . . . . . . . . . . .  |
|     the release boundary:    |
|     not yet decided          |
|     (o) in your build        |
|     (o) on the request path  |
|     (o) in the browser       |
|     all three still open     |
| 4 . . one screen, dotted     |
|     . divider. We have not   |
|     . asked whether one      |
|     . screen mixes owners  > |
+------------------------------+
  every dotted box is a button
  that focuses the question
  which would fill it
```

---

## 2.8 What this diagram deliberately does not show, and why

| Refusal | Why |
|---|---|
| **No team count.** Two lanes maximum, plus a ghost strip captioned "however many others there are: you have not told us, and it does not change the verdict". | The assessment asks who owns each piece and never how many. A third real lane would be a fabrication. |
| **No organisational structure.** No reporting lines, no hierarchy, no names, no geography, no seniority, no tree. | The model records who ships a piece and nothing else. Parties sit as peers with no edges between them. |
| **No arrows between parties.** The only arrows are delivery arrows: party to artifact, artifact to composition point, composition point to page. | The assessment never asks who talks to whom. |
| **No per-party difference in the artifact band.** One ceiling is applied to the whole band with the footnote "one modification ceiling was recorded and is shown for every party". | `question.migration.participant-ceiling` is worded per participant and stored as a single select. Differentiating the columns would fabricate a fact. Note the wording avoids "the strictest ceiling you reported", which implies a plurality of reports that never existed. |
| **No claim about the reader's current architecture.** The caption states that the diagram describes constraints reported, not a system anyone observed. | This is the load-bearing honesty decision, taken from the third proposal, which identified it correctly and then undermined it with a before-and-after frame. The assessment never asks what you do today. |
| **No time, no duration, no cost, no effort.** Band order is causation; no band is taller to mean slower. | Adaptation cost and migration distance are absent by FC 5.3 and 5.4. |
| **No precision on the composition point.** When more than one position survives, more than one is drawn as live and the caption says so. It never picks the likeliest. | Under-claiming is the safe direction on a page that documents one of the survivors. |
| **No security language unless earned.** Only `#contain-malice` licenses "attacker". | FC 5.1. |
| **No ownership flip on a maybe.** `#hosts-unmodifiable` inverts the seat; `#credible-ask` renders a distinct "varies per customer" state. | Flipping on a hedge would assert something the reader did not say. `#credible-ask` is `strong-preference`. |
| **No re-statement of the elimination argument.** Struck positions carry only the answer label. | `EliminationCascade` already renders answer to families as a many-to-many relation with the full `consequence`. Duplicating it would imply this diagram is the causal account, which it is not. |
| **No products, vendors or editions.** Composition positions hold family names only. | Same rule as diagram 1. |
| **No family plot anywhere in it.** Chips only, no position within a row, no coordinates, no ordering by number. | The composition rows invite someone to add per-family coordinates or sizes, at which point the collision problem returns in a new costume. The rule has to hold. |
| **No floor entry pinned to a lane.** Floor markers state their `side` in words and group by it, including the blocker tier, but are never assigned to a party. | Outside `question.host.negotiability` the assessment never establishes which seat the reader occupies. Blockers are exactly the entries that must never look negotiable. |

---

# Build order

Ordered so that each step is verifiable before the next one depends on it, and so the
cheapest legibility check happens before any wiring.

### Step 0, before any component. Verify legibility on paper, in the real container.

The cheapest check, in this order, and none of it needs React:

1. **Paste the ASCII sketches into a fixed-width block at 876 px and at 390 px.** The wide
   sketch in 1.7 is authored at 108 columns, which is 876 px at a 8.1 px advance. If the
   sketch overflows, the design overflows, and it is free to find out now.
2. **Build one static HTML page, no React, no data wiring**: the nine-cell grid with hardcoded
   card titles and the four empty-cell sentences, at the three container tiers, in both
   themes. This answers the only question that can sink diagram 1 (does the densest cell hold
   three stacked cards at 228 px) for about an hour of work.
3. **Print it.** The result page is the decision record. If it paginates badly on paper it will
   be rebuilt anyway.
4. **Run the independent corner check.** Show the static page to someone not on this page's
   authoring path and ask one question: which of these nine boxes reads as the recommended
   one? If the answer is the bottom-right cell, the Y inversion did not work and the next
   remedy is to remove C's visual emphasis. Do this before writing any component code, because
   the answer can change the layout.

### Step 1. Engine and data, no rendering.

- Add `alsoEliminatedBy`, `favoredBy` and `inertAnswers` to `EngineResult` in
  `decision-engine.ts`, with unit tests. Nothing renders yet; the existing tests must still
  pass.
- Add `clusterId` to `Family` for the two FC 7 clusters, and the three assembly-locus pole
  labels to `axes`.
- Write `src/lib/decision-bands.ts`: derives the column and row cuts from `families[].position`
  with the 12-point rule as its parameter, and **asserts at module load**, so a failing
  assertion fails the build:
  - exactly two qualifying gaps per axis;
  - every chosen gap is at least twice the largest within-band gap on that axis;
  - every `clusterId` group lands in exactly one cell;
  - no two families share a cell and a depth pole with `dX <= 12` and `dY <= 12` while being
    left unclustered (an un-drawn collision);
  - implementation counts are deduped by id.
  Without these the picture rots invisibly after the next research pass, which is worse than
  rotting loudly.

### Step 2. Diagram 1, static.

Render the grid from the derived bands with no engine state at all: the August 2026 landscape,
all cells live. This is a complete, shippable artifact on its own, and it is what a reader
arriving cold at the page should see. Verify against the counts in 1.3.6 and the occupancy in
1.3.2.

### Step 3. Diagram 1, answer-reactive.

Add the four cell states, struck chips, live counts, the near-miss and tension lines, the
"changed nothing" chip, and the live region. Delete `solution-space-map.tsx`.

### Step 4. Diagram 2, the seam alone.

Build band 3 first and only band 3: the four-state seam plus the three composition positions.
It is the payload, and if the seam does not read at 320 px in greyscale, the rest of the
diagram is not worth building. Verify the two strike cases (`#static-only` strikes one
sub-row; `#crawlable-required` strikes the whole browser position) against the engine.

### Step 5. Diagram 2, the remaining three bands.

Bands 1, 2 and 4, the `answerId -> element` table, the four ownership treatments, the
`answerClass` rail styles, the three divider glyphs, the seat inversion. Write a fixture and a
screenshot for the `#hosts-unmodifiable` branch specifically: it produces a fundamentally
different picture from the same component and it is the state least likely to be exercised in
review.

### Step 6. Shared polish.

Print styles for both, the name filter, the narrow reordering toggle, the provenance rails,
reduced-motion audit, and a contrast pass against both `white` and `slate-950` grounds rather
than one.

### The cheapest legibility verification, restated

Steps 0.1 and 0.2 together are under two hours and they falsify the two claims that carry each
design: that three cards stack legibly in a 228 px column, and that the seam reads without
text at 320 px. Everything after that is wiring. Do not build a component to find out whether
a layout fits: build the layout, at the real container width, with fake strings of the real
lengths (`name` at 16 to 33 characters, answer labels at 37 to 104), and look at it.
