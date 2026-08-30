# Canonical Data Model Proposal

Status: PROPOSED v1 (Phase 7), 2026-08-29. Deliverable 15 (REQ-DATA-01..07,
[MASTER.md](../MASTER.md) sections 12 and 16).

Source authority: REQ-DATA-01..07, REQ-ENGINE-01/02, REQ-REPORT-01..06, REQ-DATA-06's
example ids, and the shapes the phase artifacts already committed to conceptually:
[constraints.md](constraints.md) 1.4 (binding record), [state-transition.md](state-transition.md)
section 2 (septet record), [enterprise-layer.md](enterprise-layer.md) section 2 (edition
record), [../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md)
section 1 (version surfaces; that file names this one as owner of the concrete fields),
[../matrix/README.md](../matrix/README.md) (value vocabulary and per-verdict provenance,
already shipped as data in [../matrix/](../matrix/)).

Scope rule: this file defines shapes and their guards. The *content* of every entity lives
in the phase artifacts it cites; nothing is restated here beyond what an example needs
(REQ-OPS-03). Where the model docs said "schema authority stays with schema-proposal.md",
this file is that authority. Where this proposal and a model doc's conceptual sketch
differ in field spelling, this file wins; no sketch differs in meaning.

Location caveat (REQ-ORCH-13): file paths named below describe the dataset's *shape and
split*, not its permanent home; the tracked-source location is a production-time decision.

---

## 1. Representation decision (REQ-DATA-02)

### 1.1 What each consumer actually demands

Consumers per REQ-DATA-01, checked against the docs-site capability inventory:

| Consumer | Demand on the format |
|---|---|
| Interactive docs page | Next 15 static export; per-user computation fully in browser; the proven loading pattern is a client island lazily fetching **static JSON** once per page life (search-index precedent). No server, no API routes. |
| Questionnaire + report engine | Deterministic browser-side evaluation (REQ-REPORT-01); wants compile-time types over the data; must run offline; fixtures assert on its data (REQ-TEST-01, vitest in docs-site). |
| Architect matrix view | 6,600 verdicts already exist as validated JSON (the assembled matrix, 1.4MB); needs lazy, filterable loading, so the canonical form must split or be splittable per group/unit. |
| Static docs pages | Build-time generation pipeline exists (`scripts/generate-docs.ts`, remark md-to-HTML); pages are generated from data at build, never hand-synced. |
| Future CLI | Must parse the dataset without executing JavaScript. |
| HF AI assistant + external LLM agents | REQ-DATA-02 explicitly requires transformability to Markdown; REQ-LLM-01 requires they query the same model, not a paraphrase. |
| Automated report generation | Emits a re-importable JSON export recording versions (REQ-REPORT-05); import validates schema version. |

### 1.2 Candidate formats against the workspace reality

- **JSON** (canonical: ADOPTED). Every consumer above parses it natively; the island
  pattern, the matrix files, the `assemble.mjs` validate-before-write loop, and the
  re-importable export all already speak it. Supports no comments and no logic, which is
  a feature here: REQ-ENGINE-01 forbids imperative branching in the data, and a format
  that cannot hold code cannot hide code.
- **TypeScript data modules** (REJECTED as store, ADOPTED as type layer). A `.ts` data
  file requires executing JS to read, which excludes the CLI-in-any-language and
  plain-Markdown consumers, and it invites logic into data. But TS *types* over the JSON
  give the engine and UI compile-time safety for free in this workspace. Decision: types
  in one module (section 3), data in JSON conforming to them.
- **YAML** (REJECTED). The workspace's only YAML parser is js-yaml pinned to 4.3.1 via
  overrides specifically to work around a crash, with a "flat quoted frontmatter only"
  operating restriction already in force. Adopting YAML for deeply nested engine data
  would build the canonical dataset on the workspace's most fragile parser for zero
  capability gain over JSON.
- **MDX frontmatter** (REJECTED). The content pipeline has **no MDX at all**; guides are
  plain `.md` plus gray-matter, and frontmatter is restricted to flat quoted keys.
  Frontmatter also inverts the ownership: it makes prose the container and data the
  passenger, while REQ-DATA-01 says the dataset is the product and pages are interfaces.
- **Combination** (ADOPTED, in one direction only): JSON is canonical; Markdown and TSV
  are **generated projections** of it; TS is the schema layer. Prose research artifacts
  (dossiers, model docs) remain Markdown and are referenced *by* the data as evidence and
  documentation targets, never parsed as data.

### 1.3 The decision

1. **Canonical store: JSON collections**, one file per entity kind (section 7), each
   wrapped in the version envelope (section 2.5), validated by a Node script in the
   `assemble.mjs` mold that exits non-zero before an invalid dataset can be written.
2. **Schema layer: TypeScript types** (the shapes in section 3, kept in one
   `schema.ts`), from which a JSON Schema is generated for the validator and for
   non-TS consumers. `version.schema` (SemVer) versions both together.
