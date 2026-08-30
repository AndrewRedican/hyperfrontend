# LLM Interface Model

Status: DESIGNED v1 (Phase 7), 2026-08-29. Deliverable 17 (MASTER.md section 16).
Requirements served: REQ-LLM-01 (conversational input translates to the same normalized
constraints and queries the same framework; never a separate methodology; boundary design
only, nothing built), REQ-ENT-11 (AI Dev Assist is DX, never a selection criterion),
plus the LLM clauses of REQ-REPORT-01 (an LLM may summarize but never authors the
recommendation), REQ-DATA-02 (Markdown consumption path), REQ-ORCH-10 (next-question
delegation), and REQ-KEYTEST-01 (LLM-for-UI substitution parity).

Inputs, linked not restated (REQ-OPS-03): entity shapes from
[schema-proposal.md](schema-proposal.md) (sections 1.4, 3, 7.2); the two engine
functions, pipeline, and determinism contract from
[decision-engine.md](decision-engine.md) (sections 1.1, 2, 4); question content and the
anti-steering audit from [questions.md](questions.md) (section 1.3, patterns B1-B4);
interview rules from [question-graph.md](question-graph.md) (sections 3.1, 3.2);
tense/aspiration discipline from [state-transition.md](state-transition.md); the Dev
Assist firewall from [enterprise-layer.md](enterprise-layer.md) (sections 10, 11);
report sections, statuses, and the historical-report rule from
[../ux/report-design.md](../ux/report-design.md); version surfaces from
[../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md) section 1;
the worked narrative from [../scenarios/acquisition-no-rewrite.md](../scenarios/acquisition-no-rewrite.md)
and its engine walk in decision-engine.md section 5.

Scope rule: this file designs the **boundary** between a conversational LLM surface and
the deterministic framework. It adds no entity kind the engine consumes
(schema-proposal.md 7.2 promise, kept in section 6 below). New normative content
carries `llm.*` ids; this registers the `llm` namespace in the schema's closed registry
(schema-proposal.md 2.1; a `version.schema` MINOR, folded into the first assembly pass).
Nothing here is implemented in this phase.

---

## 1. The boundary (`llm.boundary`)

### 1.1 Three seams, one engine

```text
conversation (prose in)
   |  llm.role.translator: quoted spans -> normalized records     (section 2)
   v
Answer[] + fact instances + septets        the SAME records the questionnaire
   |                                       produces; same ids, same shapes
   v
evaluate() / nextQuestion()                decision-engine.md 1.1; pure,
   |                                       deterministic, no LLM inside
   v
EngineOutputs wrapped in an Assessment     schema-proposal.md 3.21
   |  llm.role.narrator: narrate around, quote verbatim           (section 3)
   v
conversation (prose out)
```

The framework's reasoning lives entirely between the second and third box. The LLM
touches exactly three surfaces:

1. **The dataset, read-only**, via the generated Markdown projection
   (`model-bundle.md`, schema-proposal.md 1.4), which concatenates collections in
   layer order facts -> implications -> rules so the LLM ingests the same chain the
   engine evaluates (REQ-ORCH-08) and cannot acquire a separate methodology
   (REQ-LLM-01).
2. **The two pure functions** `evaluate(dataset, answers)` and
   `nextQuestion(dataset, answers)` (decision-engine.md 1.1), called as opaque
   services. The LLM supplies `Answer[]`; it never supplies rules, weights, cells,
   or candidate lists.
3. **The emitted `Assessment`**, which it explains under section 3's contract.

### 1.2 Roles and non-roles

| Id | Role | Bound by |
|---|---|---|
| `llm.role.translator` | Turn prose situations into the normalized records of section 2.2, each with a quoted source span | sections 2, 4 |
| `llm.role.interviewer` | Relay the engine-selected next question and collect the answer; ask clarifications about spans already stated | section 2.5 |
| `llm.role.narrator` | Explain an emitted `Assessment` in the reader's language | section 3 |

Non-roles (`llm.nonrole.*`), each structurally prevented rather than merely forbidden:

| Id | Never does | Prevented by |
|---|---|---|
| `llm.nonrole.methodology` | Invent, vary, or shortcut the decision method | only records that pass schema validation reach `evaluate`; the method is data (REQ-ENGINE-01) |
| `llm.nonrole.ranking` | Order, promote, or demote candidates | order is `engine.rule.candidate-order` output; `llm.rule.no-reorder` (3.2) |
| `llm.nonrole.recommending` | Author or alter a recommendation (REQ-REPORT-01) | narration is grounded in emitted records only (`llm.rule.grounded-narration`); historical reports immutable (report-design.md 6) |
| `llm.nonrole.researching` | Supply landscape facts from model weights | `llm.rule.no-corpus-supplement` (4.3) |

### 1.3 Version pinning per exchange

Every conversational session opens by loading one pinned triple (`version.schema`,
`version.model`, `version.research`) from `meta.json`, and every artifact the session
produces (extractions, the `Assessment`, narration that cites records) carries that
pin (versioning-strategy.md section 1; decision-engine.md 4.2). Section 4.3 makes
this the stale-knowledge guard.

---

## 2. Translation contract (`llm.translate`)

### 2.1 Input classes (`llm.input.*`)

| Id | Input | Example | Handling |
|---|---|---|---|
| `llm.input.narrative` | A multi-fact situation description | MASTER.md section 12's "we bought a company, their portal is AngularJS..."; scenario Situation prose | Full extraction pass (2.2-2.4), then the interview loop (2.5) |
| `llm.input.increment` | One new fact or answer mid-conversation | "actually, they deploy weekly" | Single extraction appended to the canonical `Answer[]`; `evaluate` reruns (E1-E9 are monotone, decision-engine.md section 2) |
| `llm.input.correction` | A retraction or revision of something already extracted | "no, we CAN change their bootstrap" | The prior `ExtractionRecord` is marked `withdrawn` (never deleted); its answer leaves `Answer[]`; re-evaluation from the corrected set. Monotonicity applies per evaluation run, not across corrections |
| `llm.input.import` | A pasted `export.json` from a prior assessment | | Not translation: the export is re-imported by the deterministic reader (report-design.md 10); the LLM may then narrate it (section 3), never regenerate it |

### 2.2 Output records: the closed target list

The translator emits ONLY record kinds that already exist in
[schema-proposal.md](schema-proposal.md), with ids that already exist in the dataset:

| Target | Shape | Ids drawn from |
|---|---|---|
| Answers | `Assessment.answers` entries `{question, facet?, answer, tense?}` (schema 3.21) | `question.*` / facet ids (questions.json), `answer.*` option ids, scale level ids for `answerType: "scale-level"`, free text only for `answerType: "free-fact"` |
| Ownership/fact instances | `{fact, subject?, value}` with provenance (schema 3.15) | `ownership.*`, `migration.*` and other fact-vocabulary ids |
| State septets | `StateSeptet` (schema 3.17); target values dated, never `Fact`s | dimension ids, `transition.confidence.*` levels |
| Buy-in signals | `BuyinRecord` (schema 3.17) | the nine `buyin.*` ids |
| Subject labels | `"participant:<label>"` / `"host"` / `"global"` strings | free label, fixed once per party (`llm.rule.subject-stability`) |

**`llm.rule.no-direct-bindings`**: the translator never emits a `ConstraintBinding`.
Bindings arise only inside `evaluate` (E1 from answer `binds`, E3 from `derive.*`), so
answer-class ceilings, facet `maxClass` ceilings, and the stage firewall apply to
conversational input structurally, exactly as they do to questionnaire input. The
"normalized constraint records" REQ-LLM-01 speaks of are those E1/E3 products, carrying
`origin: ["answer:<question-id>"]` indistinguishable from questionnaire origin; the
schema-proposal 7.2 phrase "maps prose to NormalizedInput/ConstraintBinding" is
satisfied through this indirection, with `NormalizedInput` (schema 3.19) serving as the
human-auditable projection of the extraction table (2.3), not as a separate channel.

**`llm.rule.same-ids`** (REQ-LLM-01): every id in every emitted record must resolve in
the pinned dataset. There is no LLM-only vocabulary, no synonym layer, no "close
enough" id.

