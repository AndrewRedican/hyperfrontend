# Microfrontend Decision Framework: Master Requirements

Status: ACTIVE. This is the single source of truth for what the decision-making-framework
package must contain. Every requirement below traces to the source conversation via the bracketed
message numbers ([2], [4], [6], [9], [11]). That conversation is not tracked here, so this
register is the surviving statement of intent.

- Source: ChatGPT conversation "Design Microfrontend Decision Framework", complete share
  (https://chatgpt.com/share/6a916f44-8938-83eb-9927-020a0452658d), retrieved and decoded
  2026-08-28. An earlier partial share (…6a916c29…) omitted messages [12]-[14].
- Operating instructions: the original brief (not tracked here)
- Research snapshot date for all ecosystem claims: **August 2026**.

---

## 0. Mission

Build a research/design package for a new docs-site area that helps engineering teams decide
**whether HyperFrontend is actually the right microfrontend approach for them**, including
recommending competitors or no microfrontends at all. [2][4]

- **REQ-MISSION-01** The goal is NOT to funnel users toward HyperFrontend; it is to help teams
  choose the approach they can operate successfully over time, even when that means another
  solution. [4]
- **REQ-MISSION-02** The central question: "Given the systems, teams, constraints, risks, and
  organizational structure involved, which composition boundary and implementation strategy
  creates the least damaging set of tradeoffs?" [4]
- **REQ-MISSION-03** Selection is a combination of eight concern areas: technical architecture;
  application/runtime constraints; organizational topology; ownership boundaries;
  migration/refactoring appetite; operational independence; risk/failure containment;
  existing-system constraints. Never reduce to "which framework has the most features". [4]
- **REQ-MISSION-04** This phase is research, taxonomy, and decision modeling. **Do not implement
  the production UI.** [4][6]

## 1. HyperFrontend thesis study (internal research)

- **REQ-THESIS-01** Deeply study the existing project before constructing the comparison model:
  read "Microfrontends from First Principles"
  (`apps/docs-site/content/articles/microfrontends-from-first-principles.md`), the docs-site
  guides/explanations/API docs, demos, and positioning. [4]
- **REQ-THESIS-02** Extract underlying principles, not article repetition. Understand why
  HyperFrontend chooses its isolation/composition boundary, without assuming iframe isolation is
  intrinsically superior or inferior; capture when stronger isolation is useful and when it is
  unnecessary overhead. [4]
- **REQ-THESIS-03** Attend to the concept list: composition boundary, runtime vs build-time
  composition, deployment independence, framework independence, shared vs isolated JS runtime,
  process/resource isolation, failure containment, ownership, org topology, Conway's Law, legacy
  integration, acquisitions, third-party/vendor apps, host vs participant control, migration
  cost, contract design, cross-boundary communication, app lifecycle, security boundaries,
  browser/platform constraints. [4]

## 2. Landscape research (external)

- **REQ-SCOPE-01** Build a comprehensive inventory of well-known MFE frameworks, composition
  systems, architectures, and adjacent technologies usable for MFEs; do not limit to projects
  that market themselves as "microfrontend frameworks". [4]
- **REQ-SCOPE-02** Candidate seed list: HyperFrontend, single-spa, Module Federation (+
  ecosystem), Native Federation, Piral, qiankun, Garfish, Luigi, Podium, OpenComponents, Bit,
  Web Components approaches, iframe approaches, server-side composition, edge-side composition,
  reverse-proxy composition, import-map architectures, Astro/islands where genuinely relevant,
  framework-specific federation, browser-native mechanisms, plus other significant discoveries. [4]
- **REQ-SCOPE-03** Do not inflate with abandoned/barely-used projects unless they materially
  illustrate a category; do not exclude an important strategy just because no branded framework
  represents it. [4]
- **REQ-SCOPE-04** The unit of comparison may be a product, framework, library, platform
  capability, or architectural strategy; make the distinction explicit per entry. [4]

## 3. Comparison matrix (Phase-1 dataset)

- **REQ-MATRIX-01** Before any decision tree/quadrant/visualization: build a large, rigid
  comparison matrix. "Evidence before abstraction." [4]
- **REQ-MATRIX-02** Attribute values restricted to: Yes / No / Conditional / Not applicable /
  Unknown (with notes where necessary). [4]
- **REQ-MATRIX-03** Attributes must be atomic and mechanically meaningful (e.g. "Can two
  independently delivered applications execute different incompatible versions of the same JS
  library without coordination?"), never vague ("good isolation"). Whenever an attribute needs a
  paragraph, decompose it. Preserve distinctions (e.g. single-spa: multiple frameworks Yes,
  lifecycle adoption required Yes, arbitrary deployed app unchanged No). [4]
- **REQ-MATRIX-04** Attribute groups to investigate (provisional, refine continuously):
  integration boundary; build-time coupling; runtime coupling; isolation & failure containment
  (JS globals, CSS, DOM, dependencies, events, storage, network, rendering failure, exception
  propagation, memory/resources, process isolation, navigation, security origin, crash
  recovery); framework requirements; ownership topology; migration requirements; deployment;
  contracts & communication; UX implications; performance (causes, not fast/slow); security &
  trust; SSR & delivery; operational model. [4]
- **REQ-MATRIX-05** Evidence rules: triangulate important claims via official docs, architecture
  docs, source code, maintainer explanations, specs/browser behavior, reputable analysis. Keep
  references attached to findings. Distinguish framework guarantee / browser guarantee / common
  pattern / possible extension / officially supported / community convention / inference. Never
  convert "possible" into "supported", "typically" into "required", or "isolated" into "secure"
  without defining the boundary. [4]
- **REQ-MATRIX-06** Machine-readable form preferred, with explanatory notes and evidence. [4]

## 4. Dimensions, families, and vocabulary

- **REQ-DIM-01** Discover latent dimensions from the matrix, do not assume them. Expect ~8-15
  deeper architectural choices explaining most differences. Candidates: runtime-boundary
  strength, integration time (build→deploy→runtime), host/participant coupling, source-code and
  artifact control, dependency/team coordination, deployment autonomy, trust boundary,
  migration cost, UX continuity, performance efficiency, operational complexity, legacy
  compatibility. [4]
- **REQ-DIM-02** Explain causal relationships between choices and consequences (e.g. shared JS
  realm → cheap communication + dependency reuse, but global/dependency coupling). The model
  must teach these relationships. [4]
- **REQ-FAM-01** Decouple vendor-neutral architectural strategies (families) from branded
  implementations. Derive a clear, precise, vendor-neutral vocabulary; names describe what the
  architecture does, not who implemented it. Hierarchy: user constraints → architectural
  requirements → strategy/family → compatible implementations → products. [6]
- **REQ-FAM-02** Families are first-class objects capturing: canonical name, plain-English name,
  definition, composition boundary, integration phase, execution model, ownership assumptions,
  coordination assumptions, isolation characteristics, deployment characteristics, migration
  requirements, advantages, inherent costs, hard limitations, works-well/works-poorly
  situations, related families, representative implementations. [6]
- **REQ-FAM-03** Implementations map to one or more families; represent multi-strategy products,
  optional modes, and orchestration-around-a-primitive honestly; never force one bucket. [6]
- **REQ-FAM-04** Cluster honestly: do not pretend branded products are more different than they
  really are. [4]

## 5. Question model and decision engine

- **REQ-Q-01** Identify the smallest number of high-information questions that eliminate the
  largest portions of the solution space (information gain). For each: why it matters, which
  dimension it exposes, which solutions it eliminates/favors, which follow-ups become relevant,
  whether the answer is hard or preference-based. Derive from the matrix, not from the example
  questions. [4]
- **REQ-Q-02** Hard constraints eliminate; preferences rank. Model at least: hard constraint,
  strong preference, weak preference, irrelevant. Never recommend an architecturally impossible
  option because it scores well elsewhere. [4]
- **REQ-Q-03** Questions form a progressively-disclosed conditional graph (not necessarily a
  tree); answers reveal follow-ups only when relevant; never a 100-question survey. [4]
- **REQ-Q-04** Recommendations permit multiple candidates with the remaining tradeoff explained;
  legitimate outcomes include "do not use microfrontends" and simpler architectures (modular
  monolith, packages, monorepo, server templates, plain Web Components, SPA routing, plain
  iframe). [4]
- **REQ-Q-05** Avoid solution-centric questioning: questions describe constraints, never
  advertise features (no "do you want superior isolation?"). [4]
- **REQ-Q-06** No universal numeric scoring. Capture requirements satisfied, hard constraints
  violated, advantages, costs, unresolved preferences, architectural consequences. Any eventual
  ranking must be contextual to answers and explainable. [4][11]
- **REQ-Q-07** Counterfactual reasoning: for each recommendation, explain what would need to
  change for another option to become preferable. [4]
- **REQ-Q-08** Identify dominance relationships (under conditions A+B+C, X offers no advantage
  over Y) to reduce question count. [4]
- **REQ-Q-09** Two-level recommendations: first the architectural strategy ("your constraints
  favor isolated runtime composition"), then implementations worth evaluating. New
  implementations can be added without rewriting the framework. [6]
- **REQ-ENGINE-01** The engine is declarative data, not imperative branching. Given answers it
  returns conceptually: satisfiedConstraints, violatedConstraints, inferredRequirements,
  candidateStrategies, excludedStrategies, candidateImplementations, unresolvedQuestions,
  tradeoffs. Every recommendation explainable from data. [6]
- **REQ-ENGINE-02** Pipeline: facts → constraints → inferred requirements → candidate strategies
  → candidate implementations, with no vendor-specific branching logic. [6]

## 6. Organizational topology and migration

- **REQ-ORG-01** Model topologies explicitly: highly coordinated product team; independent
  product teams; platform + product teams; acquisition; legacy modernization; third-party
  vendor; plugin ecosystem; white-label/embedded; organizational fragmentation. Investigate how
  each affects choice. [4]
- **REQ-ORG-02** Add B2B/B2B2C distribution topology (vendor → customer → customer's consumers
  with credentials/entitlements/embedding); research whether "distributed frontend product
  platform" deserves its own category. [9]
- **REQ-MIG-01** Model migration appetite as the cost the org will pay before integration:
  research and refine a scale spanning greenfield → trivial adaptation → integration adapter →
  bundler change → bootstrap change → moderate refactor → major refactor → framework migration →
  rewrite → practically no modification possible. [4]
- **REQ-MIG-02** Ownership situations to support: single team; multi-team one repo; multi-repo;
  independent releases; distrusted cadences; uncoordinated upgrades; acquired company; external
  vendor; host cannot modify participant; participant cannot modify host; neither controls the
  other's deployment. [4]

## 7. Current-state vs future-state (Conway's Law layer)

- **REQ-STATE-01** For every relevant dimension distinguish: current state, desired future
  state, willingness to change, cost of change, authority to change, confidence the change
  happens, time horizon. [9]
- **REQ-STATE-02** Current-state fit is the default recommendation posture; architecture adapts
  to organizational reality unless the user demonstrates willingness AND capacity to change. [9]
- **REQ-STATE-03** Ask desirability separately from readiness ("would independent deployment be
  valuable?" vs "are teams prepared and authorized to change ownership/release processes?"). [9]
- **REQ-STATE-04** Organizational-change confidence scale (refine): no change possible; change
  undesirable; theoretically possible; planned not approved; leadership approved; teams
  committed; actively transitioning; already operating in target model. Aspirational != existing. [9]
- **REQ-STATE-05** Before recommending change-dependent solutions, look for buy-in signals
  (executive sponsorship, team agreement, ownership defined, platform responsibility, budget,
  timeline, staffing, governance plan, release-process agreement); warn when absent. [9]
- **REQ-STATE-06** Support dual output: "best fit today" and "best fit after planned
  transition". [9]
- **REQ-STATE-07** Model transition architectures (current → transition → target); a transition
  architecture may legitimately become permanent. [9]
- **REQ-STATE-08** Compare costs in three parts: cost to adopt now, cost to operate, cost to
  evolve. [9]
- **REQ-STATE-09** Include trajectory questions (topology stability, approved vs aspirational
  goals, consolidation vs diversity, legacy disappearance, temporary vs indefinite integration,
  funded transition work, authority, "what happens if the transition never occurs?"). [9]
- **REQ-STATE-10** Recommendation risk categories: architecturally suitable, organizationally
  suitable, operationally achievable, transition-dependent. [9]
- **REQ-STATE-11** Principle: never recommend restructuring an organization to satisfy a
  preferred technology absent independent justification; Conway's Law is a design input. [9]
- **REQ-STATE-12** Decision ordering: what exists today → immovable constraints → desired
  outcomes → approved/achievable changes → families fitting current state → families also
  supporting credible target state → implementation satisfying operational requirements →
  community/self-managed vs enterprise/managed → what would change this recommendation. [9]

## 8. Enterprise capability layer (HyperFrontend Enterprise context)

Background: HyperFrontend will eventually add a commercial edition ("HyperFrontend
Enterprise", AG Grid community/enterprise analogy) with managed hosting (apps + feature
shells), ephemeral ticket-based backchannel data exchange (TTL, post/retrieve, WebSocket-style
subscribe), managed authentication, RBAC/roles/admin, an Artifactory/npm-style feature registry
(review, install, usage monitoring, rollback), contract versioning/resolution (notional v3
enterprise security protocol), and consumer API-key/subscription/entitlement management with a
headless API or embeddable dashboard (dogfooded through HyperFrontend). AI/LLM Dev Assist spans
Community and Enterprise. [7 transcript msg id: [7]; guidance [9]]

- **REQ-ENT-01** Three layers, never conflated: architectural strategy; open-source/community
  implementation; commercial/enterprise operating model. Enterprise features must not distort
  the architectural taxonomy; the same applies to competitors' commercial offerings. [9]
- **REQ-ENT-02** Model implementation editions explicitly (e.g. hyperfrontend-community /
  hyperfrontend-enterprise); attach capabilities at the correct level; never mark HyperFrontend
  generally as having an Enterprise-only capability; never downgrade Community for lacking
  managed services. [9]
- **REQ-ENT-03** Add an enterprise-operability question dimension (self-host vs managed, private
  registry, approval workflows, org-wide RBAC, audit logs, environment promotion, one-click
  rollback, usage visibility, contract compatibility checking, central contract resolution,
  enterprise auth integration, external consumer credentials, subscription/entitlement,
  managed-service preference). These influence implementation/edition selection, not family
  selection. [9]
- **REQ-ENT-04** Managed hosting decomposes into artifact hosting, application hosting,
  metadata/control-plane hosting, runtime delivery, environment promotion, private/public
  distribution, customer-managed vs vendor-managed; never a single `managedHosting: true`. [9]
- **REQ-ENT-05** Ephemeral mediated backchannel is a distinct integration primitive (temporary
  payload storage, TTL, ticket references, publish/retrieve, optional subscription delivery,
  access control, encryption, auditability, bounded retention); compare against postMessage,
  events, shared state, direct APIs, pub/sub, queues, server messaging, BFF; identify exactly
  what it solves and does not. [9]
- **REQ-ENT-06** Separate identity dimension: host/participant/shared identity, propagation,
  delegated authorization, service credentials, consumer API credentials, tenant/user/feature
  identity; authn distinct from authz; enterprise coordination needs (bootstrap, token
  exchange, scopes, tenant context, rotation, key issuance, sessions). [9]
- **REQ-ENT-07** Governance as independent atomic capabilities: governance.rbac, .audit-log,
  .approval-workflow, .environment-promotion, .artifact-review, .policy-enforcement,
  .usage-monitoring, .rollback, .contract-validation. [9]
- **REQ-ENT-08** Registry model distinguishes code/package registry vs deployable feature
  registry vs commercial feature marketplace. [9]
- **REQ-ENT-09** Contract governance is a first-class dimension: definition, versioning,
  compatibility checking, negotiation, runtime resolution, schema validation, deprecation,
  consumer/provider compatibility. Enterprise protocols are edition capabilities, not taxonomy
  rewrites. [9]
- **REQ-ENT-10** Headless vs managed vs embeddable vs customer-owned admin UI distinction;
  embeddable management is a dogfooding case, kept out of the neutral framework. [9]
- **REQ-ENT-11** AI Dev Assist is a cross-cutting developer-experience capability, never a
  primary architectural criterion; AI consumes the same canonical framework and evidence. [9]

## 9. Availability, market gaps, and transparency

- **REQ-AVAIL-01** Model product availability for every implementation including HyperFrontend:
  available today / available but immature-limited / announced-planned / future-roadmap /
  deprecated / inactive / unavailable. Never recommend a future HyperFrontend Enterprise
  capability as though it exists. [11]
- **REQ-AVAIL-02** When a planned capability fits strongly but another implementation satisfies
  the need today, show BOTH ("best available today" + "potential future fit" with status
  "planned / not currently available"); never obscure a usable competitor. [11]
- **REQ-AVAIL-03** Availability is not compatibility: model architectural fit, organizational
  fit, operational fit, transition fit, availability, maturity/confidence, adoption cost as
  independent factors; any summary indicator must decompose into them. [11]
- **REQ-GAP-01** Support the outcome "no strong off-the-shelf solution satisfies all hard
  constraints"; never lower the bar until something wins; identify the exact gap. [11]
- **REQ-GAP-02** Represent unsatisfied constraint combinations as first-class gap records
  (gapId, constraints, discoveredFrom, currentCandidates, unmetCapabilities); classify where
  Community/Enterprise could expand, where another family is better positioned, or where the
  combination is inherently contradictory; not every gap is a HyperFrontend roadmap item. [11]
- **REQ-GAP-03** When nothing fits, generate a constraint-relaxation path from the same model:
  the smallest meaningful changes that open viable options, preserving the user's intended
  composition boundary first (relax org/deployment/timeline/ownership/governance/UX/infra
  before proposing a different boundary; make consequences explicit). [11]
- **REQ-TRUST-01** The system must be willing to produce ALL of: HF Community strongest; another
  OSS strongest; a commercial competitor strongest; HFE likely fit but unavailable (use X
  today); no strong current match; you probably do not need microfrontends; viable only if you
  change specific assumptions. Neutrality is the core value proposition. [11]

## 10. Lead capture and privacy

- **REQ-LEAD-01** When requirements align with planned HFE capabilities, allow opt-in interest
  (updates when available, contact-when-relevant, extra context, capability feedback). Never
  imply a delivery date ("get updates when this becomes available", not "we'll contact you in
  three months"). [10 transcript [10]; guidance [11]]
- **REQ-LEAD-02** The recommendation is generated BEFORE any contact ask; an email is never
  required to see results. [11]
- **REQ-LEAD-03** Contact fields minimal: name, email, optional company/role/context; explain
  exactly why each is requested. [11]
- **REQ-LEAD-04** Strict separation of local decision state (answers, constraints, scenarios,
  report title, result; browser-only) from explicit submission; never silently transmit
  answers/company/strategy; contextual attachment is explicit opt-in. [11]

## 11. Client-side operation and report generation

- **REQ-LOCAL-01** Initial release runs entirely without a HyperFrontend backend; no account, no
  server-side persistence; decision state lives in the browser (evaluate localStorage /
  IndexedDB / URL state / downloadable decision files; simplest sufficient). Users can return
  later and can explicitly clear their saved strategy. [11]
- **REQ-LOCAL-02** Optional local label (company or strategy name) used only to title the
  output; clearly communicated as never sent to HyperFrontend; any label accepted. [11]
- **REQ-REPORT-01** Deterministic (non-LLM) report engine: report produced from answers,
  normalized constraints, implications, rules, strategy/implementation matches, evidence,
  availability, risk, unresolved questions. Repeatable, auditable, testable, offline-capable,
  comparable across versions. An LLM may later summarize but never authors the recommendation. [11]
- **REQ-REPORT-02** Traceable reasoning: conclusions cite the answers/rules that produced them
  (Q04 → "no host rebuild" style); reasoning inspectable even if rule syntax is hidden by
  default. [11]
- **REQ-REPORT-03** Report is a real strategy document worth sharing with architects, EMs,
  CTOs, platform teams. Candidate sections: executive summary; current state; desired state;
  hard constraints; preferences; organizational topology; architectural strategy; candidate
  implementations; HyperFrontend fit; availability; tradeoffs; risks; alternatives considered;
  what would change this recommendation; transition path; unresolved questions; evidence. [11]
- **REQ-REPORT-04** Communicate uncertainty with statuses (strong/viable/conditional/weak match,
  incompatible, insufficient information, no current strong match, future potential match);
  scores if any are visualization aids. [11]
- **REQ-REPORT-05** Browser-side exports: printable HTML, print-to-PDF, Markdown, JSON,
  downloadable snapshot; JSON re-importable and consumable by other interfaces; report records
  frameworkVersion + researchVersion. [11]
- **REQ-REPORT-06** Versioned assessments: record created date, decision-model version, research
  snapshot version; on return, surface "newer research available"; never silently mutate an old
  report; reassessment is deliberate. [11]

## 12. Canonical data model and LLM interface

- **REQ-DATA-01** The dataset is the product; the page is one interface. Reasoning must not live
  in React components/visualization/imperative branching. Consumers: interactive page,
  questionnaire, architect matrix, visual maps, static docs, future CLI, future HF AI
  assistant, external LLM agents, automated report generation. [6]
- **REQ-DATA-02** Design a canonical declarative schema (JSON/TS data/YAML/MDX frontmatter or a
  combination; determine, do not assume); entities conceptually include metadata, dimensions,
  questions, capabilities, strategies, implementations, scenarios, evidence; derive the actual
  schema from research. Must be transformable to Markdown for LLM consumption. [5 transcript
  [5]; guidance [6]]
- **REQ-DATA-03** Questions are data (id, text, explanation, audience, dimension, answerType,
  answers, prerequisites, implications, exclusions, preferences, followUpQuestions;
  refine). Another program or LLM must traverse the graph without understanding the UI. [6]
- **REQ-DATA-04** Separate observed facts, derived architectural implications, decision rules,
  and preferences; never mix into opaque scores. [6]
- **REQ-DATA-05** Provenance on facts: value, confidence, evidence refs, verifiedAt; conditional
  values carry their condition. The model must answer "why does the framework believe this?". [6]
- **REQ-DATA-06** Stable machine identifiers for every meaningful concept (e.g.
  `runtime.shared-js-realm`, `isolation.document-boundary`); wording may evolve, identity may
  not. [6]
- **REQ-DATA-07** Dating/versioning metadata throughout: research version, researched-at,
  last-reviewed, source review dates, implementation versions where material, project status at
  research time, schema version; user-facing "Last reviewed: <date>"; individual records
  refreshable independently. [6]
- **REQ-LLM-01** LLM interface model: a conversational description ("we bought a company, their
  portal is AngularJS...") translates to the same normalized constraints and queries the same
  framework; the LLM never invents a separate methodology. Design the boundary only, do not
  build it. [6]
- **REQ-TEST-01** Scenario fixtures exercise the framework without the website (e.g.
  acquisition-no-rewrite, coordinated-greenfield-platform, third-party-widget,
  legacy-angular-modernization, independent-react-teams, single-team-modular-monolith,
  plugin-marketplace) with constraints and expected broad outcomes; tests catch rule-change
  regressions. The decision model is testable standalone. [6]
- **REQ-KEYTEST-01** Architecture acceptance test: remove every branded implementation and the
  landscape explanation must remain coherent; add them back as examples. Replace the UI with a
  CLI or LLM and recommendations must be essentially identical. If either fails, redesign. [6]

## 13. Audiences, tone, and framing

- **REQ-AUD-01** Two audiences: architects (direct path to detailed matrix, isolation
  guarantees, runtime boundaries, SSR, dependency sharing, deployment, communication semantics,
  ownership, migration) and MFE-unfamiliar users (early questions phrased in circumstances they
  understand, e.g. "can the host be rebuilt and redeployed whenever a new application is
  added?"; system infers the architectural consequence; terminology taught progressively; never
  dumbed-down reasoning). [4] AMENDED 2026-08-30: satisfied by one professional prompt per
  question plus an optional technical note, rather than by two alternative phrasings the
  reader switches between. Asking the reader to pick a register was itself a failure to word
  the question clearly, and it split the audiences the requirement asks to serve together.
- **REQ-FRAME-01** Explicitly present the methodology as first-principles ("starts with
  boundaries, ownership, deployment, coordination, isolation, and change constraints, then
  derives which strategies fit"); link the Medium/docs article "Microfrontends from First
  Principles" naturally (intro, methodology panel, report footer, "How this works", architect
  view); do not promote it repeatedly. [11]
- **REQ-FRAME-02** Quality bar: an experienced architect can argue with individual assumptions
  rather than dismissing it as marketing; a novice can answer questions about their own
  situation without MFE vocabulary; users leave thinking "I understand why these options exist,
  what tradeoff each makes, and which match my circumstances." [4]

## 14. Future UI direction (design inputs only, no implementation now)

- **REQ-UI-01** Representations to explore: guided decision journey; interactive decision
  graph; capability matrix; architectural map with architecturally meaningful axes (never
  "simple vs complex"); multi-dimensional explorer (selectable axes, radar, parallel
  coordinates, clusters, filters, constraint maps, heatmaps, Venn-like sets, topology maps).
  Representation must improve understanding, never decoration. [4]
- **REQ-UI-02** Visual quality target: flagship piece; highly interactive, spatial, exploratory,
  technically sophisticated, responsive, fluid; 3D acceptable where it genuinely improves the
  mental model; answering questions visibly changes the feasible space (recede, disconnect,
  collapse, fade, move out, reveal dimensions). Canonical data stays renderer-independent. [5][6]
- **REQ-UI-03** Dependency policy: prefer existing workspace capabilities; Three.js and D3 may
  be considered with explicit evaluation (capability needed, existing primitives, bundle cost,
  maintenance, accessibility, mobile, graceful degradation, genuine value); must work on
  constrained devices; sophisticated desktop visuals must not make the framework inaccessible
  on mobile. [5][6]
- **REQ-UI-04** For each proposed visualization concept explain: what users learn, interaction
  model, accessibility strategy, mobile behavior, rendering technology, dependency
  implications, performance implications, how it consumes canonical data. Include at least one
  ambitious spatial/3D concept. [6]

## 15. Maintenance and evolution

- **REQ-MAINT-01** Strategy for periodic refresh without redesigning the system: new
  implementations, abandoned projects, capability changes, new families, changed evidence,
  historical recommendations, schema evolution. [6]

## 16. Deliverables register (research/design package)

| #  | Deliverable | Location |
|----|-------------|----------|
| 1  | Landscape inventory (inclusion/exclusion rationale) | [research/landscape-inventory.md](research/landscape-inventory.md) |
| 2  | Canonical comparison matrix (machine-readable + notes) | [matrix/](matrix/) |
| 3  | Taxonomy (refined categories + dimensions) | [model/taxonomy.md](model/taxonomy.md) |
| 4  | Architectural families (clustered honestly) | [model/families.md](model/families.md) |
| 5  | Constraint model (hard/preference/derived/dependencies) | [model/constraints.md](model/constraints.md) |
| 6  | High-information questions (+ what each eliminates) | [model/questions.md](model/questions.md) |
| 7  | Question graph (conditional relevance) | [model/question-graph.md](model/question-graph.md) |
| 8  | Organizational-topology model | [model/topology.md](model/topology.md) |
| 9  | Migration/refactoring model | [model/migration.md](model/migration.md) |
| 10 | Candidate visual models | [ux/visualization-concepts.md](ux/visualization-concepts.md) |
| 11 | Example decision journeys (7+ scenarios incl. "should not use MFEs") | [scenarios/](scenarios/) |
| 12 | HyperFrontend positioning (emergent, not presupposed) | [positioning/hyperfrontend-positioning.md](positioning/hyperfrontend-positioning.md) |
| 13 | Vendor-neutral strategy catalogue | [model/families.md](model/families.md) |
| 14 | Implementation catalogue (products → strategies) | [research/solutions/](research/solutions/) + [model/implementations.md](model/implementations.md) |
| 15 | Canonical data-model proposal (+ real-finding examples) | [model/schema-proposal.md](model/schema-proposal.md) |
| 16 | Decision-engine model | [model/decision-engine.md](model/decision-engine.md) |
| 17 | LLM interface model (boundary only) | [model/llm-interface.md](model/llm-interface.md) |
| 18 | Visualization concepts (several, 1+ spatial/3D) | [ux/visualization-concepts.md](ux/visualization-concepts.md) |
| 19 | Maintenance/versioning strategy | [maintenance/versioning-strategy.md](maintenance/versioning-strategy.md) |

Cross-cutting artifacts added by addenda: enterprise capability layer
([model/enterprise-layer.md](model/enterprise-layer.md)), current/future-state model
([model/state-transition.md](model/state-transition.md)), availability + market gaps
([positioning/market-gaps.md](positioning/market-gaps.md)), report design
([ux/report-design.md](ux/report-design.md)), HyperFrontend thesis extraction
([research/hyperfrontend-thesis.md](research/hyperfrontend-thesis.md)).

## 17. Working method and operating constraints

- **REQ-METHOD-01** Iterative loop: research → add properties → discover ambiguity → split
  properties → compare again → discover dimensions → test dimensions against solutions → refine
  questions → test with scenarios. Never one pass over homepages then UI. Taxonomy changes
  flow back into the dataset; equivalences and newly discovered distinctions update
  properties; many-properties-one-choice relationships get captured explicitly. [4]
- **REQ-OPS-01** All work durable and auditable in one project folder; nothing git-tracked.
  [prompt.md] SUPERSEDED 2026-08-29: the research core was promoted into the repository at
  `apps/docs-site/notes/decision-framework/` so that the model behind the published dataset
  and its drift guard are versioned with the dataset. The process layer stays untracked.
- **REQ-OPS-02** Iterative progress; each research thread sized 5-10 minutes max; no
  long-running blocking processes. [prompt.md]
- **REQ-OPS-03** Link between artifacts instead of repeating content. [prompt.md]
- **REQ-OPS-04** Follow the workspace implementation-plans skill conventions for the phase
  plan (adapted to research deliverables). [prompt.md note 6]

## 18. Orchestration requirements (index prompt, messages [12] and [14])

- **REQ-ORCH-01** Every Markdown guidance file of the original brief (the prompt plus the
  five documents embedded in the source conversation, neither tracked here) forms ONE cohesive
  specification with equal authority. Reconstruct complete intent, reconcile tensions by
  overall direction, preserve nuance. [14]
- **REQ-ORCH-02** All durable artifacts live in one dedicated folder, now this notes
  directory. Original guidance files stay untouched outside it. [12][14]
- **REQ-ORCH-03** Persist anything representing accumulated knowledge or expensive to
  reconstruct (plans, methodology, research log, evidence catalogue, inventory, taxonomy,
  glossary, matrix, datasets, models, rules, gaps, scenarios + results, schema proposals,
  engine design, report model, visualization/UX concepts, decisions, unresolved questions,
  rejected approaches, validation results). Choose formats (MD/JSON/YAML/TS/CSV) by eventual
  consumption. [14]
- **REQ-ORCH-04** Maintain [README.md](README.md) as the workspace index: what the project is,
  current phase, which artifacts exist and contain what, which are authoritative, decisions
  made, outstanding questions, next work. Another agent must be able to resume without the
  conversation history. [14]
- **REQ-ORCH-05** Maintain a state record: current phase, completed work, current
  conclusions, important decisions, open questions, known uncertainties, research still
  required, next recommended actions. Its surviving half is [BACKLOG.md](BACKLOG.md). Filesystem is the durable memory. [14]
- **REQ-ORCH-06** Work in explicit phases with gates and meaningful completion criteria; no
  final decision tree while the taxonomy still churns; no schema before entities are
  understood; no visualization while the model is unstable; no production recommendations
  before scenario testing. Expect iteration; revise earlier artifacts rather than preserving a
  weak taxonomy. [14]
- **REQ-ORCH-07** Research → record evidence → normalize facts → compare → discover
  distinctions → refine taxonomy → compare again → derive principles. Never define the
  universe relative to HyperFrontend; the landscape emerges from evidence. [14]
- **REQ-ORCH-08** Preserve the chain source evidence → observed facts → normalized capabilities
  → architectural implications → decision rules → recommendations, so questionable
  recommendations can be traced to the failing layer. [14]
- **REQ-ORCH-09** Research is resumable: record what was researched, sources, when, which
  claims supported, which uncertain, what needs further work. Date everything. [14]
- **REQ-ORCH-10** The engine tolerates unanswered questions: determine when information
  suffices to eliminate/retain/conditionally recommend/flag uncertainty; design toward "what is
  the single most useful thing to ask next?". [14]
- **REQ-ORCH-11** Scenario-test continuously and earlier than final implementation; when a
  recommendation feels wrong, fix the abstraction, never add special-case vendor rules. [14]
- **REQ-ORCH-12** Avoid artifact explosion: few coherent artifacts first, split only when
  navigation, format, cadence, or stabilized concepts demand it. [14]
- **REQ-ORCH-13** Do not assume this untracked workspace is the permanent runtime location; at
  production time explicitly decide what remains research, becomes tracked docs, production
  data, tests/fixtures, or generated output. Never copy everything into production. [14]
- **REQ-ORCH-14** Production docs-site code comes last, after research, evidence, taxonomy,
  canonical data model, decision semantics, scenario validation, report semantics, UX
  direction, and an implementation plan are stable. Small clearly-labeled prototypes are
  allowed. (Out of scope for the current execution per prompt.md: "we are not refactoring
  code".) [14]
- **REQ-ORCH-15** Manage context deliberately: externalize conclusions as reached; before
  ending a session update state, conclusions, unresolved questions, completed work, exact next
  step. [14]
