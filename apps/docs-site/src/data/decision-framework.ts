/**
 * The canonical dataset behind the decision framework page.
 *
 * This file is a projection of the decision-framework research workspace, flattened
 * for rendering: twelve architectural families, the family-stage question set with its
 * verified elimination sets, and the implementation catalogue. The research snapshot it
 * projects was taken in August 2026 and last reviewed on 2026-08-29.
 *
 * The reasoning behind every entry (the attribute matrix, the constraint bindings, the
 * per-unit dossiers, and the derivation rules that justify each elimination) lives in
 * the decision-framework research workspace, not here. Nothing in this file should be
 * edited to change a verdict: change the workspace, then re-project.
 *
 * @module decision-framework
 */

/**
 * Whether a family is a microfrontend strategy or one of the honest non-microfrontend
 * alternatives the framework must be able to recommend instead.
 */
export type FamilyKind = 'microfrontend' | 'baseline'

/**
 * How obtainable an implementation is today. Announced and roadmap capabilities are
 * never scored as though they exist.
 */
export type Availability =
  | 'available'
  | 'available-immature'
  | 'announced-planned'
  | 'future-roadmap'
  | 'deprecated'
  | 'inactive'
  | 'unavailable'

/**
 * How strongly an answer binds: an eliminating constraint, a ranking signal that
 * reports violations as tradeoffs, or a tie-break.
 */
export type AnswerClass = 'hard' | 'strong-preference' | 'weak-preference'

/**
 * One plotted axis: the property it measures, plus the two poles a reader sees at the
 * ends of the scale.
 */
export interface AxisPole {
  /** Short plain-language name of what the axis measures. */
  label: string
  /** The zero end of the scale, phrased as a situation. */
  low: string
  /** The hundred end of the scale, phrased as a situation. */
  high: string
}

/**
 * The assembly-locus channel, which carries three poles rather than two: composition on
 * the request path is a position the evidence separates, not a midpoint between the other
 * two.
 */
export interface DepthPoles {
  /** Short plain-language name of what the channel measures. */
  label: string
  /** The zero end of the scale, phrased as a situation. */
  low: string
  /** The fifty mark, where a server assembles the page as it is requested. */
  mid: string
  /** The hundred end of the scale, phrased as a situation. */
  high: string
}

/**
 * The two axes the solution-space plot is drawn on, chosen because they separate the
 * families on evidence rather than on layout convenience, plus the depth channel drawn
 * alongside them.
 */
export interface AxisPair {
  /** Horizontal axis: when the parts are joined. */
  x: AxisPole
  /** Vertical axis: how separated the running parts are. */
  y: AxisPole
  /** Third channel: where composition actually executes. */
  depth: DepthPoles
}

/**
 * Where one family sits in the plotted space. Every value is 0 to 100, and only the
 * ordering and the collisions are claims: a 20-point gap is not twice a 10-point gap.
 */
export interface FamilyPosition {
  /** Integration time: 0 ships everything together, 100 admits parts into a running page. */
  x: number
  /** Runtime realm: 0 is one shared runtime, 100 is a browser-enforced separation. */
  y: number
  /** Assembly locus as depth: 0 is composed in your build, 100 is composed in the browser. */
  depth: number
}

/**
 * A group of families the evidence does not separate, recorded as a finding rather than
 * derived from the coordinates.
 *
 * A mechanical rule over the positions contradicts the research by a single point: islands
 * sits 13 apart on Y from the other four it is grouped with, one point outside the smallest
 * difference the plot may claim, so a threshold would split a group the evidence keeps
 * together. Widening the threshold to reach the same answer would be a fudge factor dressed
 * as a computation.
 */
export type FamilyClusterId = 'cluster.build-fused-five' | 'cluster.federation-lifecycle'

/**
 * One architectural family: a group of strategies sharing a composition boundary,
 * described without naming any product.
 */
export interface Family {
  /** Stable family id, used verbatim from the research workspace, such as family.document-embedding. */
  id: string
  /** Canonical name of the architecture, describing what it does rather than who built it. */
  name: string
  /** The same architecture restated for a reader who has never met the vocabulary. */
  plainName: string
  /** Whether this is a microfrontend strategy or a non-microfrontend baseline. */
  kind: FamilyKind
  /** One to three sentences fixing what the architecture is, self-contained and brand-free. */
  definition: string
  /** The participant-facing contract, in a short phrase. */
  boundary: string
  /** When participants meet: at build, at deploy, or inside a running document. */
  integrationPhase: string
  /** Where the family sits on the two plotted axes, plus the assembly-locus depth channel. */
  position: FamilyPosition
  /** The cluster this family shares with families the evidence cannot tell it apart from, absent when it stands alone. */
  clusterId?: FamilyClusterId
  /** What this architecture buys that its neighbours do not. */
  advantages: string[]
  /** What every adopter pays, whatever the product or vendor. */
  costs: string[]
  /** Things this architecture cannot do at all, however well it is implemented. */
  limitations: string[]
  /** Circumstances in which this architecture is the honest recommendation. */
  worksWellWhen: string[]
  /** Circumstances in which choosing it will hurt. */
  worksPoorlyWhen: string[]
}

/**
 * One selectable answer to a question, carrying the elimination it justifies.
 */
export interface Answer {
  /** Stable answer id, formed as the question id plus a short slug after a hash. */
  id: string
  /** The user-facing choice, written as a circumstance rather than a capability. */
  label: string
  /** Optional single line that removes an ambiguity in the choice. */
  detail?: string
  /** Whether choosing this eliminates candidates or only ranks them. */
  answerClass: AnswerClass
  /** Family ids removed from the candidate set when this answer is chosen. */
  eliminates: string[]
  /** Family ids this answer ranks upward without removing anything. */
  favors: string[]
  /** One sentence naming what the answer means architecturally, shown as the derivation. */
  consequence: string
}

/**
 * One edge that makes a later question relevant: an earlier question paired with the
 * answer to it that opens the follow-up.
 */
export interface QuestionUnlock {
  /** The earlier question whose answer decides whether the follow-up is asked. */
  questionId: string
  /** The specific answer to that question which opens the follow-up. */
  answerId: string
}

/**
 * One family-stage question, in both the phrasing an architect expects and the
 * phrasing that describes a circumstance.
 */
export interface Question {
  /** Stable question id, used verbatim from the research workspace. */
  id: string
  /** Position in the ranked index, ordered by how much of the landscape the worst answer removes. */
  rank: number
  /** The plain-language phrasing, describing a situation rather than a mechanism. */
  circumstance: string
  /** The technical phrasing, which exposes the underlying attribute vocabulary. */
  architect: string
  /** One sentence on what this question buys that no other question buys. */
  why: string
  /** The taxonomy dimension the answers position the reader on. */
  dimension: string
  /** The two to four answers, each with its own class and elimination set. */
  answers: Answer[]
  /** Earlier answers that make this question relevant; absent when it is always asked. */
  unlockedBy?: QuestionUnlock[]
}

/**
 * One adoptable product, practice, or edition, mapped onto the families it realizes.
 */
export interface Implementation {
  /** Stable implementation id, used verbatim from the research workspace. */
  id: string
  /** Name as its maintainers write it. */
  name: string
  /** Every family id this implementation realizes; more than one when it is mode-forked. */
  families: string[]
  /** How obtainable it is today, stated per release line where lines diverge. */
  availability: Availability
  /** Which edition this entry describes, when the unit splits into editions. */
  edition?: string
  /** One sentence on what separates it from its same-family neighbours. */
  differsBy: string
  /** Canonical documentation or repository address. */
  url?: string
  /** One short maintenance or stewardship caveat an adopter should weigh. */
  note?: string
}

/**
 * Which side of the composition a floor entry binds on: the app being composed, the page
 * doing the composing, or neither, when the entry is a hard incompatibility instead.
 */
export type FloorSide = 'participant' | 'host' | 'blocker'

/**
 * One entry of the hyperfrontend floor: a requirement the architecture places on an
 * adopter, or a circumstance under which willingness and budget do not produce viability.
 */
export interface FloorRequirement {
  /** Stable floor id, used verbatim from the research workspace, such as floor.host.own-geometry. */
  id: string
  /** Whether the entry binds the participant, binds the host, or blocks outright. */
  side: FloorSide
  /** The requirement in one plain sentence a reader can check against their situation. */
  summary: string
  /** The technical detail behind the requirement, stated as a cost or an absence. */
  detail: string
  /** What would make it satisfiable, or the honest statement that nothing can. */
  whatWouldHaveToChange: string
  /** Answer ids whose selection contradicts this entry, empty when no answer does. */
  conflictsWith: string[]
}

/**
 * Provenance of the projection: which versions produced it, when the landscape was
 * surveyed, and how large the evidence base behind it is.
 */
export interface FrameworkMetadata {
  /** Version of the framework content itself. */
  frameworkVersion: string
  /** Version of the shape this file is projected into. */
  schemaVersion: string
  /** When the landscape behind these verdicts was surveyed. */
  researchSnapshot: string
  /** Date this projection was last checked against the workspace. */
  lastReviewed: string
  /** How many units of comparison the underlying matrix scores. */
  unitCount: number
  /** How many attributes each unit is scored against. */
  attributeCount: number
}

/**
 * The whole projected dataset: provenance metadata, families, questions, implementations.
 */
export interface DecisionFramework {
  /** Provenance of this projection: its own versions, the snapshot behind it, and the evidence base size. */
  metadata: FrameworkMetadata
  /** The two axes the families are plotted on and the depth channel, with their pole labels. */
  axes: AxisPair
  /** Every architectural family, microfrontend and baseline alike. */
  families: Family[]
  /** The family-stage question set, in ranked order. */
  questions: Question[]
  /** What hyperfrontend requires of each side, and what it cannot do at any price. */
  hyperfrontendFloor: FloorRequirement[]
  /** The catalogue of products and editions mapped onto the families. */
  implementations: Implementation[]
}

/**
 * The projected decision framework, consumed by the decision framework page.
 */