**`llm.rule.closed-answers`**: for `answerType` choice/boolean/scale-level, the emitted
answer must be one of the question's declared `AnswerOption` ids or a level id of its
`scaleRef` scale. Prose that matches no option is ambiguity (2.5), never a new option.

### 2.3 The extraction record: audit trail (`llm.record.extraction`)

One record per emitted target, in the `presentation` layer (schema 5.1), never read by
`evaluate`:

```ts
interface ExtractionRecord {
  target: Ref;                       // the emitted record (answer / fact / septet field / buyin)
  quote: { utterance: string; text: string };   // verbatim source span; REQUIRED
  paraphrase?: string;               // the translator's reading, when the quote alone is oblique
  confidence: "explicit" | "implied";           // closed; see llm.rule.confirm-implied-hard
  status: "extracted" | "confirmed" | "withdrawn";
  pinned: { model: string; research: string };  // the session pin (1.3)
}
```

- **`llm.rule.quote-span`**: an extraction without a resolvable verbatim span from the
  user's own words is refused at the boundary. "The user probably meant" is not a
  span. This is the audit trail: strip the extractions, hand the transcript to another
  translator, and the diff of the two extraction tables is the review artifact.
- `confidence: "explicit"` means the span states the fact in terms the record
  captures; `"implied"` means the record follows from the span only through an
  inference the user has not confirmed. There is no third value: what cannot be
  quoted or confirmed is not extracted (`llm.rule.unknown-stays-unknown`, 2.5).
- Corrections (`llm.input.correction`) set `status: "withdrawn"` and keep the record,
  mirroring the schema's superseded-values stance (schema 2.2): the trail shows what
  was believed and when.
- The report's current-state section already requires facts "echoed back verbatim
  enough to be checkable" (report-design.md section 2); the extraction table is what
  makes that check mechanical for the conversational channel.

### 2.4 Classification, tense, and subject discipline

- **Class comes from the dataset, never the chat**: an extraction selects an answer
  option; the option's `class` (questions.md 1.4) determines hard vs preference. The
  translator has no vocabulary for "make this hard"; emphatic prose ("absolutely
  must") selects the same option id as plain prose.
- **`llm.rule.tense-routing`** (pattern B4, questions.md 1.3; REQ-STATE-03/04):
  aspiration language ("eventually", "the CTO wants", "next year we plan") routes to
  `tense: "future"`, which `question.rule.state-fork` sends to septet
  `state.target` plus the desirability/readiness facets, never to a current-state
  slot. The engine backstops this (`rule.no-target-satisfies-hard`, facet `maxClass`),
  but the translator must route correctly so the septet and `buyin.*` evidence get
  captured at all.
- **`llm.rule.subject-stability`**: each party named in the conversation gets one
  subject label at first mention (e.g. `participant:expenses`), reused verbatim in
  every subsequent record. Renaming mid-session is a correction, not a new subject.
- **Deadlines are horizons, not constraints**: a stated integration deadline is
  extracted as the decision horizon and handed to `engine.rule.horizon-select`
  (decision-engine.md E1); the translator must not invent a constraint id for it.

### 2.5 Ambiguity, unknowns, and the interview loop

- **`llm.rule.unknown-stays-unknown`** (REQ-ORCH-10): silence emits nothing.
  `rule.unanswered-inert` (question-graph.md 3.1) then guarantees the absent answer
  binds nothing and defaults to nothing. The translator never fills a gap with a
  plausible default, an industry norm, or a model-weights guess; partial input is a
  first-class state of the engine, not a problem for the LLM to fix.
- **`llm.rule.confirm-implied-hard`**: an `implied` extraction whose answer option
  carries `class.hard-constraint` (or whose fact is a premise of an entailed
  `derive.*`) must be confirmed before submission: the interviewer restates the quote
  and the reading, and the user's yes/no becomes the confirming span (status
  `confirmed`). This mirrors `mode: "confirm"` derive semantics (constraints.md
  section 3) and costs the same one confirm event. Implied preferences may be
  submitted unconfirmed; they only rank.