3. **Projections, all generated, never hand-edited**: Markdown (section 1.4), the
   compact TSV ([../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) pattern),
   and any per-page JSON splits the UI needs. Generation is deterministic; running an
   emitter twice yields byte-identical output (fixpoint check, same stance as the
   versioning flow's parse/serialize fixpoint).
4. **Prose model docs stay Markdown** and become the *documentation* of the data: each
   JSON record carries a `doc` locator into the file and section that argues for it, so
   an architect can walk from any record to its reasoning (REQ-FRAME-02).

### 1.4 Markdown transformability path (REQ-DATA-02, REQ-LLM-01)

- One emitter per collection (`emit-md.mjs`): deterministic ordering by id; one heading
  per entity with a stable anchor equal to its id (per-symbol server-rendered anchors are
  the proven docs-site pattern); scales and short records as tables; full records as
  fenced `jsonc` blocks; cross-references as relative links.
- One bundle target (`model-bundle.md`) concatenating collections in layer order
  facts -> implications -> rules (section 5), so an LLM ingests the same chain the
  engine evaluates (REQ-ORCH-08) and never a separate methodology (REQ-LLM-01).
- [../matrix/attributes.md](../matrix/attributes.md) is the precedent and the first
  migration: its hand-maintained merged/renamed appendix becomes `redirects.json`
  (section 3.3) and the file becomes a generated projection of `attributes.json`.

---

## 2. Schema conventions (apply to every entity)

### 2.1 Identifier discipline (REQ-DATA-06)

- **Grammar**: `<namespace>.<segment>` or `<namespace>.<segment>.<segment>`, lowercase,
  kebab-case segments, dot-separated. Examples fixed by guidance:
  `runtime.shared-js-realm`, `isolation.document-boundary`, `ownership.external-participant`.
- **Namespace registry** (closed; extending it is a `version.schema` MINOR):
  `unit` `composition` `buildtime` `runtime` `isolation` `security` `framework`
  `contracts` `ssr` `ux` `performance` `deployment` `migration` `ownership` `operations`
  (the 15 attribute groups); `dimension` `family` `impl` `alias` `cluster`;
  `constraint` `class` `scope` `derive` `rel` `dominance` `gap`;
  `question` `answer` `edge` `stage` `rule` `predicate`;
  `topology` `state` `transition` `buyin` `fit` `trust`;
  `avail` `attach` `governance` `hosting` `identity` `contract` `registry` `commerce`
  `operability` `dx`;
  `report` `status` `export` `storage` `lead` `framing` `engine`;
  `version` `record` `source` `resume` `decay` `staleness` `cadence` `refresh`;
  `realm` `time` `locus` `granularity` `orchestration` `deps` `roster` `actuation`
  `trust-scale` `scenario`.
- **Identity is permanent**: wording, phrasing, and notes may change (a `version.model`
  PATCH); an id never changes meaning and is never reused. A rename or merge creates an
  `IdRedirect` record (3.3) and keeps the old id resolvable forever, so historical
  reports and exports never dangle (REQ-REPORT-06).
- **Unit vs implementation ids**: `unit.<slug>` names a matrix comparison column (30
  units, slugs as in [../matrix/columns/](../matrix/columns/));
  `impl.<slug>` names a catalogue entry ([implementations.md](implementations.md));
  `impl.<slug>.<edition>` names an edition. Adoptable implementations map 1:1 to their
  unit; strategy and baseline units have no `impl.*` record by design (they are family
  substance, REQ-KEYTEST-01).

### 2.2 The provenance envelope (REQ-DATA-05)

The pattern shipped in the matrix columns, generalized to every fact-bearing field:

```ts
type IsoDate = string;                       // "2026-08-28"
type VerdictValue = "yes" | "no" | "conditional" | "na" | "unknown";
type ClaimType =
  | "framework-guarantee" | "browser-guarantee" | "common-pattern"
  | "possible-extension" | "officially-supported" | "community-convention"
  | "inference";                             // REQ-MATRIX-05 ladder, closed
type ConfidenceLevel = "high" | "medium" | "low";

/** A section title in the owning record's dossier, a dossier source key
 *  ("E5"), or an absolute URL. The validator resolves the first two against
 *  the dossier file named by the owning record. */
type EvidenceRef = string;

interface Provenance {
  claimType: ClaimType;
  confidence: ConfidenceLevel;
  evidence: EvidenceRef[];                   // non-empty
  verifiedAt?: IsoDate;                      // defaults to owning record's verifiedAt
  supersedes?: SupersededValue[];            // prior values, never erased (refresh play 2.5)
}

interface Fact<T> extends Provenance {
  value: T;
  condition?: string;                        // REQUIRED iff value === "conditional"
  note?: string;
}

interface SupersededValue {
  value: unknown;
  condition?: string;
  supersededAt: IsoDate;
  reason: string;                            // retraction, contradiction, stronger source...
  evidence: EvidenceRef[];                   // what the old value rested on
}
```

Every field documented below as `Fact<...>` carries this envelope; the model can always
answer "why does the framework believe this?" at field granularity.

### 2.3 Value vocabulary (REQ-MATRIX-02)

`yes | no | conditional | na | unknown`, lowercase, closed. `conditional` MUST carry a
`condition` string (edition, mode, or "varies by implementation" for strategy units).
`na` means the attribute genuinely does not apply to that kind of unit. `unknown` is
honest ignorance, never a guess. Absent fields read as `unknown` (REQ-ORCH-10 tolerance;
versioning-strategy 2.7 additive-evolution rule).

### 2.4 Record dating block (REQ-DATA-07; `record.dates` surface)

```ts
interface RecordDates {
  researchedAt: IsoDate;                     // when the record was first researched
  verifiedAt: IsoDate;                       // when its claims were last re-verified
  lastReviewed: IsoDate;                     // last look, even if nothing changed
  statusAtResearch?: Id;                     // avail.* at research time (unit-like records)
}
```

Every implementation, family, evidence, and gap record carries one. Staleness is derived
from these dates against the decay policy (3.22), never hand-set.

### 2.5 Collection envelope (version surfaces on disk)

```ts
interface Collection<E> {
  schemaVersion: string;                     // version.schema (SemVer)
  modelVersion?: string;                     // version.model (SemVer); model-layer collections only
  researchSnapshot: string;                  // version.research: "YYYY.MM.rev"
  generated: IsoDate;
  layer: Layer;                              // section 5
  entities: E[];
}
```

The shipped matrix files (schemaVersion `0.1.0`) already carry `schemaVersion`,
`researchSnapshot`, `generated`; adding `layer` and widening `researchSnapshot` from
`"2026-08"` to `"2026.08.0"` are additive pre-1.0 changes and land with this schema's
first assembly pass (migration note, section 6.2).

### 2.6 Documentation locator

```ts
type DocRef = string;   // "families.md#3.4", "constraints.md#6.3", "../ux/report-design.md#5"
```

Machine-checkable (file exists, section exists); keeps prose and data linked without
duplicating either (REQ-OPS-03).

---

## 3. Entity catalogue

Types are normative; JSON data conforms to them. Each subsection names the artifact that
owns the content today.

### 3.1 Meta record and version surfaces

One `meta.json` holding the surfaces of
[versioning-strategy.md](../maintenance/versioning-strategy.md) section 1:

```ts
interface Meta {
  schemaVersion: string;                     // version.schema
  modelVersion: string;                      // version.model
  researchSnapshot: string;                  // version.research "YYYY.MM.rev"
  corpusLastReviewed: string;                // "YYYY-MM" user-facing claim (strategy 4.1)
  stalenessPolicies: StalenessPolicy[];      // 3.22; thresholds are data, not code
  schemaChangelog: { version: string; note: string; migration?: string }[];
}
```

### 3.2 Sources and evidence records

Content today: `## Sources` lists in every dossier under
[../research/solutions/](../research/solutions/) (keys E1, E2, ...), plus the
resumability contract (strategy section 5).

```ts
interface SourceRecord {                     // source.dates surface
  key: string;                               // "E5", unique within its dossier
  locator: string;                           // URL
  title: string;                             // what it is / what it evidences
  sourceType: ClaimType;                     // position on the REQ-MATRIX-05 ladder
  retrievedAt: IsoDate;                      // source.retrievedAt
  reviewedAt?: IsoDate;                      // source.reviewedAt
  supersededAt?: IsoDate;                    // never deleted; marked superseded
  supersededReason?: string;
}

interface ResumabilityBlock {                // REQ-ORCH-09; strategy section 5
  researched: Id[];                          // resume.researched: record + attribute ids covered
  sources: SourceRecord[];                   // resume.sources + resume.dates
  claims: { claim: Id; supportedBy: string[] }[];   // resume.claims (source keys)
  uncertainties: { id: Id; value: "unknown" | "conditional"; reason: string }[];
  followups: string[];                       // resume.followups, 5-10 minute sized
  sessionDate: IsoDate;
}
```

Every research unit (solution record, matrix column, sweep) embeds one
`ResumabilityBlock` so a refresh session starts cold (strategy 3.1 step 1).

### 3.3 Attributes and id redirects

Content today: [../matrix/attributes.json](../matrix/attributes.json) (220 attributes,
15 groups) and the merged/renamed appendix of attributes.md.

```ts
interface AttributeGroup { key: string; title: string; attributes: Attribute[]; }

interface Attribute {
  id: Id;
  question: string;                          // atomic, mechanically decidable (REQ-MATRIX-03)
  notes?: string;
  scaleRef?: Id;                             // scale-valued rows only: names the Scale whose
                                             // level id the verdict carries (3.16)
}

interface IdRedirect {                       // the attributes.md appendix, as data
  id: Id;                                    // the retired id
  canonical: Id;                             // the surviving id
  inverted?: boolean;                        // merged with opposite polarity: flip yes/no
  mergedAt: IsoDate;
  reason?: string;
}
```

`scaleRef` legitimizes the two scale-valued rows (`migration.participant.min-level`,
`migration.host.min-level`) that currently smuggle their scale id through `condition`;
see the verdict shape below and the migration note (6.2).

### 3.4 Verdicts, unit columns, matrix

Content today: [../matrix/columns/](../matrix/columns/) (30 files), assembled on demand by
`assemble.mjs --json`; the assembled file is generated, never committed.

```ts
interface Verdict extends Fact<VerdictValue> {
  id: Id;                                    // attribute id
  scaleLevel?: Id;                           // scale-valued rows: e.g. "migration.bundler-change"
}

interface UnitColumn {
  unit: Id;                                  // unit.<slug> (bare slug grandfathered at 0.1.0)
  dossier: string;                           // "research/solutions/wujie.md"
  verifiedAt: IsoDate;                       // column-level default for verdict.verifiedAt
  resumability?: ResumabilityBlock;
  verdicts: Verdict[];                       // one per attribute; absent = unknown
}
```

The assembled matrix is `Collection<UnitColumn>` plus `attributeCount`, `unitCount`,
`attributesRef` exactly as shipped. The matrix is the **facts** layer's core (section 5).

### 3.5 Dimensions

Content today: [taxonomy.md](taxonomy.md) sections 2.1-2.12 (twelve dimensions).

```ts
interface DimensionPole { id: Id; meaning: string; units: Id[]; }

interface CausalChain {                      // REQ-DIM-02; implications layer
  premise: string;                           // "Shared realm"
  consequence: string;                       // what follows, prose with embedded `attribute.ids`
  attributes: Id[];                          // the cells that evidence the chain
  posture: string;                           // when this pole is attractive / acceptable
}

interface Dimension {
  id: Id;                                    // dimension.runtime-realm
  title: string;
  definition: string;
  scale: DimensionPole[];                    // ordered (e.g. by boundary strength)
  explains: Id[];                            // attribute ids this dimension claims
  dualLoaded?: { attribute: Id; sharedWith: Id }[];   // taxonomy 3.4 honesty
  causalChains: CausalChain[];
  doc: DocRef;
}
```

Prose fields may embed backticked ids; the validator extracts and resolves every embedded
id (the model docs already write them this way, so transcription is mechanical, not
interpretive).

### 3.6 Families

Content today: [families.md](families.md) sections 3 and 5 (7 MFE + 5 baseline), field
set fixed by REQ-FAM-02.

```ts
interface FamilyMembershipRef { family: Id; condition?: string; }

interface Family {
  id: Id;                                    // family.module-graph-federation
  canonicalName: string;
  plainEnglishName: string;
  definition: string;
  compositionBoundary: string;
  integrationPhase: (Id | { pole: Id; condition: string })[];   // time.* poles
  executionModel: Id[];                      // realm.*, locus.*, granularity.*, orchestration.*
  ownershipAssumptions: string;
  coordinationAssumptions: string;
  isolationCharacteristics: string;
  deploymentCharacteristics: string;
  migrationRequirements: { participantFloor: Id; hostFloor: string };
  advantages: string[];
  inherentCosts: string[];
  hardLimitations: string[];
  worksWell: string[];
  worksPoorly: string[];
  relatedFamilies: { family: Id; distinguishedBy: string }[];
  representativeImplementations: Id[];       // deletable without incoherence (REQ-KEYTEST-01)
  brandAliases?: Id[];                       // alias.* resolving here
  attachedLayers?: Id[];                     // delivery overlays, never members (families 6.1)
  baseline: boolean;                         // section 5 group (the REQ-Q-04 outcomes)
  dates: RecordDates;
  doc: DocRef;
}
```

### 3.7 Implementations, editions, capability attachments

Content today: [implementations.md](implementations.md) (19 + layers + graveyard),
[enterprise-layer.md](enterprise-layer.md) section 2.

```ts
type UnitType = "product" | "framework" | "library" | "platform-capability" | "strategy";
type AvailabilityState =                     // avail.*, REQ-AVAIL-01, closed
  | "avail.available" | "avail.available-immature" | "avail.announced-planned"
  | "avail.future-roadmap" | "avail.deprecated" | "avail.inactive" | "avail.unavailable";
type AttachLevel = "attach.family" | "attach.implementation" | "attach.edition";

interface CapabilityAttachment {
  capability: Id;                            // one atom: governance.rbac, hosting.artifacts...
  attach: AttachLevel;
  availability: AvailabilityState;           // REQUIRED; planned never satisfies a binding
  evidence?: EvidenceRef[];
}

interface Edition {
  id: Id;                                    // impl.hyperfrontend.enterprise
  type: "community" | "commercial";
  availability: AvailabilityState;
  capabilities: CapabilityAttachment[];      // attach.edition items live here
}

interface Implementation {
  id: Id;                                    // impl.<slug>
  unit?: Id;                                 // its matrix column, when it has one
  unitType: UnitType;                        // REQ-SCOPE-04, explicit per entry
  families: (FamilyMembershipRef & { role: "member" | "mode-forked" | "layer" })[];
  availability: { subject: Id | "core"; state: Fact<AvailabilityState> }[];  // per line/edition
  maturity: Record<Id, Fact<VerdictValue>>;  // unit.maintenance.*, unit.license.*, adoption cells
  editions: Edition[];                       // may be empty (no commercial tier)
  implementationCapabilities: CapabilityAttachment[];   // attach.implementation items
  differsFromNeighbors: string;              // REQ-Q-09 second-level discriminator
  graveyard?: boolean;                       // narrative illustration only (REQ-SCOPE-03)
  dossier: string;
  dates: RecordDates;                        // statusAtResearch used here
  doc: DocRef;
}
```

Guards baked into the shape: a capability attaches at exactly one level; edition-only
capabilities cannot appear at implementation level (validator, 5.3); no composite
`enterpriseReady`-style boolean exists anywhere (REQ-ENT-07).

### 3.8 Brand aliases

Content today: [implementations.md](implementations.md) section 3,
[families.md](families.md) 6.2.

```ts
interface BrandAlias {
  id: Id;                                    // alias.nx-mfe
  brandPhrases: string[];                    // "Nx microfrontends"
  resolvesTo: { family: Id | null; condition?: string; note?: string }[];  // null = no first-party story
  wrapperAdds: string;                       // DX/operational surface, never the boundary
  statusCaveat?: string;
  dates: RecordDates;
}
```

### 3.9 Constraints and bindings

Content today: [constraints.md](constraints.md) sections 1-2 (the ~45 constraint
definitions) and 1.4 (the binding shape, adopted here verbatim with types).

```ts
type ConstraintClass =                       // class.*, REQ-Q-02, closed
  | "class.hard-constraint" | "class.strong-preference"
  | "class.weak-preference" | "class.irrelevant-by-default";
type ConstraintScope = "scope.family" | "scope.implementation" | "scope.edition";

interface ConstraintDef {
  id: Id;                                    // constraint.participant-modification-ceiling
  scope: ConstraintScope;                    // what a hard form may eliminate (firewall input)
  statement: string;                         // what holding it means, mechanically
  classCeiling?: ConstraintClass;            // e.g. "default strong, ceiling hard" constraints
  eliminationEvidence: { candidates: Id[]; basis: string; attributes: Id[] }[];
  doc: DocRef;
}

interface ConstraintBinding {                // constraints.md 1.4, engine data
  constraint: Id;
  subject: string;                           // "global" | "host" | "participant:<label>"
  class: ConstraintClass;
  params?: Record<string, Id | string | boolean>;    // e.g. { maxLevel: "migration.integration-adapter" }
  slot: "state.current" | "state.target";    // section 5 rules decide target eligibility
  origin: Id[];                              // "answer:<question-id>" entries and derive.* ids
  provenance?: Provenance;                   // when bound from an observed fact
}
```

### 3.10 Derive rules

Content today: [constraints.md](constraints.md) section 3 (15 rules).

```ts
interface FactPremise { fact: Id; subject?: string; value: string; }
interface PremiseGroup { all?: (FactPremise | PremiseGroup)[]; any?: (FactPremise | PremiseGroup)[]; }

interface DerivedEffect {
  action: "bind" | "reclass";
  constraint: Id;
  subject?: string;
  class?: ConstraintClass;                   // for bind
  reclassTo?: ConstraintClass;               // for reclass (derive.single-coordinated-team)
  params?: Record<string, Id | string | boolean>;
  mode?: "entailed" | "confirm";             // per-effect override of the rule mode
}

interface DeriveRule {
  id: Id;                                    // derive.unmodifiable-participant-floor
  premises: PremiseGroup;
  derives: DerivedEffect[];
  mode: "entailed" | "confirm" | "mixed";    // confirm = prior needing a question before hard
  doc: DocRef;
}
```

Composition semantics stay in the engine spec (strictest class per subject wins; every
binding keeps its `origin` chain), not in the data.

### 3.11 Relations between constraints

Content today: [constraints.md](constraints.md) section 4. Exclusions are landscape
facts with cited evidence, not logic; a future unit can dissolve them.

```ts
interface Relation {
  id: Id;                                    // rel.excludes.distinct-principal--payload-dedup
  type: "rel.requires" | "rel.excludes" | "rel.relaxes";
  from: { constraint: Id; class?: ConstraintClass; negated?: boolean }[];   // conjunction (3-way exclusions exist)
  to: Id[];                                  // required set / excluded constraint / relaxed constraints
  toAlternatives?: boolean;                  // rel.requires "one of" form
  basis: { statement: string; attributes?: Id[]; evidence?: EvidenceRef[] };
  gapSeed?: Id;                              // gap.* emitted when the from+to set is jointly hard
  doc: DocRef;
}
```

Relation id scheme: `rel.<type-slug>.<from-slug>--<to-slug>` with the `constraint.`
prefixes dropped; ids exist so gap records and reports can cite the exact relation.

### 3.12 Dominance rules

Content today: [question-graph.md](question-graph.md) section 2.

```ts
interface DominanceRule {
  id: Id;                                    // dominance.fused-baselines-over-mfe
  conditions: (Id | { question: Id; answer: Id })[];   // fired derive.* rules and/or answers
  dominated: Id[];                           // families/impls offering no remaining advantage
  dominator: Id[];
  rationale: string;
  matrixVerification: { attribute: Id; expectation: string }[];   // quoted-cell checks
  skips: Id[];                               // question ids suppressed while active
  doc: DocRef;
}
```

Dominance is not elimination: dominated candidates stay in the survivor set; applied
rules are disclosed in the report with their conditions (REQ-REPORT-02); a withdrawn
condition dissolves the dominance (engine semantics, data unchanged).

### 3.13 Questions and answers (REQ-DATA-03)

Content today: [questions.md](questions.md) sections 3-7 (16 family-stage + trajectory
battery + 6 implementation-stage + edition block + guards).

REQ-DATA-03's conceptual fields map as: text -> `phrasings`; explanation -> `why`;
audience -> both, via the dual phrasing (REQ-AUD-01); dimension -> `exposes`;
answerType/answers -> `answerType`/`answers`; prerequisites and followUpQuestions ->
graph edges (3.14, relevance is owned there); implications/exclusions -> answer
`binds`/`entails` plus `rel.*`; preferences -> answer `class`.

```ts
interface AnswerOption {
  id: Id;                                    // answer.deploy-independence.no-shared-train
  statement: string;                         // the answer as the user gives it
  class: ConstraintClass;                    // classification discipline (questions.md 1.4)
  binds?: DerivedEffect[];                   // bindings this answer produces directly
  entails?: Id[];                            // derive.* whose premises this answer satisfies
  maxClass?: ConstraintClass;                // facet ceilings (value facets never exceed strong)
}

interface QuestionFacet {                    // REQ-STATE-03 splits, e.g. rank 2's triple
  id: Id;                                    // question.deploy.independence.value
  kind: "fact" | "desirability" | "readiness";
  phrasing?: string;
  maxClass?: ConstraintClass;                // desirability: class.strong-preference ceiling
}

interface Question {
  id: Id;
  stage: Id;                                 // stage.family | stage.implementation | stage.edition
  rank?: number;                             // ordering within the ranked index; not a score
  why: string;
  exposes: Id[];                             // dimension ids
  phrasings: { architect: string; circumstance: string };
  answerType: "choice" | "boolean" | "scale-level" | "free-fact";
  scaleRef?: Id;                             // answerType "scale-level" (rank 4 uses migration scale)
  answers: AnswerOption[];
  facets?: QuestionFacet[];
  gain: { guaranteed: string; max: string }; // structural gain statements, never numbers-as-scores
  gating: string;                            // human summary; edges are authoritative for relevance
  audit: string[];                           // anti-steering audit findings ("B1", "B4")
  doc: DocRef;
}
```

Unanswered questions bind nothing (`rule.unanswered-inert`); that is engine semantics
over this data, restated here only because the shape enforces its precondition: no
answer option may carry `class` defaults, every classification is explicit.

### 3.14 Graph edges and stages

Content today: [question-graph.md](question-graph.md) sections 1, 3, 5.

```ts
type EdgeType = "edge.spine" | "edge.unlocks" | "edge.prunes" | "edge.warns" | "edge.forks";

interface GraphEdge {
  type: EdgeType;
  from: Id;                                  // question id (or stage id for spine entries)
  onAnswer?: Id | string;                    // answer id, or condition text for derived conditions
  to: Id[];
  basis: Id[];                               // derive.*, rel.*, dominance.* grounding the edge
  warning?: Id;                              // edge.warns: the gap.* surfaced at ask time
}

interface Stage {
  id: Id;                                    // stage.family, stage.implementation, stage.edition, stage.report
  nodes: Id[];
  mayBind: ConstraintScope[];                // the firewall, as data
  firewall: string;                          // what cannot happen here, quoted from the graph doc
}
```

The graph is a graph, not a tree: multiple in-edges per node are legal; two edges to one
node may disagree about relevance, never about content (content lives once, in 3.13).

### 3.15 Topologies and ownership facts

Content today: [topology.md](topology.md) sections 2 and 3.

```ts
interface Topology {
  id: Id;                                    // topology.acquisition
  title: string;
  definition: string;
  ownershipEvidence: Id[];                   // ownership.* facts that are evidence for it
  coordination: string;
  trust: string;
  hardTendencies: string;                    // pressures, hard-constraint tendencies
  preferenceTendencies: string;
  signatureConsequence: string;
  derives: Id[];                             // derive.* this topology's facts typically fire
  followUps: Id[];                           // question ids unlocked
  dates: RecordDates;
  doc: DocRef;
}

interface OwnershipFactDef {                 // the REQ-MIG-02 checklist rows
  id: Id;                                    // ownership.host-unmodifiable-participant
  situation: string;                         // circumstance phrasing (REQ-AUD-01)
  primaryEvidenceFor: Id[];                  // topology ids
  alsoConsistentWith: Id[];
}
```

Answered instances are `{ fact: Id; subject?: string; value: Fact<VerdictValue> }`;
topology labels are inferred and confirmed (`question.topology.confirm`), never asked;
every fact takes the current/target pair of 3.17 ("multi-repo today, monorepo approved
for Q3" is two answers).

### 3.16 Scales and ordinals

Content today: [migration.md](migration.md) section 2 (levels 0-9),
[state-transition.md](state-transition.md) section 3 (ordinals 0-7). The ordinal is part
of the identity so the engine can compare; this is the ONLY sanctioned numeric-ordering
construct in the dataset (see the no-scores guard, 5.2).

```ts
interface ScaleLevel {
  ordinal: number;                           // position; equals array index (validated)
  id: Id;                                    // migration.bundler-change, transition.confidence.teams-committed
  definition: string;                        // mechanical definition
  notes?: string;                            // example work, preconditions
}

interface Scale {
  id: Id;                                    // scale.migration-appetite, scale.transition-confidence
  ordered: true;
  levels: ScaleLevel[];
  doc: DocRef;
}
```

### 3.17 State septets, buy-in signals, credibility predicate

Content today: [state-transition.md](state-transition.md) sections 2-4.

```ts
interface StateSeptet {                      // per dimension, per subject; REQ-STATE-01
  dimension: Id | string;                    // taxonomy dimension id or named org dimension
  subject?: string;
  state: {
    current: Fact<string>;                   // a fact, with provenance
    target?: { value: string; statedAt: IsoDate };   // an aspiration: dated, NOT a Fact
  };
  transition?: {                             // absent when target === current or none named
    willingness: string;
    cost: string | Id[];                     // migration.* level span for code dimensions
    authority: string;
    confidence: Id;                          // transition.confidence.* (scale 3.16)
    horizon: string;
  };
}

interface BuyinRecord {                      // REQ-STATE-05; one per assessed transition
  subject: string;
  signals: Record<Id, Fact<"yes" | "no" | "partial">>;   // the nine buyin.* ids
}

interface CredibilityPredicate {             // predicate.target-credible, as data
  id: "predicate.target-credible";
  minConfidenceOrdinal: number;              // 5 (teams-committed)
  altPath: {
    confidenceOrdinal: number;               // 4 (leadership-approved)
    requiredSignals: { all: Id[]; anyOf: Id[] };   // all: [buyin.budget], anyOf: [buyin.timeline, buyin.staffing]
  };
  authority: "held-or-engaged";
  horizonRule: "within-decision-horizon";
  robustnessFactor: number;                  // 3 (the 3x probe)
}
```

The septet's `state.target` is deliberately not a `Fact`: aspirations have no claimType
ladder position and must never be silently promoted (REQ-STATE-04,
`rule.no-target-satisfies-hard`). The predicate ships as one data record so recalibration
(a Phase-6-style gate) edits data, not engine code.

### 3.18 Capability atoms (enterprise layer)

Content today: [enterprise-layer.md](enterprise-layer.md) sections 3-8: the nine
`governance.*` atoms, seven `hosting.*` atoms, seventeen `identity.*` atoms, nine
`contract.*` atoms, three `registry.*` atoms, `commerce.*`, `operability.*` seeds,
`dx.ai-dev-assist`.

```ts
interface CapabilityAtomDef {
  id: Id;
  group: "governance" | "hosting" | "identity" | "contract" | "registry" | "commerce" | "operability" | "dx";
  covers: string;
  distinctBecause?: string;                  // why it is not foldable into a sibling
  matrixRow?: Id;                            // when promoted to a dedicated attribute row
  doc: DocRef;
}
```

Atoms are independent and atomic (REQ-ENT-07); positions on them are taken via
`CapabilityAttachment` (3.7) and matrix verdicts, never via composites.

### 3.19 Scenario fixtures

Content today: [../scenarios/](../scenarios/) (9 briefs; four-section anatomy from its
README).

```ts
interface NormalizedInput {
  input: Id | string;                        // stable id where one exists
  subject?: string;
  value: string;
  marking: "observed-fact" | "hard-constraint" | "strong-preference" | "weak-preference" | "label";
}

interface Guardrail {
  statement: string;                         // inviolable sanity check, never a predicted winner
  mayExercise: Id[];                         // trust.* outcome classes (REQ-TRUST-01 vocabulary)
}

interface ScenarioFixture {
  id: Id;                                    // scenario.acquisition-no-rewrite
  topology: Id;
  situation: string;                         // FROZEN once written (fixture integrity rule)
  normalizedInputs: NormalizedInput[];       // re-derivable as the model evolves
  septets?: StateSeptet[];
  guardrails: Guardrail[];                   // change only when guidance changes
  trace?: {                                  // Phase 8 output
    tracedAt: IsoDate;
    modelVersion: string;
    researchSnapshot: string;
    outputs: EngineOutputs;                  // 3.21
    guardrailResults: { statement: string; pass: boolean; note?: string }[];
  };
}
```

### 3.20 Gap records and the relaxation ledger

Content today: [constraints.md](constraints.md) 6.1-6.3 (the seed);
`positioning/market-gaps.md` will instantiate these shapes.

```ts
interface GapRecord {                        // REQ-GAP-02 field set, extended
  gapId: Id;
  constraints: { constraint: Id; class: "class.hard-constraint"; params?: Record<string, string> }[];
  discoveredFrom: Id[];                      // rel.* ids, scenario ids, or assessment references
  currentCandidates: Id[];                   // possibly empty; strong-preference-form candidates listed
  unmetCapabilities: Id[];                   // attribute and/or capability-atom ids
  classification:
    | "gap.class.expandable"                 // where Community/Enterprise could expand
    | "gap.class.better-positioned-family"   // another family is better positioned
    | "gap.class.inherently-contradictory";  // contradictory under current platform primitives
  classificationNote?: string;
  dates: RecordDates;                        // reviewed on the annual cadence
}

interface RelaxationRow {                    // constraints.md 6.1, as data
  constraint: Id;
  params?: Record<string, string>;
  eliminates: Id[];                          // verified against ConstraintDef.eliminationEvidence
  relaxation: string;                        // the smallest meaningful relaxation
  reopens: { candidate: Id; consequences: string }[];   // named from family inherent costs
  doc: DocRef;
}
```

Ordering of offers (`rule.relaxation-ordering`) is engine data referencing these rows;
not every gap is a HyperFrontend roadmap item, which is why `classification` is a closed
enum and not a routing flag.

### 3.21 Assessments and reports

Content today: [../ux/report-design.md](../ux/report-design.md) (sections, statuses,
exports, storage) and REQ-ENGINE-01's output list.

```ts
type MatchStatus =                           // status.match.*, closed
  | "status.match.strong" | "status.match.viable" | "status.match.conditional"
  | "status.match.weak" | "status.match.incompatible" | "status.match.future-potential";
type AssessmentStatus =
  | "status.assessment.insufficient-information" | "status.assessment.no-current-strong-match";
type FitFlag = "fit.architectural" | "fit.organizational" | "fit.operational" | "fit.transition-dependent";

interface CandidateResult {
  candidate: Id;                             // family.* / impl.* / impl.*.<edition>
  status: MatchStatus;
  condition?: string;                        // REQUIRED for conditional and future-potential
  fit: Record<FitFlag, { holds: boolean | "conditional"; because: Id[] }>;  // independent, never blended
  pairedAvailableToday?: Id;                 // REQUIRED for future-potential (REQ-AVAIL-02)
  dependsOnTransitions?: { dimension: string; confidence: Id }[];
}

interface Exclusion { candidate: Id; violated: Id[]; origin: Id[]; }   // binding + origin chain

interface DerivationLine {                   // report.trace.derivation-block, as data
  conclusion: string;
  kind: "requirement-satisfied" | "tradeoff-accepted" | "derived-from";
  ref: Id;                                   // fact / implication / constraint / question id
  display?: string;                          // 'Q04 -> "No host rebuild"'
}

interface EngineOutputs {                    // REQ-ENGINE-01, verbatim key set + report needs
  satisfiedConstraints: ConstraintBinding[];
  violatedConstraints: ConstraintBinding[];
  inferredRequirements: ConstraintBinding[]; // the derive.* products
  candidateStrategies: CandidateResult[];
  excludedStrategies: Exclusion[];
  candidateImplementations: CandidateResult[];
  unresolvedQuestions: { question: Id; couldStillChange: string }[];
  tradeoffs: { candidate: Id; gained: string[]; sacrificed: string[]; refs: Id[] }[];
  slots: {
    bestToday: CandidateResult[];            // always produced (REQ-STATE-02)
    bestAfterTransition?: CandidateResult[]; // credible targets only, or warning-annotated
  };
  assessmentStatus?: AssessmentStatus;
  dominanceApplied: { rule: Id; conditions: string[] }[];
  gapRecords: GapRecord[];
  relaxationOffers: { order: number; row: RelaxationRow }[];
  counterfactuals: { candidate: Id; wouldBecome: MatchStatus; if: string; refs: Id[] }[];  // REQ-Q-07
  derivation: DerivationLine[];              // full graph; always present in JSON export
}

interface Assessment {                       // report.versioning + REQ-REPORT-05/06
  createdAt: IsoDate;
  schemaVersion: string;                     // version.schema of this export
  decisionModelVersion: string;              // version.model (pinned pair, half 1)
  researchSnapshotVersion: string;           // version.research (pinned pair, half 2)
  label?: string;                            // local-only; never transmitted (REQ-LOCAL-02)
  answers: { question: Id; facet?: Id; answer: Id | string; tense?: "current" | "future" }[];
  bindings: ConstraintBinding[];
  outputs: EngineOutputs;
  reassessedFrom?: {                         // deliberate reassessment records BOTH pairs
    createdAt: IsoDate;
    decisionModelVersion: string;
    researchSnapshotVersion: string;
  };
}
```

Export envelope note: `export.json` per REQ-REPORT-05 uses the keys
`{ frameworkVersion, researchVersion, assessment, answers, constraints, recommendations }`;
`frameworkVersion` carries `decisionModelVersion` and `researchVersion` carries
`researchSnapshotVersion`. Both spellings are fixed here so the export reader and the
report engine never drift. Old assessments are immutable; reassessment creates a new
record carrying `reassessedFrom` (refresh play 2.6).

### 3.22 Staleness policy (thresholds as data)

Content today: [versioning-strategy.md](../maintenance/versioning-strategy.md) 3.2.

```ts
interface StalenessPolicy {
  decayClass: Id;                            // decay.platform | decay.framework | decay.convention | decay.status
  claimTypes: ClaimType[];                   // which ladder rungs decay at this rate
  indicativeHalfLife: string;                // "years", "~12 months", "~6 months", "~3 months"
  thresholds: { aging: string; stale: string; expired: string };   // ISO-8601 durations, e.g. "P6M"
}
```

Derived states `staleness.fresh|aging|stale|expired` are computed from
`record.verifiedAt` age against the record's dominant decay class; staleness lowers
displayed confidence and queues review; it never flips a value (strategy 3.2).

---

## 4. Real examples (REQ-DATA-02: actual findings, verbatim-faithful)

### 4.1 A matrix verdict: wujie x `isolation.document-boundary`

The shipped cell from [../matrix/columns/wujie.json](../matrix/columns/wujie.json)
(column context: `unit: "wujie"`, `dossier: "research/solutions/wujie.md"`,
`verifiedAt: "2026-08-28"`), already a valid `Verdict`:

```jsonc
{
  "id": "isolation.document-boundary",
  "value": "no",
  "note": "Hidden iframe supplies only the realm; rendered DOM lives in the host document behind a shadow root.",
  "claimType": "officially-supported",
  "confidence": "high",
  "evidence": ["What it is"]
}
```

`evidence` resolves to the "What it is" section of the wujie dossier;
`verifiedAt` inherits from the column. This single cell is the split separating
browser-guaranteed from virtualized isolation (the attribute's `notes` field says so),
which is why field-level provenance matters: the cell carries its own claim class even
though its column-mates differ.

A condition-carrying verdict from the same column, showing the mandatory `condition`:

```jsonc
{
  "id": "composition.kind.lifecycle-contract",
  "value": "conditional",
  "condition": "singleton/alive JS-reuse modes require window.__WUJIE_MOUNT/__WUJIE_UNMOUNT exports; reconstruction mode composes unmodified apps",
  "claimType": "officially-supported",
  "confidence": "high",
  "evidence": ["Build-time coupling", "Migration requirements"]
}
```

And one of the source records the dossier's evidence chain bottoms out in (3.2 shape),
verbatim from wujie.md's Sources list:

```jsonc
{
  "key": "E5",
  "locator": "https://raw.githubusercontent.com/Tencent/wujie/master/packages/wujie-core/src/iframe.ts",
  "title": "source: same-origin iframe construction with stopped loading, hidden iframe, proxied location, wrapped pushState/replaceState, document properties routed to proxyDocument/shadowRoot, no window.parent/top patching",
  "sourceType": "officially-supported",
  "retrievedAt": "2026-08-28"
}
```

### 4.2 A derive rule: `derive.unmodifiable-participant-floor`

From the [constraints.md](constraints.md) section 3 table row: premises
"`ownership.host-unmodifiable-participant`=y, or
`migration.appetite`(p)=`migration.no-modification-possible`"; derives
"`constraint.participant-modification-ceiling`(p, maxLevel=2, host-side payable only) at
`class.hard-constraint`"; mode entailed.

```jsonc
{
  "id": "derive.unmodifiable-participant-floor",
  "mode": "entailed",
  "premises": {
    "any": [
      { "fact": "ownership.host-unmodifiable-participant", "value": "yes" },
      { "fact": "migration.appetite", "subject": "participant:*", "value": "migration.no-modification-possible" }
    ]
  },
  "derives": [
    {
      "action": "bind",
      "constraint": "constraint.participant-modification-ceiling",
      "subject": "participant:*",
      "class": "class.hard-constraint",
      "params": { "maxLevel": "migration.integration-adapter", "payableBy": "host" }
    }
  ],
  "doc": "constraints.md#3"
}
```

`maxLevel` is the level **id** (ordinal 2 lives in `scale.migration-appetite`, 3.16);
"host-side payable only" becomes the typed param `payableBy`. Entailed mode means the
premise already states the incapacity: no confirmation question before hard treatment.

### 4.3 A question: `question.deploy.independence` (rank 2, both phrasings)

From [questions.md](questions.md) 3.2, phrasings verbatim, including the
REQ-STATE-03 facet triple with the desirability ceiling:

```jsonc
{
  "id": "question.deploy.independence",
  "stage": "stage.family",
  "rank": 2,
  "why": "The single largest guaranteed split in the landscape; the matrix divides exactly on time.build-fused, and this is also the drift hinge.",
  "exposes": ["dimension.integration-time", "dimension.contract-explicitness"],
  "phrasings": {
    "architect": "Must a participant's deploy reach production without rebuilding or redeploying the host (`deployment.host-rebuild-required`=n, `ownership.deploy-schedule-ownership`), or is one coordinated release train acceptable, structurally?",
    "circumstance": "When one team finishes a change, can everyone live with it shipping in the next release of the whole product, or must that team be able to put it in front of users on its own schedule, without waiting for anyone?"
  },
  "answerType": "choice",
  "answers": [
    {
      "id": "answer.deploy-independence.no-shared-train",
      "statement": "We cannot share a release train (stated as fact, or entailed via derive.no-cross-deploy-control)",
      "class": "class.hard-constraint",
      "binds": [{ "action": "bind", "constraint": "constraint.independent-deploy", "class": "class.hard-constraint" }]
    },
    {
      "id": "answer.deploy-independence.valuable-not-required",
      "statement": "Independent deploys would be valuable but are not required",
      "class": "class.strong-preference",
      "binds": [{ "action": "bind", "constraint": "constraint.independent-deploy", "class": "class.strong-preference" }]
    },
    {
      "id": "answer.deploy-independence.train-mandated",
      "statement": "One train is mandated (audit/atomicity policy)",
      "class": "class.hard-constraint",
      "binds": [{ "action": "bind", "constraint": "constraint.atomic-release", "class": "class.hard-constraint" }]
    }
  ],
  "facets": [
    { "id": "question.deploy.independence.current", "kind": "fact" },
    {
      "id": "question.deploy.independence.value",
      "kind": "desirability",
      "phrasing": "Would it be valuable if teams could deploy without coordinating with each other?",
      "maxClass": "class.strong-preference"
    },
    {
      "id": "question.deploy.independence.readiness",
      "kind": "readiness",
      "phrasing": "Are the affected teams prepared and authorized to own their release process, including being on call for what they ship?"
    }
  ],
  "gain": { "guaranteed": "5/12 families either way", "max": "7/12 families, 17/19 impls" },
  "gating": "always asked (spine)",
  "audit": ["B1", "B4"],
  "doc": "questions.md#3.2"
}
```

The `.value` facet's `maxClass` is `rule.no-target-satisfies-hard` made structural: a
desirability answer *cannot* be recorded as a hard binding, whatever the UI does.
Relevance consequences live as edges (3.14), e.g. verbatim from the adjacency table:

```jsonc
{ "type": "edge.forks", "from": "question.deploy.independence", "onAnswer": "future tense",
  "to": ["question.deploy.independence.value", "question.deploy.independence.readiness"],
  "basis": ["question.rule.state-fork"] }
```

### 4.4 A family summary: `family.module-graph-federation`

Condensed instance of 3.6 with verbatim key fields from [families.md](families.md) 3.4
(long prose fields abridged here with an ellipsis marker; the record in the dataset
carries them in full):

```jsonc
{
  "id": "family.module-graph-federation",
  "canonicalName": "Module-graph federation",
  "plainEnglishName": "Independently built and deployed JavaScript bundles import each other in the browser and agree at load time on one copy of shared libraries.",
  "definition": "The browser's JS module graph is the composition boundary. Independently deployed builds expose modules; consumers import them at runtime; a resolution layer (a bundler-emitted container runtime, or an import map over native ESM) wires specifiers to deployed URLs and negotiates shared dependencies so common libraries load once (`composition.kind.js-module-graph`, `runtime.shared-dep-negotiation`).",
  "compositionBoundary": "The JS module import, plus the shared-dependency share scope. The finest-grained boundary in the landscape: a participant can be an application, a page, a component, or a single function.",
  "integrationPhase": [
    "time.deploy-decoupled",
    { "pole": "time.runtime-live", "condition": "late remote registration, map injection" }
  ],
  "executionModel": ["realm.shared", "locus.client-runtime", "granularity.region", "orchestration.library"],
  "coordinationAssumptions": "The family's defining burden: continuous cross-team version governance before and after builds (`coordination.shared-dependency-governance`). Conflicts first surface at runtime (`runtime.dep-conflict-surfaces-runtime`); under version skew, dedup silently falls back to duplicates (`performance.dedup-failure-on-version-skew`). ...",
  "isolationCharacteristics": "None. One realm, one document: a participant's exception, primordial mutation, or leaked interval reaches everyone (`isolation.failure.post-mount-exception`=n, `isolation.lifecycle.reclaim`=n). Trust ceiling `trust.cooperative`: all participants are one security principal.",
  "migrationRequirements": {
    "participantFloor": "migration.bundler-change",
    "hostFloor": "shell build integration; no new infrastructure tier"
  },
  "hardLimitations": [
    "No isolation of any kind; page-wide singletons (router, state, framework instance) constrain composition",
    "A toolchain floor exists on the runtime end (`framework.version-floor-imposed`)",
    "Genuinely untrusted code is never viable (`security.untrusted-third-party-viable`=n)"
  ],
  "relatedFamilies": [
    { "family": "family.lifecycle-orchestration", "distinguishedBy": "the seam: imported modules vs a mount/unmount contract; frequently combined in practice: federation loads, an orchestrator mounts" },
    { "family": "family.custom-element-composition", "distinguishedBy": "the seam: JS import vs DOM tag" },
    { "family": "family.package-composition", "distinguishedBy": "integration phase: load-time resolution vs build-fused resolution of the same import graph" },
    { "family": "family.virtualized-rehosting", "distinguishedBy": "realm treatment: raw shared realm vs simulated confinement" }
  ],
  "representativeImplementations": ["impl.module-federation", "impl.native-federation", "unit.import-map-architectures"],
  "brandAliases": ["alias.nx-mfe", "alias.angular-mfe", "alias.modernjs-mfe", "alias.rspack-mf", "alias.vite-mf", "alias.repack"],
  "attachedLayers": ["impl.zephyr-cloud"],
  "baseline": false,
  "dates": { "researchedAt": "2026-08-29", "verifiedAt": "2026-08-29", "lastReviewed": "2026-08-29" },
  "doc": "families.md#3.4"
}
```

Deleting the three entries in `representativeImplementations` (and the aliases) leaves
every other field meaningful: the removal test (REQ-KEYTEST-01) is a property of this
shape, since no field above except those two arrays names a brand.

### 4.5 A gap record: `gap.untrusted-dedup`

From the [constraints.md](constraints.md) 6.3 seed and the section 4 exclusion that
proves it:

```jsonc
{
  "gapId": "gap.untrusted-dedup",
  "constraints": [
    { "constraint": "constraint.distinct-principal", "class": "class.hard-constraint" },
    { "constraint": "constraint.payload-dedup", "class": "class.hard-constraint" }
  ],
  "discoveredFrom": ["rel.excludes.distinct-principal--payload-dedup"],
  "currentCandidates": [],
  "unmetCapabilities": ["performance.shared-dependency-dedup"],
  "classification": "gap.class.inherently-contradictory",
  "classificationNote": "Inherent under current browser primitives (dedup requires a shared realm).",
  "dates": { "researchedAt": "2026-08-29", "verifiedAt": "2026-08-29", "lastReviewed": "2026-08-29" }
}
```

The relation it cites, from the section 4 table (basis verbatim):

```jsonc
{
  "id": "rel.excludes.distinct-principal--payload-dedup",
  "type": "rel.excludes",
  "from": [{ "constraint": "constraint.distinct-principal", "class": "class.hard-constraint" }],
  "to": ["constraint.payload-dedup"],
  "basis": {
    "statement": "all dedup-capable units are trust.cooperative (matrix: performance.shared-dependency-dedup=y rows vs taxonomy.md 2.2 scale)",
    "attributes": ["performance.shared-dependency-dedup"]
  },
  "gapSeed": "gap.untrusted-dedup",
  "doc": "constraints.md#4"
}
```

Exclusions are landscape facts: a future unit that deduplicates across distinct
principals dissolves this relation by data edit (research rev bump), and the gap record
closes; nothing in engine code changes.

### 4.6 Editions with honest availability: `impl.hyperfrontend`

From [implementations.md](implementations.md) 2.7, the per-edition availability and
attachment structure, with every Enterprise atom `avail.announced-planned` without
exception:

```jsonc
{
  "id": "impl.hyperfrontend",
  "unit": "unit.hyperfrontend",
  "unitType": "framework",
  "families": [{ "family": "family.document-embedding", "role": "member" }],
  "availability": [
    { "subject": "impl.hyperfrontend.community", "state": {
        "value": "avail.available-immature",
        "note": "@hyperfrontend/* packages (features 0.8.0) installable and runnable today, MIT, but pre-1.0 throughout; breaking wire changes explicitly allowed (unit.availability.stable-line-shipped=n).",
        "claimType": "officially-supported", "confidence": "high",
        "evidence": ["What it is", "Operational model"] } },
    { "subject": "impl.hyperfrontend.enterprise", "state": {
        "value": "avail.announced-planned",
        "note": "Nothing purchasable or hosted today (unit.editions.commercial-tier=c records exactly this).",
        "claimType": "officially-supported", "confidence": "high",
        "evidence": ["Editions"] } }
  ],
  "maturity": {
    "unit.maintenance.multi-maintainer": { "value": "no", "claimType": "inference", "confidence": "high", "evidence": ["Maintenance"] },
    "unit.maintenance.adoption-outside-sponsor": { "value": "unknown", "claimType": "inference", "confidence": "high", "evidence": ["Maintenance"] }
  },
  "implementationCapabilities": [
    { "capability": "contract.compatibility-checking", "attach": "attach.implementation", "availability": "avail.available-immature" }
  ],
  "editions": [
    { "id": "impl.hyperfrontend.community", "type": "community", "availability": "avail.available-immature", "capabilities": [] },
    { "id": "impl.hyperfrontend.enterprise", "type": "commercial", "availability": "avail.announced-planned",
      "capabilities": [
        { "capability": "governance.rbac", "attach": "attach.edition", "availability": "avail.announced-planned" },
        { "capability": "hosting.control-plane", "attach": "attach.edition", "availability": "avail.announced-planned" },
        { "capability": "registry.deployable-feature", "attach": "attach.edition", "availability": "avail.announced-planned" }
      ] }
  ],
  "differsFromNeighbors": "Contract explicitness (gated handshake with drift errors versus Luigi's configured navigation and the practice's conventions), lifecycle orchestration depth over the raw primitive, and maturity plus stewardship (pre-1.0 single-maintainer versus Luigi's stable corporate line).",
  "dossier": "research/solutions/hyperfrontend.md",
  "dates": { "researchedAt": "2026-08-28", "verifiedAt": "2026-08-29", "lastReviewed": "2026-08-29", "statusAtResearch": "avail.available-immature" },
  "doc": "implementations.md#2.7"
}
```

The neutrality guards are visible in the shape: the family membership carries no edition;
the `governance.rbac` attachment sits on the enterprise edition only, with `availability`
that no binding can treat as satisfied (5.3 check 9).

### 4.7 A state septet with buy-in signals (acquisition fixture)

The framework-stack dimension row of the
[state-transition.md](state-transition.md) section 10 worked example (durable twin:
[../scenarios/acquisition-no-rewrite.md](../scenarios/acquisition-no-rewrite.md)):

```jsonc
{
  "dimension": "dimension.adaptation-floor",
  "subject": "participant:acquired-portal",
  "state": {
    "current": { "value": "React host + AngularJS portal", "claimType": "officially-supported", "confidence": "high", "evidence": ["Situation"] },
    "target": { "value": "Single React stack", "statedAt": "2026-08-28" }
  },
  "transition": {
    "willingness": "Moderate (stated, unfunded)",
    "cost": ["migration.framework-migration", "migration.rewrite"],
    "authority": "CTO (voiced intent, no approved plan)",
    "confidence": "transition.confidence.planned-unapproved",
    "horizon": "18-36 months, maybe"
  }
}
```

```jsonc
{
  "subject": "participant:acquired-portal",
  "signals": {
    "buyin.executive-sponsorship": { "value": "partial", "note": "verbal only", "claimType": "inference", "confidence": "medium", "evidence": ["Situation"] },
    "buyin.budget":   { "value": "no", "claimType": "inference", "confidence": "high", "evidence": ["Situation"] },
    "buyin.timeline": { "value": "no", "claimType": "inference", "confidence": "high", "evidence": ["Situation"] },
    "buyin.staffing": { "value": "no", "claimType": "inference", "confidence": "high", "evidence": ["Situation"] }
  }
}
```

Evaluating `predicate.target-credible` over these two records: ordinal 3 < 5, and the
level-4 path fails (`buyin.budget` absent), so the target never joins current-state
elimination and any candidate depending on it is emitted as a warning-annotated
conditional with `fit.transition-dependent`. That entire judgment is data-driven: the
predicate (3.17), the scale (3.16), and these records.

---

## 5. Facts, implications, rules, preferences: made structural (REQ-DATA-04)

### 5.1 Layer assignment (who may hold what)

```ts
type Layer = "facts" | "implications" | "rules" | "preferences" | "presentation";
```

Every collection declares its layer in the envelope; every entity kind has exactly one:

| Layer | Entity kinds | May reference |
|---|---|---|
| `facts` | Verdicts/columns/matrix, SourceRecords, availability and maturity facts, capability attachments, ownership-fact instances, septet `state.current`, buy-in signals, aliases (observed brand->mechanism resolutions), attributes and redirects (the observation vocabulary) | sources only |
| `implications` | Dimensions (poles, explains, causal chains), families (consequence fields: costs, limitations, works-well/poorly), relations' *basis*, migration/confidence scales, topology tendency fields, capability-atom definitions | facts, other implications |
| `rules` | ConstraintDefs, DeriveRules, Relations, DominanceRules, questions and answers, graph edges and stages, the credibility predicate, engine rules (`rule.*`), relaxation rows, staleness policies | facts, implications, other rules |
| `preferences` | Nothing at rest. Preferences exist only as *user-owned* `ConstraintBinding`s with class `class.strong-preference` / `class.weak-preference` inside an Assessment, and as answer-option classifications (rules layer) that cap what a user answer may bind | n/a |
| `presentation` | Report section specs, statuses, export/storage/lead/framing records (the ux docs as data) | everything below it |

Reference direction is enforced downward only: a fact never cites a rule, a dossier never
cites a question. This is REQ-ORCH-08's chain as a validation property, so a questionable
recommendation is traceable to its failing layer mechanically.

Two placements worth stating because they are easy to get wrong:

- **Availability is a fact, never a rule**: `avail.*` states live on implementations and
  editions with provenance; the engine consumes them as independent selection factors
  (REQ-AVAIL-03). No rule may encode "prefer available" as data; that behavior is engine
  semantics specified in decision-engine.md.
- **Aspirations are neither facts nor preferences**: septet `state.target` is its own
  dated shape (3.17); it becomes binding material only through the rules-layer predicate.

### 5.2 The no-scores guard (REQ-Q-06)

Schema-level, not policy-level:

1. **No numeric evaluative fields exist on any entity.** The only numbers in the entire
   schema are: `ScaleLevel.ordinal` (position in a declared ordered scale), `Question.rank`
   (index in the ranked list), the predicate's ordinal thresholds and robustness factor,
   counts emitted by validators, and dates. None of them attaches to a unit, family,
   implementation, edition, or recommendation.
2. **`CandidateResult` has no score field to omit**: its shape is a closed status enum
   plus four independent fit flags with `because` chains. Any future "summary indicator"
   must be computed in presentation code from these decomposed factors and cannot be
   stored (REQ-AVAIL-03: any summary must decompose; here it structurally cannot
   *persist* undecomposed).
3. **Classes are a closed enum**, not a weight: `class.*` has four members and no numeric
   mapping anywhere in the dataset.
4. The validator rejects any field named `score`, `weight`, `rating`, or `points` in any
   collection (belt and suspenders for future editors).

### 5.3 Validator rule set (the executable guard)

The `assemble.mjs`-style validator enforces, at minimum:

1. Id grammar and namespace registry (2.1); every referenced id resolves (including ids
   embedded in prose via backticks); redirects resolve to live canonicals; no id is
   defined twice across collections.
2. Value vocabulary closed; `condition` present iff value is `conditional`;
   `scaleLevel`/`condition` on scale-valued verdicts names a level of the attribute's
   `scaleRef` scale.
3. Every `Fact` has non-empty `evidence`, a `claimType` from the ladder, and a resolvable
   `verifiedAt` (own or inherited).
4. Layer declaration present; cross-layer references flow downward only (5.1).
5. No numeric evaluative fields (5.2 rule 4); `ScaleLevel.ordinal` equals array index.
6. `CapabilityAttachment.attach` level consistent with its host (edition items under
   editions, etc.); no capability attached at two levels for one implementation;
   `availability` present on every attachment.
7. Stage firewall: every `ConstraintDef.scope` is bindable only by questions whose
   `stage.mayBind` includes it; no `scope.edition` constraint is reachable from
   `stage.family` nodes via any answer's `binds`/`entails`.
8. Relations: every `rel.excludes` cites at least one attribute or evidence ref in
   `basis` (landscape facts, not logic); every `gapSeed` names an existing GapRecord or
   is flagged as a pending seed.
9. No `avail.announced-planned` / `avail.future-roadmap` capability appears in any
   fixture trace's satisfied set (REQ-AVAIL-01 checked against data at rest).
10. Superseded values retain their evidence; no record deletion between snapshots
    (diff-based check: prior ids must still resolve, possibly via redirects).
11. Scenario `situation` strings are immutable between snapshots (fixture integrity
    rule); guardrail edits require a guidance citation in the change note.
12. Every `doc` ref resolves to an existing file and section.
13. Envelope versions parse; `researchSnapshot` matches `YYYY.MM.rev`; collection
    `schemaVersion` matches `meta.json`.
14. Question facets with `kind: "desirability"` carry
    `maxClass: "class.strong-preference"` (structural REQ-STATE-03/04).

---

## 6. Versioning fields wired to the maintenance surfaces (REQ-DATA-07)

### 6.1 Surface-to-field map

Every surface id from [versioning-strategy.md](../maintenance/versioning-strategy.md)
section 1 lands on named fields:

| Surface | Concrete fields |
|---|---|
| `version.schema` | `Meta.schemaVersion`; `Collection.schemaVersion` on every file; `Assessment.schemaVersion` in every export (import validates it before restore; MAJOR ships a migration transform per refresh play 2.7) |
| `version.model` | `Meta.modelVersion`; `Collection.modelVersion` on rules-layer and implications-layer collections; pinned into `Assessment.decisionModelVersion` (exported as `frameworkVersion`) |
| `version.research` | `Meta.researchSnapshot` (`YYYY.MM.rev`); `Collection.researchSnapshot`; pinned into `Assessment.researchSnapshotVersion` (exported as `researchVersion`); `Meta.corpusLastReviewed` carries the user-facing "Last reviewed: <Month Year>" claim, advancing only per strategy 4.1 |
| `record.dates` | `RecordDates` on every implementation, family, gap, topology, alias, and column record: `researchedAt`, `verifiedAt`, `lastReviewed`, `statusAtResearch` |
| `source.dates` | `SourceRecord.retrievedAt` / `.reviewedAt`, plus `supersededAt`/`supersededReason` so displaced evidence is marked, never erased |

Derived, never stored: staleness states (from `RecordDates` against `StalenessPolicy`),
the "newer research available" notice (pinned pair vs `Meta`), and the review queue
(records whose derived state is `staleness.stale`).

Independent record refresh (strategy section 3) is a consequence of this wiring: a
record plus its `ResumabilityBlock` is self-sufficient for a cold refresh session; ids
are stable so nothing dangles; the layered references make the downstream re-derivation
set enumerable (touch a fact, re-derive only rules citing it).

### 6.2 Migration notes for the shipped 0.1.0 data

All additive (schema MINOR at most, pre-1.0):

- Widen `researchSnapshot` `"2026-08"` to `"2026.08.0"` across the three matrix files.
- Add `layer` to the matrix envelope (`facts`).
- Move the two scale-valued rows' scale ids from `condition` into `scaleLevel` +
  `Attribute.scaleRef` (redirect-free: attribute ids unchanged; old exports still read
  because `condition` is retained until the next schema MAJOR).
- Transcribe the attributes.md merged/renamed appendix into `redirects.json`
  (58 merges, 17 renames, `inverted` flags preserved).
- Prefix bare unit slugs with `unit.` at assembly time (columns keep bare slugs on disk
  until the next MAJOR; the assembler normalizes).

### 6.3 Bump discipline hooks

The strategy's bump rules (its 1.2) need two data hooks, both present: the schema
changelog lives in `Meta.schemaChangelog` (with `migration` naming the transform for
MAJORs), and fixture traces record `(modelVersion, researchSnapshot)` so "full
scenario-fixture run before release" is checkable from data.

---

## 7. Collection layout and implementation path

### 7.1 Files (shape and split; location per REQ-ORCH-13 is decided later)

```text
data/
  meta.json                    Meta (3.1)                                   layer: n/a
  attributes.json              Collection<AttributeGroup> (3.3)             facts
  redirects.json               Collection<IdRedirect> (3.3)                 facts
  columns/<unit>.json          UnitColumn (3.4), 30 files                   facts
  matrix.json                  assembled Collection<UnitColumn> (generated) facts
  dimensions.json              Collection<Dimension> (3.5)                  implications
  families.json                Collection<Family> (3.6)                     implications
  implementations.json         Collection<Implementation> (3.7)            facts
  aliases.json                 Collection<BrandAlias> (3.8)                 facts
  capability-atoms.json        Collection<CapabilityAtomDef> (3.18)         implications
  scales.json                  Collection<Scale> (3.16)                     implications
  topologies.json              Collection<Topology> + OwnershipFactDef (3.15) implications
  constraints.json             Collection<ConstraintDef> (3.9)              rules
  derive-rules.json            Collection<DeriveRule> (3.10)                rules
  relations.json               Collection<Relation> (3.11)                  rules
  dominance.json               Collection<DominanceRule> (3.12)             rules
  questions.json               Collection<Question> (3.13)                  rules
  question-graph.json          Collection<GraphEdge> + Stage (3.14)         rules
  engine-rules.json            rule.* / predicate.* records (3.17, engine spec) rules
  relaxation.json              Collection<RelaxationRow> (3.20)             rules
  gaps.json                    Collection<GapRecord> (3.20)                 facts
  scenarios/<slug>.json        ScenarioFixture (3.19), 9 files              rules (fixtures test rules)
  report-spec.json             report.section.* / status.* / export.* (3.21) presentation
  staleness.json               Collection<StalenessPolicy> (3.22)           rules
schema/
  schema.ts                    the types in section 3 (authority)
  schema.json                  generated JSON Schema (validator input)
tools/
  validate.mjs                 section 5.3 checks; exits non-zero (assemble.mjs mold)
  assemble.mjs                 columns -> matrix.json (exists; extended to normalize 6.2)
  emit-md.mjs                  section 1.4 projections incl. model-bundle.md
  emit-tsv.mjs                 matrix-compact.tsv projection
```

The interactive page fetches per-collection JSON lazily (search-index pattern); the
report engine imports `schema.ts` types and loads the same JSON; the CLI and LLM read
the same files or the generated Markdown; static docs pages are generated from them at
build time. One dataset, many interfaces (REQ-DATA-01), and removing every `impl.*` and
`alias.*` file leaves the families/dimensions/constraints/questions coherent
(REQ-KEYTEST-01, mirrored in the file split).

### 7.2 What Phase 7's next stage consumes

[decision-engine.md](decision-engine.md) (deliverable 16) specifies evaluation over
exactly these shapes: bindings (3.9), derive rules (3.10), relations (3.11), dominance
(3.12), edges/stages (3.14), the predicate (3.17), and `EngineOutputs` (3.21) as its
output contract. [llm-interface.md](llm-interface.md) (deliverable 17) maps prose to
`NormalizedInput`/`ConstraintBinding` and reads the Markdown projection; it adds no
entity kinds.

---

## 8. Coverage check

| Requirement | Where satisfied |
|---|---|
| REQ-DATA-01 | Section 1.1 consumer table; 7.1 one-dataset/many-interfaces split; no reasoning in any UI-owned format |
| REQ-DATA-02 | Section 1 (decision, determined not assumed, against workspace evidence); 1.4 (Markdown path); section 4 (real-finding examples, 7 entities instantiated from shipped data) |
| REQ-DATA-03 | 3.13 question shape + conceptual field mapping; 3.14 graph traversable without the UI |
| REQ-DATA-04 | Section 5: layer enum on every collection, downward-only references, preferences confined to user-owned bindings, no-scores guard structural + validated |
| REQ-DATA-05 | 2.2 `Fact<T>` envelope on every fact-bearing field; conditions mandatory on conditionals; superseded values retained with evidence |
| REQ-DATA-06 | 2.1 grammar, closed namespace registry, permanent identity, `IdRedirect`; ids quoted throughout are the ones the phase artifacts already fixed |
| REQ-DATA-07 | Section 6 surface-to-field map; `RecordDates` + `SourceRecord` dates everywhere; staleness derived from data; independent record refresh via `ResumabilityBlock` |

Phase-gate obligations this file leaves open, deliberately: none for schema shape; the
engine's evaluation semantics (already sketched as `rule.*` records in the model docs)
are specified next in [decision-engine.md](decision-engine.md).