export const decisionFramework: DecisionFramework = {
  metadata: {
    frameworkVersion: '0.1.0',
    schemaVersion: '0.1.0',
    researchSnapshot: 'August 2026',
    lastReviewed: '2026-08-29',
    unitCount: 30,
    attributeCount: 220,
  },
  axes: {
    x: {
      label: 'When the parts are joined',
      low: 'One build, one deploy, one release',
      high: 'Parts join, leave and change at runtime',
    },
    y: {
      label: 'How separated the running parts are',
      low: 'One shared runtime: a fault reaches all',
      high: 'Separate documents, browser-enforced',
    },
    depth: {
      label: 'Where the parts are put together',
      low: 'Composed in your build',
      mid: 'Composed by a server on each request',
      high: 'Composed in the browser',
    },
  },
  families: [
    {
      id: 'family.route-partition',
      name: 'URL route partitioning',
      plainName:
        'Several independently deployed applications share one domain; each owns a set of URLs, and a router in front decides which application serves each navigation.',
      kind: 'microfrontend',
      definition:
        'Independently deployed frontend applications are mapped onto disjoint URL path prefixes of a single origin. A routing tier, a reverse proxy, a CDN configuration, or a platform router, forwards each top-level navigation to the owning application, which serves a complete document. Composition happens between pages, so no page ever contains two participants.',
      boundary: 'URL path prefix, expressed as a routing table plus shared-origin conventions',
      integrationPhase: 'deploy-decoupled',
      position: { x: 53, y: 93, depth: 45 },
      advantages: [
        'The lowest adaptation demand in the landscape: mixed and frozen stacks participate unmodified',
        'The most common real-world microfrontend in practice, frequently adopted without anyone naming it',
        'Blast radius is one navigation rather than one region of a shared page',
        'Day-to-day coordination reduces to origin conventions: cookie scope, URL namespace, shared visual assets',
      ],
      costs: [
        'Every boundary crossing is a full document load',
        'Shared chrome cannot persist and is duplicated inside each participant',
        'Visual and version consistency hold by convention only',
        'Cross-application state has to travel through cookies, storage, or the URL',
      ],
      limitations: [
        'Two teams can never put output on one screen',
        'A product whose screens are inherently mixtures is out of scope by construction',
      ],
      worksWellWhen: [
        'Team boundaries line up with rarely crossed journey seams, such as marketing site versus application',
        'You are migrating off a monolith one URL area at a time',
        'The estate is heterogeneous or frozen and cannot be rebuilt',
      ],
      worksPoorlyWhen: [
        'Dashboards, consoles, and marketplaces where one screen mixes owners',
        'Products that need persistent chrome or frequent hops across the boundary',
        'Teams expecting single-page transitions across boundaries',
      ],
    },
    {
      id: 'family.server-fragment-assembly',
      name: 'Request-path fragment assembly',
      plainName:
        'A composer on the request path builds each page by fetching HTML pieces from separately deployed fragment services and stitching them together before the browser sees the page.',
      kind: 'microfrontend',
      definition:
        'Participants are services that answer HTTP requests with HTML fragments. A composition tier on the request path, an origin layout service, a cache tier processing include directives, or a programmable edge worker, fans out to those services, assembles one document, and streams it to the browser. The browser receives an already composed page.',
      boundary: 'An HTTP endpoint that takes a request with propagated context and returns HTML',
      integrationPhase: 'deploy-decoupled',
      position: { x: 73, y: 6, depth: 55 },
      advantages: [
        'Composed first paint and crawler-indexable content with no client script',
        'The lowest client-side JavaScript budget of any region-granular family',
        'Per-fragment HTTP caching is first-class',
        'Genuine team independence at the service level, with server-side process isolation',
      ],
      costs: [
        'Request-time server fanout sits on the critical path',
        'An estate of services has to be operated, with on-call surfaces per team',
        'Navigations reload the document, so persistent chrome is lost',
        'Client-side interactivity coordination is adopter-built',
      ],
      limitations: [
        'No client-side isolation between fragments once they are delivered into one document',
        'A hard mismatch for organizations that only ship files to static hosting',
        'Development and production parity requires running the composer locally',
      ],
      worksWellWhen: [
        'Content and commerce surfaces where search indexing matters',
        'The organization already has real server operations capacity',
        'Multi-team pages with modest client-side interactivity',
      ],
      worksPoorlyWhen: [
        'Static-hosting shops with nothing operated on the request path',
        'Heavily interactive products that want client-side soft navigation',
        'Organizations without platform or operations investment',
      ],
    },
    {
      id: 'family.custom-element-composition',
      name: 'Custom-element composition',
      plainName: 'Each piece ships as an HTML tag; the host builds a page by placing tags, and the browser does the rest.',
      kind: 'microfrontend',
      definition:
        'Participants are packaged as custom elements, optionally with shadow DOM style scoping, that encapsulate an application or a widget. The host composes by placing elements, and attributes, properties, and DOM events form the contract. The seam is a browser standard, so nothing strategy-owned has to ship on the page.',
      boundary: 'The DOM custom-element interface: tag name, attributes and properties in, events out',
      integrationPhase: 'deploy-decoupled, also usable build-fused',
      position: { x: 62, y: 12, depth: 100 },
      advantages: [
        'Standards lifetime: the seam outlives every framework and every vendor',
        'Framework-agnostic by construction, with no strategy runtime to upgrade',
        'Natural layout flow, one accessibility tree, and portal-compatible interaction',
        'Style scoping in both directions at the shadow root',
      ],
      costs: [
        'Every operational concern is adopter-built: loading and error UI, messaging conventions, inventory, correlation',
        'Framework copies multiply with every co-displayed element',
        'Rich data flows need property and event conventions beyond string attributes',
        'Element names are a page-global namespace, so a naming treaty is mandatory',
      ],
      limitations: [
        'Never a security boundary and never a JavaScript fault boundary',
        'Shadow DOM complicates global theming, some overlay libraries, and form participation',
        'No built-in answer to shared-dependency deduplication at scale',
      ],
      worksWellWhen: [
        'A design system is the delivery vehicle',
        'Widgets are embedded into many varied hosts',
        'Longevity matters more than tooling convenience, with few co-displayed units',
      ],
      worksPoorlyWhen: [
        'The code being composed is untrusted or third-party',
        'Pages compose many units and payload duplication bites',
        'The product needs heavy cross-fragment state and orchestration it does not want to build',
      ],
    },
    {
      id: 'family.module-graph-federation',
      name: 'Module-graph federation',
      plainName:
        'Independently built and deployed JavaScript bundles import each other in the browser and agree at load time on one copy of shared libraries.',
      kind: 'microfrontend',
      definition:
        'The browser JavaScript module graph is the composition boundary. Independently deployed builds expose modules, consumers import them at runtime, and a resolution layer, either a bundler-emitted container runtime or an import map over native modules, wires specifiers to deployed URLs and negotiates shared dependencies so common libraries load once.',
      boundary: 'The JavaScript module import, plus the shared-dependency share scope',
      integrationPhase: 'deploy-decoupled, conditionally runtime-live',
      position: { x: 78, y: 0, depth: 100 },
      clusterId: 'cluster.federation-lifecycle',
      advantages: [
        'Sharing at module grain across independently deployed builds, not just whole applications',
        'One copy of a shared library per page when versions line up',
        'No per-unit document boot, so the composed page behaves as one document',
        'The largest tooling ecosystem of any region-granular family',
      ],
      costs: [
        'Version-skew engineering forever, before and after every build',
        'The resolution machinery is co-versioned across all participating teams',
        'Teardown is best-effort, so leaks accumulate across transitions',
        'A discovery fetch precedes the first unit render',
      ],
      limitations: [
        'No isolation of any kind: one exception or one patched built-in reaches everyone',
        'Page-wide singletons such as router, state, and framework instance constrain composition',
        'A build-toolchain floor exists, so buildless participants cannot join',
        'Genuinely untrusted code is never viable',
      ],
      worksWellWhen: [
        'One organization runs several trusted, high-cadence teams',
        'A shared design system and a real payload budget both exist',
        'The organization can run upgrade trains indefinitely',
      ],
      worksPoorlyWhen: [
        'Teams are uncoordinated, or do not trust each other to move in step',
        'Participants are frozen, buildless, or owned by a third party',
        'Isolation is a compliance requirement rather than a preference',
      ],
    },
    {
      id: 'family.lifecycle-orchestration',
      name: 'Client lifecycle orchestration',
      plainName:
        'A thin shell in the page decides which applications should be active and calls each mount and unmount function as the user moves around.',
      kind: 'microfrontend',
      definition:
        'Participants implement a lifecycle contract of bootstrap, mount, and unmount functions. A client-side orchestrator registers applications, maps them to activity rules such as URL patterns, loads their bundles, and drives transitions. The seam is a set of functions the participant exports, not an import graph and not a DOM tag.',
      boundary: 'The lifecycle function contract plus the registration entry: name, loader, activity rule, props',
      integrationPhase: 'deploy-decoupled, conditionally runtime-live',
      position: { x: 83, y: 6, depth: 100 },
      clusterId: 'cluster.federation-lifecycle',
      advantages: [
        'Explicit host control at the seam: orchestrated transitions and props pushed into participants',
        'Soft navigation with chrome that persists across participant changes',
        'The longest multi-framework track record of the shared-realm families',
        'Framework mixing without simulating realms',
      ],
      costs: [
        'Every participant is modified at its entry point',
        'The orchestrator is a singleton dependency with a page-wide version everyone upgrades together',
        'Teardown discipline is delegated to each application, and failures there leak',
        'Routing authority has to be negotiated between shell and participants',
      ],
      limitations: [
        'No isolation: quarantining a failing application at mount time is not containment',
        'The entry-point edit rules out participants nobody may modify',
        'Double-router conflicts are resolved by convention, never mechanically',
      ],
      worksWellWhen: [
        'Several actively maintained in-house applications are being consolidated under one URL space',
        'Seamless navigation between those applications is required',
        'The organization wants a paved-road shell with orchestrated interaction',
      ],
      worksPoorlyWhen: [
        'Applications are legacy, third-party, or frozen, and their bootstrap cannot change',
        'The organization cannot run a shared-runtime upgrade train',
      ],
    },
    {
      id: 'family.virtualized-rehosting',
      name: 'Virtualized-realm rehosting',
      plainName:
        'A framework loads whole, already deployed applications into one page and fakes a private window, DOM scope, and stylesheet for each so they do not trample each other by accident.',
      kind: 'microfrontend',
      definition:
        'The composer consumes applications exactly as they are already deployed, typically by fetching their HTML entry and mounting the scripts and styles it references, and interposes simulated confinement: proxied window objects and patched globals, scoped or rewritten CSS, and in some members a hidden same-origin iframe realm whose DOM is projected into the visible document.',
      boundary: 'The deployed HTML entry plus the framework sandbox contract',
      integrationPhase: 'deploy-decoupled and runtime-live',
      position: { x: 100, y: 38, depth: 100 },
      advantages: [
        'The lowest-friction path to composing an existing estate in one page: deployed applications join unmodified',
        'Accidental global, DOM, and CSS collisions are absorbed rather than debugged',
        'Keepalive and hot swap of a running participant are built in',
        'Legacy applications with no build step can still participate',
      ],
      costs: [
        'A sandbox execution tax on every patched path',
        'Debugging happens through virtualized globals',
        'Framework copies duplicate per rehosted application',
        'Browser-compatibility maintenance risk is permanent and concentrated in the framework',
      ],
      limitations: [
        'Never a boundary against malice: the confinement is simulated, and escape hatches are documented',
        'Sandbox fidelity gaps are inherent, so participants do not get exact browser semantics',
        'Guarantees change per mode fork, so a decision has to name the configuration, not the product',
      ],
      worksWellWhen: [
        'Multi-team legacy rehosting happens inside one organization',
        'Deployed applications nobody may modify are being consolidated gradually',
        'A portal mixes old and new stacks but expects shared-document interaction',
      ],
      worksPoorlyWhen: [
        'Any participant is adversarial, or trust has to be enforced rather than assumed',
        'Pages are performance-critical and sensitive to the sandbox tax',
        'Participants depend on exact browser semantics',
      ],
    },
    {
      id: 'family.document-embedding',
      name: 'Separate-document embedding',
      plainName: 'Each piece is its own web page, shown inside the host page in a frame; the pieces talk by sending messages.',
      kind: 'microfrontend',
      definition:
        'Participants are complete, independently served documents that sit together in the host viewport through nested browsing contexts. The browser, not a framework, enforces the boundary. Coordination crosses that boundary as serialized messages, ranging from bare conventions to versioned handshakes gated at connect time.',
      boundary: 'The browsing-context boundary: an embed URL plus a message protocol',
      integrationPhase: 'deploy-decoupled and runtime-live',
      position: { x: 97, y: 95, depth: 100 },
      advantages: [
        'The only family where genuinely external or distrusted participants are viable, at a cross-origin sandboxed posture',
        'Failure containment and in-page recovery are guaranteed by the browser rather than by a framework',
        'Zero co-residence coupling: no shared globals, no shared stylesheet, no shared dependency graph',
        'The lifetime of the primitive is the lifetime of the browser',
      ],
      costs: [
        'Each unit boots its own document, with the process memory that implies',
        'Every boundary call is serialized, and each message carries a cost',
        'Overlays clip at the frame edge unless the host publishes an overlay protocol',
        'Focus order, screen-reader continuity, and history need deliberate engineering across the seam',
      ],
      limitations: [
        'Natural layout flow is lost: the host has to measure and manage participant geometry',
        'Body portals and global overlays require explicit protocol work',
        'Seamlessness is an engineering programme, never a default of the primitive',
      ],
      worksWellWhen: [
        'Third-party or vendor widgets, plugin marketplaces, and white-label composition are in scope',
        'An acquisition has to be composed before it can be rewritten',
        'Isolation is driven by compliance, or the dashboard mixes trust levels',
      ],
      worksPoorlyWhen: [
        'Consumer UX must be seamless with dense interaction across the boundary',
        'The design system is overlay-heavy and no protocol investment is planned',
        'Many units are composed on a memory-constrained page',
      ],
    },
    {
      id: 'family.modular-monolith',
      name: 'Modular monolith',
      plainName: 'One application, one deploy, with firm internal walls between team-owned modules.',
      kind: 'baseline',
      definition:
        'A single deployable whose internal module boundaries are explicit and mechanically enforced through module-boundary lint, dependency rules, and fitness functions. Ownership is expressed in the codebase rather than in the runtime.',
      boundary: 'The enforced source module boundary',
      integrationPhase: 'build-fused',
      position: { x: 0, y: 0, depth: 0 },
      clusterId: 'cluster.build-fused-five',
      advantages: [
        'The lowest operational cost in the landscape',
        'Whole-graph type safety, with contract drift structurally impossible',
        'Cross-cutting changes stay atomic across every module',
        'No composition machinery to learn, version, or debug',
      ],
      costs: [
        'Deploy coupling grows with team count and with cadence independence',
        'Boundary discipline needs continuous enforcement or it erodes',
        'Every change rides the same release train',
      ],
      limitations: [
        'No independent deployment, by definition',
        'The moment a team genuinely needs its own release cadence, this family cannot provide it',
      ],
      worksWellWhen: [
        'A single team, or a few coordinated teams, own the product',
        'Atomicity is worth more than autonomy',
        'You are choosing a starting point and have not yet proven an organizational problem',
      ],
      worksPoorlyWhen: ['Many teams need hard cadence independence', 'The organization cannot structurally share one release train'],
    },
    {
      id: 'family.package-composition',
      name: 'Package-boundary composition',
      plainName: 'Teams own packages; one integrated build assembles the packages into a single deployable.',
      kind: 'baseline',
      definition:
        'Team ownership is reified as versioned workspace or registry packages, and a consuming build resolves them into one artifact. Teams own the release of a package, while deployment stays fused into the consumer.',
      boundary: 'The versioned package interface: exports and semver',
      integrationPhase: 'build-fused',
      position: { x: 6, y: 0, depth: 0 },
      clusterId: 'cluster.build-fused-five',
      advantages: [
        'Most of the ownership story with none of the runtime composition cost',
        'A per-team review and release rhythm without runtime machinery',
        'Full type safety and testing across the whole graph',
        'Commodity tooling that every engineer already knows',
      ],
      costs: [
        'The consumer build and deploy remain the bottleneck',
        'A package release means nothing until every consumer upgrades and redeploys',
        'Version-bump fatigue grows with the number of packages and consumers',
      ],
      limitations: [
        'No independent deployment and no runtime autonomy of any kind',
        'For registry-realized variants, a registry outage sits in the build path',
      ],
      worksWellWhen: [
        'Several teams work on one product and accept one release train',
        'Design systems and shared libraries are the thing being delivered',
        'Ownership clarity is wanted before, or instead of, runtime independence',
      ],
      worksPoorlyWhen: ['Independent deployment is a hard requirement', 'Participants must ship without a coordinating consumer build'],
    },
    {
      id: 'family.spa-routing',
      name: 'Route-chunked single application',
      plainName: 'One single-page application whose routes are lazy-loaded chunks.',
      kind: 'baseline',
      definition:
        'A single application with client-side routing and route-level code splitting, where each area loads on demand out of one build. This is the null composition case with good performance ergonomics.',
      boundary: 'The lazy route chunk, an internal build artifact rather than a contract',
      integrationPhase: 'build-fused',
      position: { x: 0, y: 0, depth: 0 },
      clusterId: 'cluster.build-fused-five',
      advantages: [
        'Satisfies most requests for independent pieces with no architecture at all',
        'On-demand loading and code-area ownership come free',
        'Soft navigation and persistent chrome come free',
        'Atomic deploys, with whole-application rollback at the hosting layer',
      ],
      costs: [
        'Every coupling cost of one application: one framework version, one router, one release train',
        'Route chunks are lazy, not bounded, so nothing enforces area ownership at runtime',
        'Every team waits on the same pipeline for every change',
      ],
      limitations: [
        'Nothing deploys independently',
        'The scale limit is organizational rather than technical, so it arrives without a technical warning',
      ],
      worksWellWhen: ['One team owns the product', 'The request for microfrontends was really a request for on-demand loading'],
      worksPoorlyWhen: ['Multiple teams need genuine cadence independence', 'A team must ship without waiting for a shared release'],
    },
    {
      id: 'family.server-templates',
      name: 'Server-rendered template monolith',
      plainName: 'A classic server-rendered application assembling pages from templates and partials.',
      kind: 'baseline',
      definition:
        'One server application renders complete documents from templates, and reusable partials compose each page inside one codebase and one deploy.',
      boundary: 'The template or partial include, internal rather than a published contract',
      integrationPhase: 'build-fused',
      position: { x: 5, y: 0, depth: 10 },
      clusterId: 'cluster.build-fused-five',
      advantages: [
        'Still the majority of the web, with boring and proven operations',
        'Composed first paint and search indexability by default',
        'Low JavaScript budgets by default',
        'Each navigation is a fresh document, so teardown is free',
      ],
      costs: [
        'One release train for the whole application',
        'Rich client interactivity needs progressive enhancement or embedded islands',
        'Page areas share everything: there is no boundary between them',
      ],
      limitations: ['No independent deployment', 'No client-side application continuity across navigations'],
      worksWellWhen: ['The product is a content site or is form-driven', 'The team is small and one codebase is not a constraint'],
      worksPoorlyWhen: ['Multiple teams need cadence independence', 'The product needs application-like interaction across navigations'],
    },
    {
      id: 'family.islands',
      name: 'Islands architecture',
      plainName: 'A mostly static server-rendered page where a few interactive regions each boot their own bit of JavaScript.',
      kind: 'baseline',
      definition:
        'A single build renders a mostly static document, and designated regions hydrate independently on the client, optionally deferred or rendered per island at request time. The independence is in hydration, never in deployment.',
      boundary: 'The island: an independently hydrated region of a single-build page',
      integrationPhase: 'build-fused',
      position: { x: 5, y: 13, depth: 10 },
      clusterId: 'cluster.build-fused-five',
      advantages: [
        'Solves the adjacent problem most teams actually have: independently hydrated components on one fast page',
        'None of the microfrontend costs, because nothing is independently deployed',
        'Islands fail independently at hydration',
        'Static or hybrid hosting on one pipeline',
      ],
      costs: [
        'One release train for every island',
        'The island framework imposes its stack on the whole page',
        'Nothing is independently owned or shipped, whatever the ergonomics suggest',
      ],
      limitations: [
        'Not a microfrontend strategy while every fragment comes from one build',
        'It becomes one only when islands are served by separately owned and deployed services, which is request-path fragment assembly wearing islands ergonomics',
      ],
      worksWellWhen: [
        'The site is content-heavy with sparse interactivity',
        'The request for microfrontends was motivated by page performance',
      ],
      worksPoorlyWhen: ['Multiple teams need genuine independent deployment', 'A region has to ship without rebuilding the page around it'],
    },
  ],
  questions: [
    {
      id: 'question.ownership.composition-parties',
      rank: 1,
      circumstance: 'Who builds and ships each piece: all one team, several teams at your company, or somebody you cannot direct?',
      architect:
        'For each piece being composed: which organization owns its source, its build, its deploy pipeline, and its release schedule: your team, another team in your company, an acquired company, or an outside vendor or customer?',
      why: 'Ownership facts decide which of the big eliminators may ever bind at all, so asking anything else first risks spending questions that cannot matter.',
      dimension: 'ownership.fact-checklist',
      answers: [
        {
          id: 'question.ownership.composition-parties#one-team',
          label: 'One team builds and ships every piece',
          detail: 'No outside party owns any part of the composed product.',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          consequence:
            'Independent deployment, version governance, framework coexistence, and runtime admission all stop being live problems, so the non-microfrontend baselines become first-class candidates.',
        },
        {
          id: 'question.ownership.composition-parties#several-teams',
          label: 'Several teams inside your company, each owning a piece',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Coordination is possible but not free, so the later questions about release cadence and version governance decide the outcome.',
        },
        {
          id: 'question.ownership.composition-parties#outside-party',
          label: 'At least one piece is built and shipped by people you cannot direct',
          detail: 'An outside vendor, a customer, an acquired company, or an unknown future plugin author.',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'An external principal is present, which makes the trust question and the runtime-admission question decision-relevant rather than theoretical.',
        },
        {
          id: 'question.ownership.composition-parties#no-deploy-control',
          label: 'Neither side can control when the other ships',
          answerClass: 'hard',
          eliminates: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: [],
          consequence:
            'Independent deployment is entailed by the ownership fact rather than chosen, so every architecture that ships one artifact is out without a further question.',
        },
      ],
    },
    {
      id: 'question.deploy.independence',
      rank: 2,
      circumstance:
        'When one team finishes a change, can everyone live with it shipping in the next release of the whole product, or must that team be able to put it in front of users on its own schedule, without waiting for anyone?',
      architect:
        'Must a participant deploy reach production without rebuilding or redeploying the host (deployment.host-rebuild-required=n, ownership.deploy-schedule-ownership), or is one coordinated release train acceptable, structurally?',
      why: 'This is the single largest guaranteed split in the landscape: the same answer fixes integration time and prices the contract machinery that comes with it.',
      dimension: 'dimension.integration-time',
      answers: [
        {
          id: 'question.deploy.independence#independent',
          label: 'A team must be able to ship its piece to users on its own schedule',
          detail: 'Stated as a current requirement, not as an ambition.',
          answerClass: 'hard',
          eliminates: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: [],
          consequence:
            'Every build-fused architecture is eliminated, and contract drift between independently deployed sides becomes structurally possible and must be engineered for.',
        },
        {
          id: 'question.deploy.independence#valuable-not-required',
          label: 'Shipping on their own schedule would be valuable, but the product can still ship together',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [
            'family.route-partition',
            'family.server-fragment-assembly',
            'family.custom-element-composition',
            'family.module-graph-federation',
            'family.lifecycle-orchestration',
            'family.virtualized-rehosting',
            'family.document-embedding',
          ],
          consequence:
            'A wish for autonomy ranks the microfrontend families upward but never eliminates the baselines, which stay in play with the tradeoff reported.',
        },
        {
          id: 'question.deploy.independence#train-mandated',
          label: 'Everything must ship together in one coordinated release, by policy',
          detail: 'An audit or atomicity policy makes a single release train mandatory.',
          answerClass: 'hard',
          eliminates: [
            'family.route-partition',
            'family.server-fragment-assembly',
            'family.custom-element-composition',
            'family.module-graph-federation',
            'family.lifecycle-orchestration',
            'family.virtualized-rehosting',
            'family.document-embedding',
          ],
          favors: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          consequence:
            'All seven microfrontend families are out, the family stage ends here, and the recommendation is one of the non-microfrontend baselines.',
        },
      ],
    },
    {
      id: 'question.granularity.single-screen',
      rank: 3,
      circumstance:
        'Picture the finished product: is there a page where the work of two different teams is visible at the same time, or does each page belong to one team and you move between them by navigating?',
      architect:
        'Does any single screen concurrently render output owned by more than one independently deploying team (runtime.concurrent-participants), or do team boundaries align with whole-page navigations?',
      why: 'It is a cheap product fact with double leverage: it either removes the page-partition families or makes the whole co-residence question cluster vacuous.',
      dimension: 'dimension.composition-granularity',
      answers: [
        {
          id: 'question.granularity.single-screen#mixed-screen',
          label: 'At least one screen shows the work of two different teams at the same time',
          answerClass: 'hard',
          eliminates: ['family.route-partition', 'family.server-templates'],
          favors: [],
          consequence:
            'Participants have to co-reside in one page, which opens the whole cluster of questions about shared realm, shared dependencies, and shared failure.',
        },
        {
          id: 'question.granularity.single-screen#probably-later',
          label: 'Not today, but a mixed screen is likely once the product grows',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Co-residence is treated as a ranking signal rather than a requirement, so page-partitioned architectures stay in play with the future cost reported.',
        },
        {
          id: 'question.granularity.single-screen#page-per-team',
          label: 'Each page belongs to one team and you move between them by navigating',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: ['family.route-partition'],
          consequence:
            'Nothing ever co-resides, so failure containment, style containment, framework coexistence, and version governance stop being questions at all.',
        },
      ],
    },
    {
      id: 'question.migration.participant-ceiling',
      rank: 4,
      circumstance:
        'For each piece: could the people who own it change how it is built or how it starts up if integration required it; could your own team only wrap it as it is; or can nothing about it be touched at all?',
      architect:
        'Per participant: the deepest modification its owners can and will accept before integration, on the migration scale: config and serving only (1), adapter around unchanged code (2), build-tool change (3), entry or bootstrap edit (4), bounded internal refactor (5), or practically nothing (9)?',
      why: 'A modification ceiling is the canonical eliminating answer of the model, and it is often entailed for free by who owns the piece.',
      dimension: 'dimension.adaptation-floor',
      answers: [
        {
          id: 'question.migration.participant-ceiling#refactor-into-codebase',
          label: 'Its owners could refactor it into a shared codebase if that is what integration takes',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence: 'No architecture is ruled out by adaptation cost, so the choice is decided entirely by the other constraints.',
        },
        {
          id: 'question.migration.participant-ceiling#bootstrap-edit',
          label: 'Its build tooling and its startup code can change, but it stays a separate application',
          answerClass: 'hard',
          eliminates: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: [],
          consequence:
            'The piece will not be merged into the codebase of another team, so the build-fused baselines cannot absorb it, while every microfrontend family remains reachable.',
        },
        {
          id: 'question.migration.participant-ceiling#build-change-only',
          label: 'Its build tooling can change, but its startup code cannot be edited',
          answerClass: 'hard',
          eliminates: [
            'family.lifecycle-orchestration',
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: [],
          consequence:
            'Anything that requires the participant to export a lifecycle from its entry point is out, because that edit is exactly what cannot happen.',
        },
        {
          id: 'question.migration.participant-ceiling#wrap-as-is',
          label: 'Nothing about it can change; at most your team wraps it as it is',
          detail: 'Configuration, serving headers, or an adapter around unchanged code, and no more.',
          answerClass: 'hard',
          eliminates: [
            'family.module-graph-federation',
            'family.lifecycle-orchestration',
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: [
            'family.route-partition',
            'family.server-fragment-assembly',
            'family.custom-element-composition',
            'family.virtualized-rehosting',
            'family.document-embedding',
          ],
          consequence:
            'Seven of the twelve families are removed for that participant, leaving only the architectures that consume a piece exactly as it is already deployed.',
        },
      ],
    },
    {
      id: 'question.trust.malicious-participant',
      rank: 5,
      circumstance:
        'If the people behind one piece turned out to be careless, hacked, or hostile, must the rest of the product stay safe anyway? Or do you fundamentally trust everyone whose code you are combining and just want their mistakes not to trample each other?',
      architect:
        'If a participant is compromised or malicious, must the composition boundary itself contain it: no host DOM or JS-state reach, partitioned storage, bounded navigation and capability surface (isolation.security.malicious-participant, security.capability-narrowing)? Or is the risk model accidental interference between trusted teams?',
      why: 'It is the sharpest eliminator in the landscape: when it binds hard it removes more of the space than any other single answer.',
      dimension: 'dimension.trust-ceiling',
      answers: [
        {
          id: 'question.trust.malicious-participant#contain-malice',
          label: 'The rest of the product must stay safe even if one piece is compromised or hostile',
          answerClass: 'hard',
          eliminates: [
            'family.server-fragment-assembly',
            'family.custom-element-composition',
            'family.module-graph-federation',
            'family.lifecycle-orchestration',
            'family.virtualized-rehosting',
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: ['family.document-embedding', 'family.route-partition'],
          consequence:
            'Only a browser-enforced boundary at a cross-origin sandboxed posture survives, plus page-granular partitioning; simulated confinement is explicitly not a security boundary.',
        },
        {
          id: 'question.trust.malicious-participant#accidents-only',
          label: 'Everyone is trusted, and you only need their accidents not to trample each other',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: ['family.document-embedding', 'family.virtualized-rehosting'],
          consequence:
            'Interference damping is enough, which ranks the confining architectures upward without making containment a requirement anything must meet.',
        },
        {
          id: 'question.trust.malicious-participant#full-trust',
          label: 'Every piece is written and reviewed by people you fully trust',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Trust stops being a selection factor, so the decision moves entirely to failure containment, dependencies, and user experience.',
        },
      ],
      unlockedBy: [
        { questionId: 'question.ownership.composition-parties', answerId: 'question.ownership.composition-parties#outside-party' },
        { questionId: 'question.roster.runtime-admission', answerId: 'question.roster.runtime-admission#no-host-change' },
      ],
    },
    {
      id: 'question.coordination.upgrade-train',
      rank: 6,
      circumstance:
        'When a shared library needs an upgrade today, does every affected team actually move in step, or does each team upgrade whenever it can and you live with the skew?',
      architect:
        'Can this organization run standing cross-team dependency-version governance: aligned upgrade trains before and after builds, runtime conflicts fixed on a real sprint, indefinitely (coordination.shared-dependency-governance)?',
      why: 'It separates the two coordination-hungry shared-realm families from everything else, and it asks about observed behaviour rather than intent.',
      dimension: 'dimension.dependency-economy',
      answers: [
        {
          id: 'question.coordination.upgrade-train#skew-today',
          label: 'Each team upgrades when it can, and you live with the version skew',
          detail: 'Answered as what happens today, not as what the org intends to fix.',
          answerClass: 'hard',
          eliminates: ['family.module-graph-federation', 'family.lifecycle-orchestration'],
          favors: [],
          consequence:
            'Both architectures that require standing version governance are out, and with them any deduplication of shared libraries across independently deployed teams.',
        },
        {
          id: 'question.coordination.upgrade-train#could-govern',
          label: 'Teams could move in step, but you would rather not depend on it',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Governance is available but treated as a cost, so architectures that demand it are ranked down rather than removed.',
        },
        {
          id: 'question.coordination.upgrade-train#trains-run',
          label: 'Aligned upgrade trains already run across the affected teams',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: ['family.module-graph-federation', 'family.lifecycle-orchestration'],
          consequence:
            'Negotiated shared dependencies become reachable, which is the precondition for shipping one copy of a shared library per page.',
        },
      ],
      unlockedBy: [{ questionId: 'question.granularity.single-screen', answerId: 'question.granularity.single-screen#mixed-screen' }],
    },
    {
      id: 'question.delivery.server-capacity',
      rank: 7,
      circumstance:
        'Is there a team that runs servers for this product and could be on call for one more service, or do you ship files to a CDN and nothing else?',
      architect:
        'Must production delivery run entirely from static hosting or a CDN, with no composition or routing service you operate on the request path (ssr.static-hosting-sufficient, deployment.strategy-service-in-path=n)?',
      why: 'It cleanly splits request-path assembly from static delivery, and organizations answer it reliably because it is a capability fact.',
      dimension: 'dimension.assembly-locus',
      answers: [
        {
          id: 'question.delivery.server-capacity#static-only',
          label: 'You ship files to a CDN and operate nothing on the request path',
          answerClass: 'hard',
          eliminates: ['family.server-fragment-assembly'],
          favors: [],
          consequence:
            'Nothing can assemble the page before the browser sees it, and route partitioning is confined to routing infrastructure that already exists.',
        },
        {
          id: 'question.delivery.server-capacity#no-new-tier',
          label: 'Servers exist, but nobody wants another service to operate',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Architectures that add a tier to the production path are ranked down by their operational cost rather than removed.',
        },
        {
          id: 'question.delivery.server-capacity#operates-servers',
          label: 'A team already runs server estates for this product and could take one more service',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: ['family.server-fragment-assembly'],
          consequence:
            'Request-path assembly is affordable, which is what makes composed first paint reachable without giving up independent deployment.',
        },
      ],
    },
    {
      id: 'question.delivery.first-paint',
      rank: 8,
      circumstance:
        'Do the combined pages need to appear in search engines and render before any script runs, or do users sign in before they see anything anyway?',
      architect:
        'Must first paint deliver composed, crawler-indexable content with no client-side JavaScript execution (ux.composed-first-paint, ssr.crawler-indexable, ssr.no-js-first-paint)?',
      why: 'Its elimination width is large, but it may only bind when a business surface actually depends on crawlability rather than on page speed.',
      dimension: 'dimension.assembly-locus',
      answers: [
        {
          id: 'question.delivery.first-paint#crawlable-required',
          label: 'The combined pages carry public content that must be indexed and must render before any script runs',
          detail: 'Crawlability is a stated business requirement, not a preference.',
          answerClass: 'hard',
          eliminates: [
            'family.module-graph-federation',
            'family.lifecycle-orchestration',
            'family.virtualized-rehosting',
            'family.document-embedding',
            'family.custom-element-composition',
          ],
          favors: [
            'family.server-fragment-assembly',
            'family.route-partition',
            'family.server-templates',
            'family.islands',
            'family.package-composition',
            'family.modular-monolith',
          ],
          consequence:
            'Every architecture that assembles the page in the client is out in its default configuration, because the composed content does not exist until scripts run.',
        },
        {
          id: 'question.delivery.first-paint#performance-taste',
          label: 'The real concern is how fast the page feels, not whether crawlers see it',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: ['family.islands', 'family.spa-routing'],
          consequence:
            'A performance motive does not buy a composition tier, so the honest answer is a faster single-build architecture rather than a distributed one.',
        },
        {
          id: 'question.delivery.first-paint#signed-in',
          label: 'Users sign in before they see anything, so indexing does not apply',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence: 'First paint stops constraining the choice, and client-side assembly stays fully available.',
        },
      ],
    },
    {
      id: 'question.failure.containment',
      rank: 9,
      circumstance:
        'If one piece crashes in production, is it acceptable that the whole page might need a reload, or must everything else keep working while the broken piece recovers on its own?',
      architect:
        'When a mounted participant throws, leaks timers or listeners, or corrupts its own state, must host and siblings continue unaffected, with in-page recovery and full resource reclaim (isolation.failure.post-mount-exception, isolation.lifecycle.reclaim, isolation.recovery.in-page)?',
      why: 'It separates architectures where a failure is contained by construction from those where a single exception reaches every participant on the page.',
      dimension: 'dimension.runtime-realm',
      answers: [
        {
          id: 'question.failure.containment#must-survive',
          label: 'Everything else must keep working while the broken piece recovers on its own',
          detail: 'A stated blast-radius or regulatory requirement, not a preference for resilience.',
          answerClass: 'hard',
          eliminates: ['family.module-graph-federation', 'family.custom-element-composition', 'family.lifecycle-orchestration'],
          favors: ['family.document-embedding', 'family.route-partition', 'family.virtualized-rehosting'],
          consequence:
            'Shared-realm architectures are out because unmounting a failing application is quarantine rather than containment; simulated confinement survives only in specific configurations.',
        },
        {
          id: 'question.failure.containment#resilience-preferred',
          label: 'Resilience is wanted, but a reload is survivable',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Containment ranks candidates rather than removing them, and the memory cost of stronger boundaries is reported as a tradeoff.',
        },
        {
          id: 'question.failure.containment#reload-acceptable',
          label: 'A page reload is an acceptable fix when something breaks',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence: 'Failure containment stops being a selection factor, which keeps the cheapest shared-realm options in play.',
        },
      ],
      unlockedBy: [{ questionId: 'question.granularity.single-screen', answerId: 'question.granularity.single-screen#mixed-screen' }],
    },
    {
      id: 'question.ux.seam-tolerance',
      rank: 10,
      circumstance:
        'Do dropdowns, dialogs, tab order, and screen readers have to work across the whole page as if one team built it, or are visible edges between sections acceptable for this product?',
      architect:
        'Must composed regions behave as one document: natural layout flow, overlays and portals escaping region bounds, continuous focus order, a single accessibility tree (ux.natural-layout-flow, ux.overlay-viewport-escape, ux.cross-boundary-focus-mgmt, ux.screenreader-continuity)?',
      why: 'It is the counterweight: the only high-rank question whose hard answer removes the architecture that survives the trust question.',
      dimension: 'dimension.runtime-realm',
      answers: [
        {
          id: 'question.ux.seam-tolerance#one-document',
          label: 'The composed page must behave as one document, with overlays and focus crossing every section',
          answerClass: 'hard',
          eliminates: ['family.document-embedding'],
          favors: [],
          consequence:
            'A browser-enforced boundary cannot deliver natural layout flow, so seamlessness and containment cannot both be requirements without funded seam engineering.',
        },
        {
          id: 'question.ux.seam-tolerance#a11y-mandated',
          label: 'Assistive-technology continuity across the whole page is a legal or contractual mandate',
          answerClass: 'hard',
          eliminates: [],
          favors: [],
          consequence:
            'The accessibility mandate binds independently of visual taste, and it is settled per implementation by whether a compensating protocol exists, never assumed from the family.',
        },
        {
          id: 'question.ux.seam-tolerance#seams-acceptable',
          label: 'Visible edges between sections are acceptable, or there is budget to engineer them away',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: ['family.document-embedding'],
          consequence: 'The seam cost is accepted knowingly, which keeps the only architecture with a browser-enforced boundary available.',
        },
      ],
      unlockedBy: [
        { questionId: 'question.trust.malicious-participant', answerId: 'question.trust.malicious-participant#contain-malice' },
        { questionId: 'question.failure.containment', answerId: 'question.failure.containment#must-survive' },
      ],
    },
    {
      id: 'question.deps.major-coexistence',
      rank: 11,
      circumstance: 'Are some pieces stuck on an old version of the same framework newer pieces use, with nobody budgeted to upgrade them?',
      architect:
        'Must incompatible majors of one framework coexist on composed pages indefinitely, with no funded alignment work (framework.same-framework-major-coexistence, runtime.side-by-side-versions)?',
      why: 'A mixed stack routes nowhere on its own: it only binds when the estate fact arrives together with the fact that nobody is funded to fix it.',
      dimension: 'dimension.dependency-economy',
      answers: [
        {
          id: 'question.deps.major-coexistence#stuck-and-unfunded',
          label: 'Some pieces are stuck on an older major of the same framework and nobody is funded to upgrade them',
          answerClass: 'hard',
          eliminates: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: ['family.document-embedding', 'family.virtualized-rehosting'],
          consequence:
            'One build cannot resolve two incompatible majors, so the affected pieces cannot be fused, and only separated or confined realms carry them side by side.',
        },
        {
          id: 'question.deps.major-coexistence#alignment-funded',
          label: 'Versions are mixed, but the alignment work is funded and someone owns it',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Coexistence is a transition cost rather than a permanent requirement, so it ranks candidates while the alignment is checked for credibility.',
        },
        {
          id: 'question.deps.major-coexistence#aligned',
          label: 'Everything already runs the same major, or the differences are compatible',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence: 'Framework coexistence stops constraining the choice, which keeps the single-build architectures viable.',
        },
      ],
      unlockedBy: [{ questionId: 'question.granularity.single-screen', answerId: 'question.granularity.single-screen#mixed-screen' }],
    },
    {
      id: 'question.deps.payload-budget',
      rank: 12,
      circumstance:
        'Is there a hard page-weight or low-end-device budget that all the pieces on one screen must fit inside together, or is some duplication tolerable?',
      architect:
        'Must a library shared by several co-displayed participants ship once per page (performance.shared-dependency-dedup), as a stated budget requirement rather than a wish?',
      why: 'Deduplication machinery is only worth its coupling when a real budget pays for it, and duplication is only acceptable given the number of pieces on screen.',
      dimension: 'dimension.dependency-economy',
      answers: [
        {
          id: 'question.deps.payload-budget#hard-budget',
          label: 'A stated page-weight or low-end-device budget applies to all the pieces on one screen together',
          answerClass: 'hard',
          eliminates: ['family.document-embedding', 'family.virtualized-rehosting', 'family.custom-element-composition'],
          favors: [
            'family.module-graph-federation',
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          consequence:
            'Every architecture that gives each piece its own copy of its stack is out, leaving negotiated sharing at load time or resolution at build time.',
        },
        {
          id: 'question.deps.payload-budget#duplication-tolerable',
          label: 'Frugality matters, but some duplication between pieces is tolerable',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Payload becomes a tie-break, and the duplication cost of each candidate is reported instead of eliminating anything.',
        },
      ],
      unlockedBy: [
        { questionId: 'question.coordination.upgrade-train', answerId: 'question.coordination.upgrade-train#trains-run' },
        { questionId: 'question.coordination.upgrade-train', answerId: 'question.coordination.upgrade-train#could-govern' },
      ],
    },
    {
      id: 'question.roster.runtime-admission',
      rank: 13,
      circumstance:
        'When a new application is added to the combined product, is it acceptable to rebuild and redeploy the main application every time, or must new pieces appear without anyone touching the host?',
      architect:
        'Must new participants or new versions be admitted into a running document without host code change, rebuild, or a central owner action (runtime.late-participant-registration, deployment.new-participant-host-change=n, ownership.onboarding-without-central-owner)?',
      why: 'It is the plugin-ecosystem requirement in question form, and it is entailed whenever the participant roster contains pieces that do not exist yet.',
      dimension: 'dimension.roster-authority',
      answers: [
        {
          id: 'question.roster.runtime-admission#no-host-change',
          label: 'New pieces and new versions must appear in the running product without anyone touching the host',
          answerClass: 'hard',
          eliminates: [
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
            'family.islands',
          ],
          favors: ['family.document-embedding', 'family.virtualized-rehosting'],
          consequence:
            'Admission has to happen inside a running document, which rules out every architecture whose roster is fixed when the host is built.',
        },
        {
          id: 'question.roster.runtime-admission#redeploy-acceptable',
          label: 'Rebuilding and redeploying the main application for each new piece is acceptable',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence: 'Admission cost stops constraining the choice, and a batch onboarding process is enough.',
        },
      ],
      unlockedBy: [
        { questionId: 'question.ownership.composition-parties', answerId: 'question.ownership.composition-parties#outside-party' },
      ],
    },
    {
      id: 'question.host.negotiability',
      rank: 14,
      circumstance:
        'When your product runs inside the sites of your customers, can you realistically ask every one of them to change their site for you, and would they do it, or must it work with whatever their pages already do?',
      architect:
        'Can you require embedding hosts to adopt anything, a runtime, a shell, or a build integration, or must the product run inside host pages you cannot modify, neither leaking styles and globals out nor breaking when a hostile host environment leaks in (ownership.participant-unmodifiable-host)?',
      why: 'It is the only question asked from the seat of the embedded product, and its hard answer removes seven of the twelve families, a wider cut than anything but the release-train question.',
      dimension: 'dimension.adaptation-floor',
      answers: [
        {
          id: 'question.host.negotiability#hosts-unmodifiable',
          label: 'Hosts cannot be asked to change anything, so the product must run in their pages as they are',
          detail: 'Answered as the negotiating reality with real customers, not as a design preference.',
          answerClass: 'hard',
          eliminates: [
            'family.route-partition',
            'family.lifecycle-orchestration',
            'family.virtualized-rehosting',
            'family.modular-monolith',
            'family.package-composition',
            'family.spa-routing',
            'family.server-templates',
          ],
          favors: ['family.document-embedding', 'family.custom-element-composition', 'family.server-fragment-assembly'],
          consequence:
            'Composition has to work from a one-tag embed on a page whose owner adopts no runtime, no build tool, and no shell, which removes every family whose host seat is a routing tier, an orchestrator shell, a sandbox runtime, or a build; two further families survive only in a narrowed posture, module-graph federation through an inline import map and islands through a single script tag.',
        },
        {
          id: 'question.host.negotiability#credible-ask',
          label: 'Most hosts would adopt a small install or script tag if you asked, but not all of them will',
          answerClass: 'strong-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Host adaptation becomes a cost priced per customer rather than a constraint, so architectures that ask more of a host are ranked down by how credible the ask is instead of being removed.',
        },
        {
          id: 'question.host.negotiability#hosts-cooperate',
          label: 'Every embedding host is yours, or will do what you ask',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Host negotiability stops being a selection factor, and the decision returns to the constraints that bind on both seats.',
        },
      ],
      unlockedBy: [
        { questionId: 'question.ownership.composition-parties', answerId: 'question.ownership.composition-parties#outside-party' },
      ],
    },
    {
      id: 'question.contracts.sync-calls',
      rank: 15,
      circumstance:
        'Do the pieces need to work on the same objects instantly, like one program, or can they send each other messages and wait for answers?',
      architect:
        'Must participants call the live objects of another participant synchronously in one stack (contracts.sync-calls), or is asynchronous, serialized messaging acceptable at the boundary?',
      why: 'It rarely fires, but when the surviving candidates span serialized and live-object boundaries it is a genuine eliminator.',
      dimension: 'dimension.runtime-realm',
      answers: [
        {
          id: 'question.contracts.sync-calls#sync-required',
          label: 'The pieces must act on the same live objects in one call stack, traced to a real interaction requirement',
          detail: 'Name the interaction that needs it, such as a shared editing surface.',
          answerClass: 'hard',
          eliminates: ['family.document-embedding', 'family.route-partition'],
          favors: [
            'family.module-graph-federation',
            'family.lifecycle-orchestration',
            'family.custom-element-composition',
            'family.virtualized-rehosting',
          ],
          consequence:
            'A serialized boundary cannot carry synchronous calls, and participants that never co-reside cannot make them at all.',
        },
        {
          id: 'question.contracts.sync-calls#messaging-acceptable',
          label: 'Sending messages and waiting for answers is acceptable at the boundary',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence: 'Every boundary style stays available, and the per-message cost is reported as a tradeoff rather than a blocker.',
        },
      ],
      unlockedBy: [{ questionId: 'question.ux.seam-tolerance', answerId: 'question.ux.seam-tolerance#seams-acceptable' }],
    },
    {
      id: 'question.orchestration.appetite',
      rank: 16,
      circumstance:
        'Would you adopt a framework that every team then upgrades together for years, if it hands you loading screens, error handling, messaging, and local development, or do you want browser primitives only and will build those parts yourselves?',
      architect:
        'May the strategy ship a page-wide runtime that every participant co-versions, with a tooling or framework floor (runtime.shared-runtime-library, framework.version-floor-imposed), or must nothing strategy-owned outlive the browser on the page (buildtime.host-integrates-buildless)?',
      why: 'Only its hard limb belongs at this stage: refusing a strategy-owned runtime removes the two families whose mechanism is a runtime on the page, while the appetite for a paved road ranks implementations rather than families.',
      dimension: 'dimension.orchestration-thickness',
      answers: [
        {
          id: 'question.orchestration.appetite#no-strategy-runtime',
          label: 'Nothing the strategy owns may ship on the page or impose a version floor',
          detail: 'The mechanism has to outlive frameworks, so browser primitives only.',
          answerClass: 'hard',
          eliminates: ['family.lifecycle-orchestration', 'family.virtualized-rehosting'],
          favors: [],
          consequence:
            'A mount and unmount contract needs an orchestrator on the page to call it, and a simulated realm is itself a shipped runtime, so both families go by definition rather than by degree; inside every surviving family the same answer then decides which implementations remain.',
        },
        {
          id: 'question.orchestration.appetite#runtime-acceptable',
          label: 'A strategy-owned runtime is acceptable if it ships real machinery with it',
          answerClass: 'weak-preference',
          eliminates: [],
          favors: [],
          consequence:
            'Thickness stops removing anything and becomes the paved-road tradeoff between shipped machinery and a co-versioned runtime, which is settled per implementation rather than per family.',
        },
      ],
    },
  ],
  hyperfrontendFloor: [
    {
      id: 'floor.participant.independent-url',
      side: 'participant',
      summary: 'The feature must be a separately deployed app reachable at its own URL.',
      detail:
        'The composed unit is a live document the browser fetches, not a JavaScript artifact, an HTML fragment, or a build output the host consumes. A feature living inside a monolith has to be extracted first, though static files on any host are sufficient once it is.',
      whatWouldHaveToChange:
        'Extract the feature into its own deployed app behind its own URL. Under a mandated single release train nothing can change: independent deployment and atomic release are mutually exclusive by definition.',
      conflictsWith: ['question.deploy.independence#train-mandated'],
    },
    {
      id: 'floor.participant.operated-origin',
      side: 'participant',
      summary: 'Some team must own that URL in production, on call, for as long as it is embedded.',
      detail:
        'Every feature is its own running origin with its own uptime, certificates, cache headers, and incident surface. The host cannot serve it, keep it alive, or fail over for it, so this is a standing operational obligation rather than one-time adoption work.',
      whatWouldHaveToChange:
        'Nothing removes it. Static hosting makes the obligation cheap, but somebody still answers for that origin every day it is embedded anywhere.',
      conflictsWith: [],
    },
    {
      id: 'floor.participant.framable-by-the-host',
      side: 'participant',
      summary: 'The feature must serve headers that permit the host page to frame it.',
      detail:
        'Embedding authorization lives entirely in the response headers of the feature, through Content-Security-Policy frame-ancestors or the legacy X-Frame-Options, plus whatever server-side authorization it applies to embedded sessions. The SDK neither sets nor checks these, and a feature that forbids all frame ancestors cannot be composed by anyone.',
      whatWouldHaveToChange:
        'The operator of the feature names the host in frame-ancestors, and the two teams agree an auth topology that survives partitioned third-party cookies. No host-side setting overrides a refusal.',
      conflictsWith: [],
    },
    {
      id: 'floor.participant.runs-in-its-own-document',
      side: 'participant',
      summary: 'The feature must be a complete page that boots on its own, not a fragment.',
      detail:
        'The browser loads the feature document natively, so nothing is fetched and re-parsed into the host DOM and no host-side rewriting happens. The feature ships its own HTML shell, CSS, fonts, and framework copy, and anything it used to inherit from a parent application becomes either self-contained or a contract message.',
      whatWouldHaveToChange:
        'Make the inherited context explicit: bundle the shell, styles, and fonts, and turn a host-provided theme, store, or auth object into contract messages. Nothing makes a fragment work in place.',
      conflictsWith: ['question.ux.seam-tolerance#one-document'],
    },
    {
      id: 'floor.participant.hostee-glue-at-bootstrap',
      side: 'participant',
      summary: 'Someone with commit access must edit the feature entry point to start the SDK.',
      detail:
        'The participant adaptation floor is a bootstrap change: the startup file imports and calls the hostee SDK and the app gains a feature config, while internals, routing, and component code stay untouched. The edit is in participant source, so a vendor who will not ship a per-customer entry point is excluded and no host-side effort substitutes.',
      whatWouldHaveToChange:
        'Obtain authority, or a vendor commitment, to add one import plus a config file to the entry point. Where no such authority exists, the plain iframe primitive still composes the app at an embed-only posture, without this SDK.',
      conflictsWith: ['question.migration.participant-ceiling#wrap-as-is', 'question.migration.participant-ceiling#build-change-only'],
    },
    {
      id: 'floor.participant.contract-authored-and-versioned',
      side: 'participant',
      summary: 'Both sides must write down every message, its direction and payload, and version it.',
      detail:
        'One contract artifact of emitted and accepted actions is the sole application-level coupling. It is baked into the generated shell and presented during the handshake, and incompatible majors are refused before the channel opens, though an unversioned peer always passes the gate and only actions that declare a schema get payload validation.',
      whatWouldHaveToChange:
        'Fund the authoring and the upkeep. This is standing work rather than a blocker: the mechanism enforces what is written down, never what was meant.',
      conflictsWith: [],
    },
    {
      id: 'floor.participant.no-shared-realm-or-dom',
      side: 'participant',
      summary: 'The feature must not need host JavaScript objects, the host DOM, or a shared store.',
      detail:
        'There is no shared realm to reach into, by construction. Every cross-boundary interaction is an asynchronous serialized message with structured-clone semantics, so live references, class instances, functions, and DOM nodes do not cross, and code written against parent-window conveniences has to be replaced.',
      whatWouldHaveToChange:
        'Accept serialized async messaging and restructure the call sites that assume a same-tick return. Nothing about the mechanism can change: this absence is what the boundary is.',
      conflictsWith: ['question.contracts.sync-calls#sync-required'],
    },
    {
      id: 'floor.participant.hf-toolchain-for-the-shell',
      side: 'participant',
      summary: 'The feature team needs Node 18 or newer to generate the shell the host installs.',
      detail:
        'This is separate from the bootstrap edit. The build of the feature is never consumed by the host and any bundler, or none, is fine, but the shell package is generated by the CLI, so it has to run somewhere in the pipeline of the feature team. A tooling version floor therefore applies even to an app that has no build of its own.',
      whatWouldHaveToChange:
        'Add one CLI step to the pipeline of the feature. The version floor itself cannot be removed: where nothing strategy-owned may impose one, the answer is the browser primitive with an adopter-written wrapper.',
      conflictsWith: ['question.migration.participant-ceiling#wrap-as-is', 'question.orchestration.appetite#no-strategy-runtime'],
    },
    {
      id: 'floor.participant.sizes-to-host-geometry',
      side: 'participant',
      summary: 'The feature renders into the pixel box the host hands it and never announces a size.',
      detail:
        'Geometry authority is inverted relative to the usual child-announces-height pattern: the host measures its container and sends exact pixels at open and on every change, and the feature lays out to match. The feature also declares which display modes it supports, and an undeclared mode is a compile error rather than a runtime surprise.',
      whatWouldHaveToChange:
        'Express content-driven growth as ordinary product data the host may act on, and use the contract-declared dialog and popup modes for anything that must escape the rectangle. Natural layout flow is not purchasable here.',
      conflictsWith: ['question.ux.seam-tolerance#one-document'],
    },
    {
      id: 'floor.participant.own-observability',
      side: 'participant',
      summary: 'The feature team ships its own error reporting: no stack trace crosses the boundary.',
      detail:
        'What the host receives is typed relationship failure, such as an open or ready timeout, a rejected message, an invalid payload, or a denied handshake, plus a four-state liveness judgement. Debugging a cross-boundary journey needs correlation ids agreed between the two applications, and the watchdog has fixed behaviour the feature cannot tune.',
      whatWouldHaveToChange:
        'Instrument the feature itself and agree correlation ids with the host team. Stack traces will never cross a document boundary, whoever ships the SDK.',
      conflictsWith: [],
    },
    {
      id: 'floor.participant.same-url-deploy-discipline',
      side: 'participant',
      summary: 'The URL is the version, so deploys behind it must stay contract-compatible.',
      detail:
        'There is no pointer layer, no immutable retention, and no consumer pinning, so a host receives whatever is currently deployed behind the URL. Compatible deploys are fully uncoordinated, contract-breaking deploys are refused at the handshake until hosts reinstall, and rollback means redeploying prior content.',
      whatWouldHaveToChange:
        'Build an operator-owned pointer layer in front of the URL: immutable versioned directories plus a pointer you repoint, which works on any static host. Nothing first-party ships it today.',
      conflictsWith: [],
    },
    {
      id: 'floor.participant.tracks-a-pre-1.0-wire',
      side: 'participant',
      summary: 'The feature team must redeploy on the schedule of the protocol while it is pre-1.0.',
      detail:
        'The package line is 0.x throughout and breaking wire changes are explicitly permitted and have happened. Both sides carry the SDK, so a wire break is a coordinated redeploy of every participant and every host, which is exactly the coordination this architecture avoids paying elsewhere.',
      whatWouldHaveToChange:
        'Nothing on the adopter side: only a shipped 1.0 line ends the exposure. Until then, budget for a forced remigration you do not get to schedule.',
      conflictsWith: ['question.coordination.upgrade-train#skew-today'],
    },
    {
      id: 'floor.host.place-an-element',
      side: 'host',
      summary: 'The host must be able to put an element on the page and declare a feature there.',
      detail:
        'The host installs one generated shell package, by package install or a script tag, and declares a mount. It adopts no framework, hands over no document shell, and stands up no infrastructure tier, but onboarding each new feature is a host change, so there is no ownerless admission path.',
      whatWouldHaveToChange:
        'Accept a one-time host change per feature, or batch admissions into scheduled host releases. An adopter-built admission layer is possible but is a real project, and no first-party registry ships today.',
      conflictsWith: ['question.roster.runtime-admission#no-host-change'],
    },
    {
      id: 'floor.host.execute-the-shell-runtime',
      side: 'host',
      summary: 'The host page must be allowed to load and run the JavaScript of the shell.',
      detail:
        'Composition is done by client-side JavaScript in the host document, so a strategy-owned runtime ships on the page. A host whose policy forbids adding a script, with no nonce, no hash, and no permitted origin for the bundle, cannot integrate at all.',
      whatWouldHaveToChange:
        'Nothing available: the SDK is the product. A host that cannot run it should use the browser primitive directly and write the wrapper itself.',
      conflictsWith: ['question.orchestration.appetite#no-strategy-runtime'],
    },
    {
      id: 'floor.host.permit-framing-and-decree-capability',
      side: 'host',
      summary: 'Host policy must permit framing the feature origin, and the host decrees the sandbox.',
      detail:
        'Outbound, the host frame-src policy and any embedder isolation policy must allow the feature origin. Inbound, the sandbox attribute is host-decreed rather than baked into the shell, and the declared permission needs of the feature are applied, replaced, or narrowed by the host, so the host decides how strong the boundary actually is.',
      whatWouldHaveToChange:
        'Add the feature origin to frame-src and decide the sandbox and permission attributes. Both halves are host-side configuration and both fail closed.',
      conflictsWith: [],
    },
    {
      id: 'floor.host.tolerate-a-second-document',
      side: 'host',
      summary: 'The host must afford a full extra document, and its memory, per feature on the page.',
      detail:
        'Each feature costs a document boot and, at a cross-origin posture on site-isolating engines, per-process memory, and nothing is deduplicated across features. Reveal is gated on a sequential chain and no first-party preload levers ship; the magnitude of this cost is acknowledged but unmeasured in the sources.',
      whatWouldHaveToChange:
        'Re-scope the budget from one copy per page to a byte ceiling per feature, compose fewer features at once, or ship framework-free features. Literal deduplication is not reachable in this family.',
      conflictsWith: ['question.deps.payload-budget#hard-budget'],
    },
    {
      id: 'floor.host.own-geometry',
      side: 'host',
      summary: 'The host must decide how big each feature is, and keep deciding as the page changes.',
      detail:
        'The host measures its own container and reports exact pixels at open and on every change; it never receives a height request it is expected to apply, and it picks the display mode per open from the modes the contract declares. Responsive behaviour for the region is host work.',
      whatWouldHaveToChange:
        'Model content-driven growth as product data the host acts on, and use the contract-declared dialog and popup modes when content must escape the rectangle.',
      conflictsWith: ['question.ux.seam-tolerance#one-document'],
    },
    {
      id: 'floor.host.accept-async-messaging',
      side: 'host',
      summary: 'The host must talk to a feature by sending messages and waiting, never by calling it.',
      detail:
        'Requests are correlated envelopes with deadlines, and pending requests reject when a session ends, including across a peer reload. Every message pays structured-clone and, where a schema is declared, validation cost, so host code that assumes a return value in the same tick has to be restructured.',
      whatWouldHaveToChange:
        'Restructure the host call sites that expect a same-tick return. No thicker SDK can make a cross-document call synchronous.',
      conflictsWith: ['question.contracts.sync-calls#sync-required'],
    },
    {
      id: 'floor.host.author-its-own-failure-and-loading-ui',
      side: 'host',
      summary: 'The host must write what the user sees when a feature is slow, dead, or refused.',
      detail:
        'The SDK surfaces machine-readable outcomes and hides frames until a session opens, so there is no half-loaded flash, but it ships no spinner, no skeleton, and no visible error state. The policy for an unresponsive feature, whether to degrade, offer a reload, or force one, is host-authored too.',
      whatWouldHaveToChange:
        'Budget the loading, error, and unresponsive-policy UI as host work. The documented acceptance test is that killing one feature at the network level leaves the page working.',
      conflictsWith: [],
    },
    {
      id: 'floor.host.own-the-cross-boundary-agreements',
      side: 'host',
      summary: 'Host and feature must agree, app to app, on everything the boundary does not carry.',
      detail:
        'Theming and design tokens, auth topology, deep links into a feature, browser history, focus order across the seam, and screen-reader continuity all sit outside the mechanism. Some are out of jurisdiction on principle, some are acknowledged unsolved, screen-reader continuity is unassessed, and framed navigation entering top-level history is an active liability.',
      whatWouldHaveToChange:
        'Fund the seam as an engineering programme between the two teams. Assistive-technology continuity across browsing contexts is unmeasured here, and if a measurement comes back negative against a legal mandate, nothing in this family fixes it.',
      conflictsWith: ['question.ux.seam-tolerance#one-document', 'question.ux.seam-tolerance#a11y-mandated'],
    },
    {
      id: 'floor.host.reinstall-on-contract-break',
      side: 'host',
      summary: 'The host must be able to install a new shell when a contract changes incompatibly.',
      detail:
        'While the contract holds, feature deploys reach users with no host action at all, which is the central benefit of the model. When a contract major changes, the handshake refuses the session until the host installs the regenerated shell, so a host that can never be touched again is viable only for the lifetime of the current major.',
      whatWouldHaveToChange:
        'Keep one path open to install a shell update, however slow that path is. Nothing on either side removes the need when a contract breaks.',
      conflictsWith: ['question.roster.runtime-admission#no-host-change'],
    },
    {
      id: 'floor.blocker.composed-ssr',
      side: 'blocker',
      summary: 'The composed page cannot be server-rendered as one document.',
      detail:
        'Composition happens in the browser after the host document has been delivered, and there is no server or edge tier in this model to assemble anything. A feature may server-render its own document, but that content is never part of the host HTML, so it is not crawlable as host content and cannot paint before scripts run.',
      whatWouldHaveToChange:
        'Either accept client composition with designed loading states, or move the indexable no-script content into the server-rendered document of the host and let the feature own only the interactive region behind it. If the composed content itself must be crawlable, nothing can change.',
      conflictsWith: ['question.delivery.first-paint#crawlable-required'],
    },
    {
      id: 'floor.blocker.seamless-dom-interleaving',
      side: 'blocker',
      summary: 'Content on the two sides cannot interleave as one DOM.',
      detail:
        'A feature occupies a rectangle the host sizes: it does not join the host layout flow, cannot portal into the host body, and shares neither focus order nor accessibility tree. Overlays are the one engineerable part, through contract-declared dialog and popup modes with a host-policy dismiss signal.',
      whatWouldHaveToChange:
        'Overlays and modals are genuinely reachable and worth funding. One layout flow, one focus ring, and one accessibility tree across the seam are not reachable at any budget, because the boundary that provides the isolation is exactly what they would have to cross.',
      conflictsWith: ['question.ux.seam-tolerance#one-document', 'question.ux.seam-tolerance#a11y-mandated'],
    },
    {
      id: 'floor.blocker.malicious-co-resident-script',
      side: 'blocker',
      summary: 'A malicious script already running inside the host page cannot be defended against.',
      detail:
        'The channel is pinned to a window at an origin, which is the right protection against a wrong-frame or wrong-origin speaker but cannot tell the host application from analytics, a tag manager, or a compromised transitive dependency in the same page. The crypto envelope is defence in depth over that gap rather than a fix: handshake frames stay plaintext, and a counterpart that omits the protocol downgrades the channel with no runtime signal.',
      whatWouldHaveToChange:
        'Nothing inside this mechanism. Defences against in-page adversaries are content-security policy, Trusted Types, subresource integrity, or moving the authority to a separate origin. A malicious participant is the different, answerable question: cross-origin serving plus a host-decreed sandbox does contain that one.',
      conflictsWith: ['question.trust.malicious-participant#contain-malice'],
    },
    {
      id: 'floor.blocker.sync-cross-boundary-calls',
      side: 'blocker',
      summary: 'Neither side can synchronously call the live objects of the other.',
      detail:
        'Separate documents, often in separate processes, share no call stack, and the only cross-context primitive is an asynchronous serialized message. Request and response is modelled as correlated envelopes with deadlines, and no function, class instance, or DOM node crosses.',
      whatWouldHaveToChange:
        'Nothing: this is not a missing feature a thicker SDK could add. No researched unit anywhere scores both viable-for-untrusted-code and synchronous calls, so the pair is a standing exclusion.',
      conflictsWith: ['question.contracts.sync-calls#sync-required'],
    },
    {
      id: 'floor.blocker.shared-library-dedup',
      side: 'blocker',
      summary: 'A library used by several features cannot be shipped once for the page.',
      detail:
        'Deduplication requires a shared realm, and the absence of a shared realm is the whole mechanism, so each frame downloads, parses, and holds its own copy of everything. The mitigations are indirect only: fewer co-displayed features, smaller or framework-free features, and per-origin HTTP caching.',
      whatWouldHaveToChange:
        'Nothing, where literal deduplication is required. The research records it as inherent under current browser primitives rather than as a roadmap item.',
      conflictsWith: ['question.deps.payload-budget#hard-budget'],
    },
    {
      id: 'floor.blocker.unmodifiable-participant',
      side: 'blocker',
      summary: 'An app whose entry point nobody will edit cannot participate.',
      detail:
        'Full participation needs the hostee SDK in the participant bootstrap plus a generated shell. There is no embed-only posture that accepts an unmodified deployed URL, no host-side adapter that fakes the participant side, and no proxy mode, however much the host side is willing to do.',
      whatWouldHaveToChange:
        'Only whoever owns that source can change it, and the ask is one import plus a config file, so this blocker can dissolve overnight in a way the others cannot. Until it does, the plain iframe practice, or an HTML-entry rehosting framework where trust permits, is the honest alternative.',
      conflictsWith: ['question.migration.participant-ceiling#wrap-as-is', 'question.migration.participant-ceiling#build-change-only'],
    },
  ],
  implementations: [
    {
      id: 'impl.nextjs-multi-zones',
      name: 'Next.js Multi-Zones and Vercel Microfrontends',
      families: ['family.route-partition'],
      availability: 'available',
      differsBy:
        'Differs primarily in stack mandate, a vendor-operated routing control plane instead of self-managed proxy configuration, and being the only priced member of the family.',
      url: 'https://vercel.com/docs/microfrontends',
      note: 'Routing mechanics are permissively licensed, but skew fallbacks, in-network routing, and preview routing are platform features.',
    },
    {
      id: 'impl.cloudflare-workers-microfrontends',
      name: 'Cloudflare Workers microfrontends',
      families: ['family.route-partition'],
      availability: 'available-immature',
      differsBy:
        'Differs primarily in assembly substrate, a programmable edge worker rather than proxy configuration, and in being the youngest member of the family.',
      url: 'https://developers.cloudflare.com/changelog/2026-01-01-microfrontends/',
      note: 'Shipped in 2026 with no semver line of its own and no external production case studies yet.',
    },
    {
      id: 'impl.podium',
      name: 'Podium',
      families: ['family.server-fragment-assembly'],
      availability: 'available',
      differsBy:
        'Differs primarily in being the cleanest origin-layout-service realization, with no registry tier and conventional mutable-URL releases.',
      url: 'https://podium-lib.io',
      note: 'Single-sponsor project: the core cadence is steady, but the bus factor and adoption outside the sponsor are unverified.',
    },
    {
      id: 'impl.opencomponents',
      name: 'OpenComponents',
      families: ['family.server-fragment-assembly'],
      availability: 'available',
      differsBy:
        'Differs primarily in registry mediation with immutable component versions and pointer-switch releases, plus an optional client-side rendering profile.',
      url: 'https://opencomponents.github.io/',
      note: 'Still pre-1.0 after roughly twelve years and effectively single-maintainer, so semver commitments are weak by convention.',
    },
    {
      id: 'impl.web-fragments',
      name: 'Web Fragments',
      families: ['family.server-fragment-assembly', 'family.virtualized-rehosting'],
      availability: 'available-immature',
      differsBy:
        'Differs primarily in spanning two loci: request-path piercing and client-side reframing, where participants run inside simulated confinement.',
      url: 'https://web-fragments.dev',
      note: 'Explicitly in beta, and the release cadence has stalled: the most novel entrant with the weakest continuity evidence.',
    },
    {
      id: 'impl.entando',
      name: 'Entando',
      families: ['family.custom-element-composition'],
      availability: 'available',
      differsBy:
        'Differs primarily in who composes pages, a non-developer builder rather than host markup, a curated registry roster, and a Kubernetes operational floor.',
      url: 'https://developer.entando.com',
      note: 'Security and maintenance releases are current, but feature development has been frozen since 2024 and the vendor is small.',
    },
    {
      id: 'impl.module-federation',
      name: 'Module Federation',
      families: ['family.module-graph-federation'],
      availability: 'available',
      differsBy:
        'Differs primarily in shipping an emitted container runtime with share-scope negotiation, a bundler-integration floor, and the broadest ecosystem in the family.',
      url: 'https://module-federation.io',
      note: 'The core line is healthy; per-bundler adapters vary, and the Next.js adapter is end-of-life bound.',
    },
    {
      id: 'impl.native-federation',
      name: 'Native Federation',
      families: ['family.module-graph-federation'],
      availability: 'available',
      differsBy:
        'Differs primarily in substrate: browser-native modules and import maps rather than a vendored container runtime, aligned to an esbuild-era toolchain.',
      url: 'https://native-federation.com/',
      note: 'The main line ships, but the current major rework and the bridge for older framework versions are still pre-stable.',
    },
    {
      id: 'impl.single-spa',
      name: 'single-spa',
      families: ['family.lifecycle-orchestration'],
      availability: 'available',
      differsBy:
        'Differs primarily in thickness: a loader plus the lifecycle contract, with no feed or registry tier and everything else adopter-built.',
      url: 'https://single-spa.js.org',
      note: 'A very large installed base on a stalling project: no release in twelve months, no organizational steward, and an open abandonment thread.',
    },
    {
      id: 'impl.piral',
      name: 'Piral',
      families: ['family.lifecycle-orchestration'],
      availability: 'available',
      differsBy:
        'Differs primarily in platform thickness: a feed service and registry-mediated roster instead of central configuration, plus a commercial edition seam.',
      url: 'https://docs.piral.io',
      note: 'The shipping line is active and monthly; the announced next major rests on a dormant base library and is not obtainable.',
    },
    {
      id: 'impl.qiankun',
      name: 'qiankun',
      families: ['family.virtualized-rehosting'],
      availability: 'available',
      differsBy:
        'Differs primarily in lifecycle lineage, being the only family member that requires the participant bootstrap edit, and in having the largest adoption in the family.',
      url: 'https://qiankun.umijs.org',
      note: 'An adopter must choose between a dormant stable line and a successor that has been a release candidate for years.',
    },
    {
      id: 'impl.micro-app-jd',
      name: 'micro-app',
      families: ['family.virtualized-rehosting'],
      availability: 'available-immature',
      differsBy:
        'Differs primarily in the tag-shaped mount, a custom element rather than an orchestrator call, and in accepting participants exactly as deployed.',
      url: 'https://jd-opensource.github.io/micro-app/',
      note: 'The only current line is itself a perpetual release candidate, and the API surface still shifts between candidates.',
    },
    {
      id: 'impl.wujie',
      name: 'wujie',
      families: ['family.virtualized-rehosting'],
      availability: 'available',
      differsBy:
        'Differs primarily in sandbox mechanism: a real hidden iframe realm for JavaScript with projected DOM, the strongest simulated confinement in the family.',
      url: 'https://wujie-micro.github.io/doc/',
      note: 'Cadence is bursty and effectively single-maintainer, though the current major answered an earlier abandonment concern.',
    },
    {
      id: 'impl.luigi',
      name: 'Luigi',
      families: ['family.document-embedding', 'family.custom-element-composition'],
      availability: 'available',
      differsBy:
        'Differs primarily in enterprise-shell platform thickness with a configured rather than gated contract, and in a second mode that trades away the browser boundary.',
      url: 'https://docs.luigi-project.io',
      note: 'Stable and corporately stewarded, but no production adopters outside the sponsor are documented.',
    },
    {
      id: 'impl.hyperfrontend.community',
      name: 'HyperFrontend Community',
      families: ['family.document-embedding'],
      availability: 'available-immature',
      edition: 'community',
      differsBy:
        'Differs primarily in contract explicitness, a gated handshake with descriptor, version stamp, and explicit drift errors, plus lifecycle depth over the raw primitive.',
      url: 'https://www.hyperfrontend.dev',
      note: 'Installable and permissively licensed, but pre-1.0 throughout, single-maintainer, and breaking wire changes are explicitly allowed.',
    },
    {
      id: 'impl.hyperfrontend.enterprise',
      name: 'HyperFrontend Enterprise',
      families: ['family.document-embedding'],
      availability: 'announced-planned',
      edition: 'enterprise',
      differsBy:
        'Differs primarily in announced managed hosting, managed identity, a deployable-feature registry, and contract governance layered on the same boundary.',
      url: 'https://www.hyperfrontend.dev',
      note: 'Nothing here is purchasable or hosted today, so no capability of this edition may be counted as satisfying a requirement.',
    },
    {
      id: 'impl.bit',
      name: 'Bit',
      families: ['family.package-composition'],
      availability: 'available',
      differsBy:
        'Differs primarily in component-grain registry realization, with a hosted cloud as the practical governance tier rather than plain workspace practice.',
      url: 'https://bit.dev/docs',
      note: 'Self-hosting the open edition is bare-bones: permissions, registry UI, and continuous integration live in the commercial tier.',
    },
    {
      id: 'impl.commercetools-frontend',
      name: 'commercetools Frontend',
      families: ['family.package-composition'],
      availability: 'available',
      edition: 'commercial',
      differsBy:
        'Differs primarily in who operates the build and delivery, namely the vendor, plus a business-user page-building surface and a mandated stack.',
      url: 'https://docs.commercetools.com/frontend-development',
      note: 'Commercial software as a service only, with no open edition; the risk axis is lock-in rather than continuity.',
    },
    {
      id: 'impl.zephyr-cloud',
      name: 'Zephyr Cloud',
      families: ['family.module-graph-federation'],
      availability: 'available',
      differsBy:
        'Differs from the family members primarily in not being one: it changes how versions are released and resolved, never the composition boundary underneath.',
      url: 'https://docs.zephyr-cloud.io',
      note: 'The open plugins authenticate to the hosted service, so adopting it puts a vendor control plane in the release path.',
    },
    {
      id: 'impl.picard-js',
      name: 'Picard.js',
      families: ['family.module-graph-federation', 'family.lifecycle-orchestration'],
      availability: 'inactive',
      differsBy:
        'Differs from family members primarily in owning no boundary: it loads and mounts artifacts in other formats under one lifecycle during a format transition.',
      url: 'https://picard.js.org',
      note: 'Artifacts remain installable, but there has been no release since 2024 and the stated production-readiness target never shipped.',
    },
  ],
}