- **Ambiguity between options**: when a span genuinely matches two answer options,
  the interviewer asks a clarification scoped to that span, quoting it. It may not
  resolve ambiguity by choosing.
- **`llm.rule.engine-owns-the-interview`** (REQ-ORCH-10): requests for NEW
  information (anything not already present as a span) are made only by relaying the
  question returned by `nextQuestion(dataset, answers)` (`rule.next-question`,
  question-graph.md 3.2). The LLM does not freestyle the interview order; the
  high-information selection is the engine's, computed over survivors and matrix
  cells. Clarifications and confirmations about existing spans (above) are the sole
  exception, since they add no new dimension.
- **`llm.rule.stored-phrasings`** (REQ-Q-05, REQ-AUD-01): a relayed question is
  rendered from its stored `phrasings` (architect or circumstance form per audience,
  questions.md 3.13 shape). Surface adaptation (pronouns, the user's own product
  names) is allowed; substituting the LLM's own question text is not, because every
  stored phrasing passed the B1-B4 anti-steering audit and an improvised one has not.
  All declared answer options are presented; none may be omitted or pre-picked.

### 2.6 Validation gate

**`llm.rule.validate-before-evaluate`**: the assembled `Answer[]` and fact set pass
the schema validator (schema-proposal.md 5.3: id resolution, closed vocabularies,
facet ceilings, stage firewall) before `evaluate` is called. A validation failure is
returned to the translator as a defect in translation, never patched by relaxing the
data. This is the hallucination guard of section 4.1 in its structural form.

---

## 3. Explanation contract (`llm.explain`)

### 3.1 Grounded narration

**`llm.rule.grounded-narration`**: every claim in the narrated output must resolve to
a record in the emitted `Assessment` (a candidate, exclusion, binding, tradeoff,
counterfactual, gap, derivation line, or version pin). The derivation graph
(decision-engine.md 3.3) is therefore the complete set of narratable claims; anything
the LLM cannot point into the outputs, it does not say. Vocabulary glosses may
additionally draw on the dataset's own `definition`/`why`/`plainEnglishName` fields
(they are part of the pinned model), never on outside knowledge.

### 3.2 What is quoted verbatim vs narrated

Quoted verbatim, never softened, reworded, reordered, or summarized away
(**`llm.rule.verbatim-fields`**):

- `status.match.*` and `status.assessment.*` labels, with their ids inspectable
  (report-design.md section 5 semantics are the truth; a gloss may follow the label,
  never replace it);
- `avail.*` availability states and maturity annotations (REQ-AVAIL-01), including
  `avail.announced-planned` on anything planned; and every
  `status.match.future-potential` entry presented together with its REQUIRED
  `pairedAvailableToday` partner, both or neither (REQ-AVAIL-02);
- `condition` strings on conditional and future-potential candidates;
- candidate order exactly as emitted (**`llm.rule.no-reorder`**: the narrator may not
  lead with a lower-ordered candidate, drop the head, or bury an unwelcome winner;
  rule-4 lexicographic ties are reported as "order not meaningful", as the engine
  discloses);
- derivation blocks in the report-design.md section 4 display grammar, reproduced as
  fenced text (`Q04 -> "No host rebuild"` lines and their ids);
- `Exclusion` records: the violated constraint ids and origin chains;
- `tradeoffs`, `counterfactuals` (the if-clauses and refs), `gapRecords` fields,
  `relaxationOffers` in their emitted order (`rule.relaxation-ordering` bands),
  `dominanceApplied` disclosures with conditions;
- aspiration warnings: the `fit.transition-dependent` flag, the confidence level, and
  the named missing `buyin.*` signals;
- the version pins (`frameworkVersion`/`researchVersion` spellings per schema 3.21's
  envelope note) and the "newer research available" notice.

Narratable (prose freedom, under 3.1): connective tissue between sections; register
and reading order within report-design.md section 2's section specs; translating id
vocabulary into the reader's words with the id kept reachable; summarizing a section
provided every summarized claim survives the grounding check; answering "what does
this mean for us" questions by walking the emitted derivation chains aloud.

### 3.3 Section duties

Per `report.section.*` (report-design.md section 2), the narrate/quote split:

| Section | Narrate | Quote verbatim |
|---|---|---|
| executive-summary | the flow | head candidate ids + statuses |
| current-state | none: echo | extracted facts with their quote spans (2.3) |
| desired-state | phrasing | septet targets, confidence levels, buy-in gaps |
| hard-constraints | grouping | constraint ids, what each eliminated |
| preferences | grouping | class, violated-or-not per candidate |
| organizational-topology | narrative | topology id, evidencing `ownership.*` facts |
| architectural-strategy | context | family ids, statuses, conditions, order |
| candidate-implementations | context | impl/edition ids, statuses, availability |
| hyperfrontend-fit | tone | same rules as any other candidate; nothing extra |
| availability | none | `avail.*` states, planned/today pairings |
| tradeoffs | connective prose | gained/sacrificed lists and refs |
| risks | framing | the four `fit.*`-derived risk categories |
| alternatives-considered | framing | exclusions with origin chains |
| counterfactuals | framing | if-clauses, refs, ordering |
| transition-path | narrative | septets, credibility verdicts, warning text |
| unresolved-questions | invitation to continue | question ids + `couldStillChange` |
| evidence | none | source records, claim types, review dates |

### 3.4 Historical reports

**`llm.rule.no-report-mutation`** (REQ-REPORT-06; report-design.md sections 3 and 6):
a stored assessment is never re-narrated against newer data as though it were current,
never regenerated, never "improved". The narrator may compare two assessments (both
deterministic data) and may surface the newer-research notice; reassessment is a new
deliberate run through sections 2 and 1.

---

## 4. Failure modes and guards

| Failure | Guard layers |
|---|---|
| Hallucinated constraint/fact/answer ids | `llm.rule.same-ids` + `llm.rule.closed-answers` (interface); validator id-resolution check rejects unknowns before `evaluate` (`llm.rule.validate-before-evaluate`; schema 5.3 check 1) |
| Fabricated facts (plausible, unstated) | `llm.rule.quote-span`: no span, no record; audit-trail replay diff (2.3) |
| Silent defaulting of unknowns | `llm.rule.unknown-stays-unknown` (interface) + `rule.unanswered-inert` (engine: silence binds nothing) |
| Aspiration inflation (B4) | `llm.rule.tense-routing` (interface) + facet `maxClass` and `rule.no-target-satisfies-hard` (structural/engine) |
| Confidence laundering (implied treated as stated) | `llm.rule.confirm-implied-hard`: implied hard-class extractions require a confirming span |
| Steering (REQ-Q-05, REQ-MISSION-01) | section 4.2 below |
| Stale model knowledge | section 4.3 below |
| Dev Assist self-preference (REQ-ENT-11) | section 4.4 below |
| Recommendation authorship / reordering | `llm.rule.grounded-narration`, `llm.rule.no-reorder`, `llm.rule.verbatim-fields`, `llm.rule.no-report-mutation` |
| User-side brand steering ("just tell me X wins") | `llm.rule.brand-via-aliases` (4.2) |

### 4.1 Hallucinated constraints

Two independent rejections: the interface refuses to emit an id it cannot find in the
pinned dataset (`llm.rule.same-ids`), and the validator refuses any record whose id
does not resolve (schema-proposal.md 5.3 check 1) before `evaluate` runs. An LLM that
invents `constraint.blockchain-ready` produces a validation error, not a binding. The
same closed-vocabulary property covers invented answer options, invented scale levels,
and invented capability atoms.

### 4.2 Steering, both directions

- **Framework-to-user**: the anti-steering audit of questions.md 1.3 (patterns B1
  feature-advertising, B2 benefit-free cost, B3 evidence-free routing, B4 aspiration
  inflation) is REUSED, not reinvented: `llm.rule.stored-phrasings` confines new-information
  asks to phrasings that already passed it, and the same four patterns are the review
  rubric for sampled conversation transcripts (the interface-level audit: check each
  clarification and each narration passage against B1-B4). The narrator's structural
  guards (`llm.rule.no-reorder`, verbatim statuses) make the seven REQ-TRUST-01
  outcomes deliverable in conversation exactly as the report delivers them: when the
  engine emits `trust.other-oss` or `trust.no-mfe`, the narration leads with it.
- **User-to-framework**: **`llm.rule.brand-via-aliases`**: brand talk in the input
  ("we want Module Federation", "make it Nx microfrontends") resolves through
  `alias.*` / `impl.*` records (schema 3.8) for VOCABULARY only; no constraint id
  exists for "prefer vendor X", so a brand demand extracts to nothing. The narrator
  answers it after evaluation by pointing at where that brand landed in the emitted
  candidates or exclusions, with its origin chain and counterfactual (the section 5
  example ends exactly this way for the sponsor's own product).

### 4.3 Stale knowledge

**`llm.rule.no-corpus-supplement`** + **`llm.rule.snapshot-pinned`**: the LLM's
training data is not an evidence source at any point. Landscape claims come from the
pinned dataset (via the Markdown projection) or they are not made; a user question
about a unit, version, or capability the dataset lacks is answered "not in the
researched corpus at `version.research` <pin>", optionally captured as a follow-up or
gap seed, never improvised from weights. Every exchange, extraction, and narration
carries the section 1.3 pin, so a transcript is auditable against exactly one snapshot
and the newer-research notice has a precise meaning. This is the conversational twin
of REQ-REPORT-06's no-silent-mutation rule.

### 4.4 REQ-ENT-11: Dev Assist is DX, never a criterion

`dx.ai-dev-assist` (enterprise-layer.md section 10) is a capability record like any
other: attached at implementation/edition level, availability planned. The
conversational interface IS an instance of that capability, and:

- **`llm.rule.dx-firewall`**: the interface never cites its own existence, quality,
  or availability as a reason for anything; "has AI" eliminates nothing, ranks
  nothing, and appears in no extraction, question, or narration as an advantage.
  Structurally, no `dx.*` atom occurs in any family-stage constraint or dominance
  record (verified at the Phase 6 gate, enterprise-layer.md section 11), so even a
  misbehaving narrator has no record to ground such a claim in (3.1).
- Per enterprise-layer.md's binding rule, this assistant consumes the same canonical
  framework and evidence as the manual UI; its presence changes the DELIVERY of
  recommendations, never their content. That sentence is this whole file in one line.

---

## 5. Worked example: the MASTER 12 acquisition narrative, end to end

The conversational input is REQ-LLM-01's own example class ("we bought a company,
their portal is AngularJS...") in the fuller form the fixture freezes
([../scenarios/acquisition-no-rewrite.md](../scenarios/acquisition-no-rewrite.md)
section 1; durable twin of state-transition.md section 10). Utterances:

```text
U1: "We bought a company three months ago; their expense product is AngularJS and
     ours is React. We can't touch their code, their build, or their release
     process until the earn-out ends, and they'll keep shipping on their own
     schedule. Sales promised it appears inside our product as one experience,
     live in two quarters."
U2: "Our own platform team can do whatever glue work is needed on our side."
U3: "The CTO keeps saying everything will eventually be on one stack, but there's
     no plan, budget, or timeline."
```

### 5.1 Extraction table (translator output; every row an `ExtractionRecord`)

Subject fixed at first mention: `participant:expenses` (`llm.rule.subject-stability`).

| Quote (utterance: span) | Emitted record | Confidence |
|---|---|---|
| U1: "We bought a company" | fact `ownership.acquired-participant` = yes | explicit |
| U1: "can't touch their code, their build, or their release process" | fact `ownership.host-unmodifiable-participant` = yes; fact `migration.appetite`(`participant:expenses`) = `migration.no-modification-possible` | explicit |
| U1: "they'll keep shipping on their own schedule" | facts `ownership.independent-releases` = yes, `ownership.multi-repo` = yes; answer `question.deploy.independence` = `answer.deploy-independence.no-shared-train` | explicit (facts); explicit (answer: the span states the schedule independence the option captures) |
| U1: "appears inside our product as one experience" | answer `question.granularity.single-screen` = yes | explicit |
| U1: "live in two quarters" | decision horizon, handed to `engine.rule.horizon-select`; no constraint id (2.4) | explicit |
| U2: "platform team can do whatever glue work is needed" | answer `question.migration.host-ceiling` (host appetite level) | **implied**: "whatever glue work" does not name a `scale.migration-appetite` level |
| U3: "eventually ... one stack" + "no plan, budget, or timeline" | septet on `dimension.adaptation-floor`: `state.target` = single stack, `transition.confidence.planned-unapproved`; `BuyinRecord`: `buyin.executive-sponsorship` partial, `buyin.budget`/`buyin.timeline`/`buyin.staffing` = no | explicit for the target's existence; `tense: "future"` per `llm.rule.tense-routing`; NOT a current-state answer (B4) |

Nothing else is emitted. Notably absent, because unstated
(`llm.rule.unknown-stays-unknown`): seam tolerance, failure containment, payload
budget, server capacity. Unknown stays unknown; `rule.unanswered-inert` covers them.

### 5.2 One confirm loop, one engine-directed ask

- The U2 extraction is `implied` and its answer binds
  `constraint.host-modification-ceiling` hard, so `llm.rule.confirm-implied-hard`
  fires. The interviewer restates: quotes U2, offers the scale levels
  (`answerType: "scale-level"` over `scale.migration-appetite`), the user settles on
  "up to `migration.moderate-refactor`, with host-paid `migration.integration-adapter`
  work available"; status becomes `confirmed` with the reply as the confirming span.
- For NEW information the interviewer calls `nextQuestion(dataset, answers)` and
  relays its pick using the stored circumstance phrasing
  (`llm.rule.engine-owns-the-interview`, `llm.rule.stored-phrasings`); the selection
  logic is `rule.next-question` (question-graph.md 3.2), not the LLM's. When the ask
  reaches the seam question (`question.ux.seam-tolerance`), the user's "we accept it
  won't be pixel-perfect on day one" extracts as the strong-preference option:
  `constraint.seamless-ux` will bind at `class.strong-preference`, because that is
  the OPTION'S class, not because the LLM judged the phrasing soft (2.4).

### 5.3 The handoff, and where the LLM's job STOPS

The translator submits the canonical `Answer[]` plus fact instances and the septet;
`llm.rule.validate-before-evaluate` passes (every id above resolves). **This is the
stop line.** Everything that follows is
[decision-engine.md](decision-engine.md) section 5, verbatim, because the record set
above IS the fixture's normalized input set (compare row for row with the brief's
section 2 and the engine's intake table 5.1):

- E3 fires `derive.unmodifiable-participant-floor` and `derive.mixed-majors-present`;
  the LLM did not know those rules exist.
- E4 refuses the CTO's aspiration (`predicate.target-credible` fails at ordinal 3
  with `buyin.budget` = no); the LLM did not weigh credibility.
- E6 eliminates five baseline families on `constraint.independent-deploy`,
  `family.route-partition` on `constraint.single-screen-mixing`, module-graph
  federation and lifecycle orchestration on the participant ceiling; per-configuration
  exclusions include `impl.hyperfrontend` (bootstrap floor above the ceiling); the LLM
  quoted no cell and ranked nothing.
- E7 orders the survivors (`family.virtualized-rehosting` conditional,
  `family.document-embedding` viable with the named seam tradeoff, two conditional
  fragment/element families); E13 emits `slots.bestToday` plus the warning-annotated
  single-stack slot; E16 computes the earn-out counterfactual.

### 5.4 The return path (narrator)

The narrator receives the `Assessment` and speaks under section 3: it may say "the
strongest fits keep their app in its own document or a virtualized copy of one" as a
gloss, and must then show, verbatim, the emitted statuses and the derivation block of
decision-engine.md 5.13 (`question.deploy.independence -> "no shared release train"
(constraint.independent-deploy)` and its siblings), the aspiration warning with its
three missing `buyin.*` signals, and the counterfactual "raise the ceiling to
`migration.bundler-change` and `family.module-graph-federation` returns". If the user
asks "why not HyperFrontend?" the answer is the emitted `Exclusion` record and its
counterfactual, delivered plainly (`trust.other-oss` outcome, REQ-MISSION-01), not an
apology or a hedge. At no point between 5.3's stop line and this paragraph did the
LLM produce a fact, a rule, an ordering, or a recommendation.

---

## 6. Schema touchpoints (what this file adds, and does not)

- **Adds the `llm` namespace** to the closed registry (schema-proposal.md 2.1);
  `version.schema` MINOR, batched into the first assembly pass alongside the 6.2
  migration notes.
- **Adds `ExtractionRecord`** (2.3) in the `presentation` layer. It is never read by
  `evaluate` (the schema 7.2 promise "adds no entity kinds [the engine consumes]"
  holds); it exists for audit and replay.
- **Proposes one additive export field**: `export.json` gains an optional
  `extractions` key carrying the extraction table when the conversational channel
  produced the assessment (report-design.md section 10 envelope; additive, schema
  MINOR). Absent for questionnaire-produced assessments; the two channels' exports
  are otherwise byte-identical for identical answers.
- **Adds nothing else**: no question content, no constraints, no statuses, no engine
  steps. The interface consumes `model-bundle.md`, `evaluate`, `nextQuestion`, and
  `Assessment`, all owned elsewhere.

---

## 7. Parity gate (REQ-KEYTEST-01)

**`llm.rule.parity-check`**: the acceptance test for any future implementation of this
boundary is mechanical, because the boundary makes it so: feed a scenario fixture's
`situation` prose through the translation contract, canonicalize the resulting
`Answer[]` (decision-engine.md 4.3), and `evaluate` must produce `EngineOutputs`
identical to the questionnaire-path fixture trace at the same version pins,
byte-for-byte after canonical serialization. Divergence is triaged by layer: a
different `Answer[]` is a translation defect (fix against the extraction rules, using
the quote spans); identical `Answer[]` with different outputs is impossible without an
engine or data change (decision-engine.md 4.1). Recommendations are therefore not
"essentially identical" across UI and LLM surfaces by aspiration but identical by
construction, which is the REQ-KEYTEST-01 bar for this deliverable.

---

## 8. Coverage check

| Requirement | Where satisfied |
|---|---|
| REQ-LLM-01 | Section 1 (same records, same engine, no separate methodology; Markdown consumption per schema 1.4); 2.2 `llm.rule.same-ids`/`llm.rule.no-direct-bindings`; section 5 end-to-end; boundary design only, nothing built (whole file) |
| REQ-ENT-11 | Section 4.4 `llm.rule.dx-firewall`; enterprise-layer.md sections 10-11 consumed, not restated |
| REQ-REPORT-01 (LLM clause) | Sections 3 and 5.4: narrate vs verbatim split; `llm.nonrole.recommending`; `llm.rule.no-report-mutation` |
| REQ-REPORT-02 | 3.2: derivation blocks quoted in the report-design display grammar; grounding in the emitted chain |
| REQ-Q-05 / REQ-MISSION-01 | 4.2: B1-B4 audit reuse, stored phrasings only, no-reorder narration, brand-via-aliases, seven `trust.*` outcomes deliverable |
| REQ-AVAIL-01/02 | 3.2: `avail.*` verbatim; future-potential always paired; 4.3 snapshot pinning |
| REQ-ORCH-10 | 2.5: unknown stays unknown; `llm.rule.engine-owns-the-interview` delegates to `nextQuestion` |
| REQ-STATE-03/04 | 2.4 `llm.rule.tense-routing`; confirm loop for implied hard answers |
| REQ-DATA-02 | 1.1: the LLM reads the generated `model-bundle.md` projection, layer-ordered |
| REQ-KEYTEST-01 | Section 7 parity gate |

Phase-8 note: the section 5 walk reuses the acquisition fixture deliberately, so the
future parity test (section 7) and the fixture trace share one ground truth; if the
translation table above ever disagrees with the brief's normalized inputs, the fixture
wins and the translation rules are fixed, never the fixture (REQ-ORCH-11).
