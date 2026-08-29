/**
 * The answer-to-element table behind the independence-seam diagram, and the pure
 * derivation that turns an evaluated assessment into the model it draws.
 *
 * The governing rule is that an element may be drawn only if a named answer id
 * produces it. Every mark therefore appears here as a row of
 * {@link DELIVERY_TOPOLOGY_TABLE}, and an answer absent from the table draws
 * nothing, which is what keeps a delivery diagram from drifting into
 * registries, environments and pipeline stages the assessment never asked about.
 *
 * @module delivery-topology
 */

import type { Answer, Family, Question } from '../data/decision-framework'
import type { EngineResult } from './decision-engine'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { decisionFramework } from '../data/decision-framework'
import { HYPERFRONTEND_FAMILY_ID } from './decision-engine'

/** How a party lane is filled. One treatment per epistemic state, never shared. */
export type PartyTreatment = 'your-team' | 'another-team' | 'cannot-direct' | 'not-established'
/** Delivery-rail treatment, encoding how strongly the answer behind a band binds. */
export type RailStyle = 'hard' | 'strong-preference' | 'weak-preference' | 'unanswered'
/** Which directions of the ownership arrow carry a slash. */
export type ControlGlyph = 'none' | 'one-way' | 'both-ways'
/** The four states of the seam, the one mark that carries the verdict. */
export type SeamState = 'welded' | 'gapped-hard' | 'gapped-by-preference' | 'undecided'
/** The only two vocabularies the boundary may use. Adversarial wording is earned, never assumed. */
export type BoundaryLanguage = 'accidents' | 'attackers'
/** How a new piece reaches the running page. */
export type AdmissionState = 'runtime-admission' | 'redeploy-per-piece'
/** What the user sees: one screen carrying two owners, or one owner per page. */
export type PageShape = 'mixed-screen' | 'mixed-screen-later' | 'page-per-team' | 'undetermined'
/** What divides one owner's region from another. */
export type DividerGlyph = 'seam-line' | 'wall' | 'double-wall'
/** Which seat the reader occupies in the composition. */
export type SeatState = 'reader-hosts' | 'reader-participates' | 'varies-per-host'
/** The assembly-locus poles, which the dataset separates into three rather than two. */
export type CompositionPole = 'build' | 'request-path' | 'browser'
/** How two regions talk once they share a screen. */
export type RegionLinkKind = 'same-call-stack' | 'messages'

/** One party in band 1: who builds and ships a piece. */
export interface PartyLane {
  /** Stable lane id, used as the render key. */
  id: string
  /** The lane label in words, so no meaning rests on fill or hue. */
  label: string
  /** How the lane is filled, which is a second channel over the label rather than a substitute for it. */
  treatment: PartyTreatment
}

/** The mark that divides regions in band 4, with the wording that earns it. */
export interface DividerMark {
  /** Which of the three glyphs is drawn. */
  glyph: DividerGlyph
  /** What the reader stated, phrased as a requirement rather than as a delivered barrier. */
  label: string
}
/** How the parts talk across the boundary once they share a screen. */
export interface RegionLink {
  /** Whether one call stack is required or messages are acceptable. */
  kind: RegionLinkKind
  /** The reader's own constraint, in one phrase. */
  text: string
}
/** Which seat the reader occupies, and the answer that established it. */
export interface Seat {
  /** Whether the reader hosts, participates, or cannot say. */
  state: SeatState
  /** The circumstance the reader reported, in one phrase. */
  note: string
}
/** How a new piece is admitted into the running product. */
export interface Admission {
  /** Whether admission happens at runtime or through a redeploy. */
  state: AdmissionState
  /** The requirement in one phrase. */
  text: string
}

/**
 * One row of the answer-to-element table: the only licence any mark has to exist.
 *
 * Every field is optional because one answer produces one or two elements and
 * nothing else. An answer that produces no element has no row, which is the
 * table working rather than a gap in it.
 */
export interface TopologyRule {
  /** The answer id that licenses these elements. */
  answerId: string
  /** Party lanes established in band 1. */
  lanes?: readonly PartyLane[]
  /** Whether band 1 draws the ghost strip standing for parties the assessment never counts. */
  ghostStrip?: boolean
  /** The control glyph in band 1. */
  controlGlyph?: ControlGlyph
  /** What the control glyph asserts, in words. */
  controlNote?: string
  /** What every party hands over, in band 2. */
  handover?: string
  /** Whether the handover carries the locked glyph, for a piece nothing may change. */
  handoverLocked?: boolean
  /** The seam state in band 3. */
  seam?: SeamState
  /** Whether the seam follows from an ownership fact rather than from a choice. */
  seamEntailed?: boolean
  /** Who runs the composition point, in band 3. */
  operator?: string
  /** The vocabulary the boundary may use. */
  boundaryLanguage?: BoundaryLanguage
  /** A requirement the reader stated, rendered as a chip that never promises delivery. */
  requirement?: string
  /** How new pieces join the running page, in band 3. */
  admission?: Admission
  /** The page shape in band 4. */
  pageShape?: PageShape
  /** The divider between regions in band 4. */
  divider?: DividerMark
  /** How the regions talk across the divider. */
  regionLink?: RegionLink
  /** A framework-copy annotation, which only a mixed screen ever raises. */
  dependencyNote?: string
  /** Which seat the reader occupies. */
  seat?: Seat
}

/** Short authored copy for an element no answer has filled in yet. */
export interface PlaceholderCopy {
  /** The phrasing shown inside the dotted element, kept short enough to render as a mark. */
  prompt: string
  /** What is not established, phrased to complete "Not established: ...". */
  subject: string
}

/** An unanswered element, rendered as a real control that leads to the question filling it. */
export interface TopologyPlaceholder {
  /** The authored prompt shown in the dotted element. */
  prompt: string
  /** Accessible name naming the subject and the question that would establish it. */
  accessibleName: string
  /** The question the reader is sent to. */
  questionId: string
  /** Its rank in the ranked index, which is the number the reader is told to answer. */
  questionNumber: number
  /** True when the question is gated shut, so answering it is not currently possible. */
  locked: boolean
  /** Why it is gated shut, present only when locked. */
  lockedReason?: string
}

/** Where a band's content came from, or the question that would establish it. */
export interface BandProvenance {
  /** The question behind the band. */
  questionId: string
  /** Its rank, shown as the question number. */
  questionNumber: number
  /** The answer the band was drawn from, absent while the question is unanswered. */
  answerLabel?: string
  /** Whether the question is currently being asked at all. */
  reachable: boolean
}

/** The seam itself: state, caption, and the contract chip that sits in the gap. */
export interface SeamMark {
  /** Which of the four states is drawn. */
  state: SeamState
  /** The caption printed under the mark. */
  caption: string
  /** True when the state follows from an ownership fact rather than from a preference. */
  entailed: boolean
  /** The unanswered control, present only in the undecided state. */
  placeholder?: TopologyPlaceholder
}

/** One family, or one group of families the evidence does not separate, at a composition position. */
export interface PositionChip {
  /** Stable chip id: a family id, or a cluster id where the evidence keeps a group together. */
  id: string
  /** The chip label: a family name, or the cluster's shared name. */
  label: string
  /** How many families the chip stands for. */
  members: number
  /** True when every family behind the chip has been ruled out. */
  struck: boolean
  /** True when the chip holds the family hyperfrontend implements. */
  hyperfrontend: boolean
  /** The finding that these stages do not separate the group, present on cluster chips only. */
  note?: string
}

/** One row of band 3: a place the parts can be put together. */
export interface CompositionPosition {
  /** Stable row id. */
  id: string
  /** Which of the three poles the row belongs to. */
  pole: CompositionPole
  /** The pole label, read from the dataset axes so it round-trips to the research. */
  poleLabel: string
  /** What happens in this row, present only where a pole carries more than one row. */
  detail?: string
  /** True when no surviving family composes here. */
  struck: boolean
  /** One named cause per answer that closed a family in this row. */
  reasons: string[]
  /** The families that compose here, clustered where the evidence does not separate them. */
  chips: PositionChip[]
}

/** Families gathered at one composition row, before the reader's answers are applied to them. */
interface PositionGroup {
  /** Stable row id. */
  id: string
  /** Which of the three poles the row belongs to. */
  pole: CompositionPole
  /** The pole label, read from the dataset axes. */
  poleLabel: string
  /** What crosses here, present only where a pole carries more than one row. */
  detail?: string
  /** The families composing at this row. */
  members: Family[]
}

/** The one contract every surviving approach crosses, or the count of contracts still allowed. */
export interface ContractLine {
  /** The shared boundary, present only when the survivors agree on one. */
  shared?: string
  /** How many distinct boundaries the survivors still span. */
  distinct: number
  /** The line as rendered. */
  text: string
}

/** Band 1: who builds and ships each piece. */
export interface OwnershipBand {
  /** The parties, always including the reader, who is a party by construction. */
  lanes: PartyLane[]
  /** Whether the strip standing for uncounted parties is drawn. */
  ghostStrip: boolean
  /** The control glyph. */
  controlGlyph: ControlGlyph
  /** What the control glyph asserts. */
  controlNote?: string
  /** How strongly the answer behind this band binds. */
  rail: RailStyle
  /** The questions behind the band. */
  provenance: BandProvenance[]
  /** The unanswered control, present until the ownership question is answered. */
  placeholder?: TopologyPlaceholder
}

/** Band 2: what each party hands over. */
export interface HandoverBand {
  /** What every party hands over, absent until the ceiling question is answered. */
  artifact?: string
  /** True when nothing about the handed-over piece may change. */
  locked: boolean
  /** How strongly the answer behind this band binds. */
  rail: RailStyle
  /** The questions behind the band. */
  provenance: BandProvenance[]
  /** The unanswered control, present until the ceiling question is answered. */
  placeholder?: TopologyPlaceholder
}

/** Band 3: where the parts are joined. */
export interface JoinBand {
  /** The seam, the one mark that carries the verdict. */
  seam: SeamMark
  /** The three assembly-locus positions, with the request path carrying its two sub-rows. */
  positions: CompositionPosition[]
  /** What the drawn positions do and do not claim. */
  positionsCaption: string
  /** Who runs the composition point, absent until that question is answered. */
  operator?: string
  /** The unanswered control for the operator line. */
  operatorPlaceholder?: TopologyPlaceholder
  /** The contract the surviving approaches cross. */
  contract: ContractLine
  /** The vocabulary the boundary may use. */
  boundaryLanguage: BoundaryLanguage
  /** Requirements the reader stated, never depicted as delivered barriers. */
  requirements: string[]
  /** How new pieces join the running page, absent unless an outside party unlocked the question. */
  admission?: Admission
  /** How strongly the answer behind the seam binds. */
  rail: RailStyle
  /** The questions behind the band. */
  provenance: BandProvenance[]
}

/** The framework-copy annotation, which only a mixed screen ever raises. */
export interface DependencyAnnotation {
  /** True while no mixed screen has been reported, so the questions are not asked. */
  locked: boolean
  /** What the reader reported about framework copies on one screen. */
  notes: string[]
  /** The unanswered control, present once the questions are open and still unanswered. */
  placeholder?: TopologyPlaceholder
}

/** Band 4: what the user sees. */
export interface SurfaceBand {
  /** Whether one screen mixes owners, and how the answers say so. */
  shape: PageShape
  /** The shape in one sentence. */
  shapeText: string
  /** The divider between regions, absent until an answer produces one. */
  divider?: DividerMark
  /** How the regions talk across it. */
  regionLink?: RegionLink
  /** The framework-copy annotation. */
  dependency: DependencyAnnotation
  /** Which seat the reader occupies. */
  seat: Seat
  /** How strongly the answer behind this band binds. */
  rail: RailStyle
  /** The questions behind the band. */
  provenance: BandProvenance[]
  /** The unanswered control, present until the single-screen question is answered. */
  placeholder?: TopologyPlaceholder
}

/** The reader's delivery topology, derived once and rendered without further reasoning. */
export interface DeliveryTopology {
  /** The whole topology in a short paragraph, stated from the same values that drive the marks. */
  thesis: string
  /** How many of the reader's answers produced a mark. */
  drawnFrom: number
  /** How many answers were given, so an answer that changed nothing here is visible as such. */
  answered: number
  /** True while nothing has been answered and every band is a placeholder. */
  empty: boolean
  /** Band 1. */
  ownership: OwnershipBand
  /** Band 2. */
  handover: HandoverBand
  /** Band 3. */
  join: JoinBand
  /** Band 4. */
  surface: SurfaceBand
  /** One polite live-region sentence per recomputation. */
  announcement: string
}

const YOUR_TEAM: PartyLane = { id: 'party.you', label: 'your team', treatment: 'your-team' }
const ANOTHER_TEAM: PartyLane = { id: 'party.another', label: 'another team at your company', treatment: 'another-team' }
const OUTSIDE_PARTY: PartyLane = { id: 'party.outside', label: 'a party you cannot direct', treatment: 'cannot-direct' }

/** The answer-to-element table: a mark with no row here is a mark with no evidence. */
export const DELIVERY_TOPOLOGY_TABLE: readonly TopologyRule[] = [
  { answerId: 'question.ownership.composition-parties#one-team', lanes: [YOUR_TEAM] },
  { answerId: 'question.ownership.composition-parties#several-teams', lanes: [YOUR_TEAM, ANOTHER_TEAM], ghostStrip: true },
  {
    answerId: 'question.ownership.composition-parties#outside-party',
    lanes: [YOUR_TEAM, OUTSIDE_PARTY],
    ghostStrip: true,
    controlGlyph: 'one-way',
    controlNote: 'you cannot direct when they ship',
  },
  {
    answerId: 'question.ownership.composition-parties#no-deploy-control',
    lanes: [YOUR_TEAM, OUTSIDE_PARTY],
    ghostStrip: true,
    controlGlyph: 'both-ways',
    controlNote: 'neither side can direct when the other ships',
    seam: 'gapped-hard',
    seamEntailed: true,
  },
  { answerId: 'question.deploy.independence#independent', seam: 'gapped-hard' },
  { answerId: 'question.deploy.independence#valuable-not-required', seam: 'gapped-by-preference' },
  { answerId: 'question.deploy.independence#train-mandated', seam: 'welded' },
  {
    answerId: 'question.migration.participant-ceiling#refactor-into-codebase',
    handover: 'source that can be refactored into a shared codebase',
  },
  { answerId: 'question.migration.participant-ceiling#bootstrap-edit', handover: 'a separate app whose build and startup can change' },
  {
    answerId: 'question.migration.participant-ceiling#build-change-only',
    handover: 'a separate app whose build can change, but not its startup',
  },
  {
    answerId: 'question.migration.participant-ceiling#wrap-as-is',
    handover: 'a deployed app, exactly as it already runs',
    handoverLocked: true,
  },
  {
    answerId: 'question.delivery.server-capacity#static-only',
    operator: 'you ship files to a CDN and operate nothing on the request path',
  },
  { answerId: 'question.delivery.server-capacity#no-new-tier', operator: 'servers exist, but nobody wants another service to operate' },
  {
    answerId: 'question.delivery.server-capacity#operates-servers',
    operator: 'a team already runs server estates and could take one more',
  },
  {
    answerId: 'question.trust.malicious-participant#contain-malice',
    boundaryLanguage: 'attackers',
    requirement: 'you required: it holds even if that piece is compromised',
    divider: { glyph: 'double-wall', label: 'a doubled wall: it holds even if that piece is compromised' },
  },
  {
    answerId: 'question.failure.containment#must-survive',
    requirement: 'you required: one region may fail without the others',
    divider: { glyph: 'wall', label: 'a wall: one region may fail without the others' },
  },
  {
    answerId: 'question.ux.seam-tolerance#seams-acceptable',
    divider: { glyph: 'seam-line', label: 'a visible seam: edges are acceptable here' },
  },
  {
    answerId: 'question.delivery.first-paint#crawlable-required',
    requirement: 'you required: the combined pages render before any script runs',
  },
  {
    answerId: 'question.roster.runtime-admission#no-host-change',
    admission: { state: 'runtime-admission', text: 'new pieces and new versions appear without anyone touching the host' },
  },
  {
    answerId: 'question.roster.runtime-admission#redeploy-acceptable',
    admission: { state: 'redeploy-per-piece', text: 'each new piece is admitted by redeploying the main application' },
  },
  { answerId: 'question.granularity.single-screen#mixed-screen', pageShape: 'mixed-screen' },
  { answerId: 'question.granularity.single-screen#probably-later', pageShape: 'mixed-screen-later' },
  { answerId: 'question.granularity.single-screen#page-per-team', pageShape: 'page-per-team' },
  {
    answerId: 'question.contracts.sync-calls#sync-required',
    regionLink: { kind: 'same-call-stack', text: 'one live call stack is required' },
  },
  { answerId: 'question.contracts.sync-calls#messaging-acceptable', regionLink: { kind: 'messages', text: 'messages cross the boundary' } },
  {
    answerId: 'question.coordination.upgrade-train#skew-today',
    dependencyNote: 'each team upgrades when it can, and the screen carries the skew',
  },
  {
    answerId: 'question.coordination.upgrade-train#could-govern',
    dependencyNote: 'teams could move in step, but you would rather not depend on it',
  },
  {
    answerId: 'question.coordination.upgrade-train#trains-run',
    dependencyNote: 'aligned upgrade trains already run across the affected teams',
  },
  { answerId: 'question.deps.major-coexistence#stuck-and-unfunded', dependencyNote: 'some pieces are stuck on an older major, unfunded' },
  {
    answerId: 'question.deps.major-coexistence#alignment-funded',
    dependencyNote: 'versions are mixed, and the alignment work is funded and owned',
  },
  {
    answerId: 'question.deps.major-coexistence#aligned',
    dependencyNote: 'everything already runs the same major, or the differences are compatible',
  },
  {
    answerId: 'question.deps.payload-budget#hard-budget',
    dependencyNote: 'one page-weight budget applies to every piece on the screen together',
  },
  { answerId: 'question.deps.payload-budget#duplication-tolerable', dependencyNote: 'some duplication between the pieces is tolerable' },
  {
    answerId: 'question.host.negotiability#hosts-unmodifiable',
    seat: {
      state: 'reader-participates',
      note: 'hosts cannot be asked to change anything, so your product runs in their pages as they are',
    },
  },
  {
    answerId: 'question.host.negotiability#credible-ask',
    seat: { state: 'varies-per-host', note: 'most hosts would adopt a small install, but not all of them will' },
  },
  {
    answerId: 'question.host.negotiability#hosts-cooperate',
    seat: { state: 'reader-hosts', note: 'every embedding host is yours, or cooperates' },
  },
]

/** Authored short copy for the unanswered state, one entry per question that draws a placeholder. */
const PLACEHOLDER_COPY: Record<string, PlaceholderCopy> = {
  'question.ownership.composition-parties': { prompt: 'Who else ships a piece? Not asked yet', subject: 'who builds and ships each piece' },
  'question.migration.participant-ceiling': {
    prompt: 'What each party hands over is not established',
    subject: 'what each party hands over',
  },
  'question.deploy.independence': { prompt: 'The release boundary: not yet decided', subject: 'where the release boundary falls' },
  'question.delivery.server-capacity': {
    prompt: 'Who runs the composition point: not asked yet',
    subject: 'who runs the composition point',
  },
  'question.granularity.single-screen': {
    prompt: 'Does one screen ever mix owners? Not asked yet',
    subject: 'whether one screen mixes owners',
  },
  'question.deps.major-coexistence': {
    prompt: 'Framework copies on one screen: not asked yet',
    subject: 'how many framework copies a screen carries',
  },
}

/** The caption printed under each seam state, one per state and never blurred. */
const SEAM_CAPTIONS: Record<SeamState, string> = {
  welded: 'One build joins them; nothing crosses independently.',
  'gapped-hard': 'Each side crosses on its own schedule; contract drift is structurally possible here.',
  'gapped-by-preference': 'Available, not required. You ranked this; you did not require it.',
  undecided: 'The release boundary: not yet decided by your answers.',
}

/** What the user sees, one sentence per page shape. */
const PAGE_SHAPE_TEXT: Record<PageShape, string> = {
  'mixed-screen': 'At least one screen shows the work of two owners at the same time.',
  'mixed-screen-later': 'No screen mixes owners today, and you expect one to once the product grows.',
  'page-per-team': 'Each page belongs to one team, and you move between them by navigating.',
  undetermined: 'One page, and we have not asked whether one screen ever mixes owners. This does not default to two.',
}

/** Display names for the two groups the evidence keeps together, used on cluster chips. */
const CLUSTER_LABELS: Record<string, string> = {
  'cluster.build-fused-five': 'One build, one deploy',
  'cluster.federation-lifecycle': 'Loaded, then mounted',
}

/** The question behind each band, plus the others whose answers may add to it. */
const BAND_QUESTIONS: Record<string, readonly string[]> = {
  ownership: ['question.ownership.composition-parties'],
  handover: ['question.migration.participant-ceiling'],
  join: [
    'question.deploy.independence',
    'question.delivery.server-capacity',
    'question.roster.runtime-admission',
    'question.trust.malicious-participant',
    'question.failure.containment',
    'question.delivery.first-paint',
  ],
  surface: [
    'question.granularity.single-screen',
    'question.ux.seam-tolerance',
    'question.contracts.sync-calls',
    'question.host.negotiability',
    'question.coordination.upgrade-train',
    'question.deps.major-coexistence',
    'question.deps.payload-budget',
  ],
}

const SEAT_UNANSWERED: Seat = { state: 'reader-hosts', note: 'nothing you answered moves the host seat, so this figure keeps you in it' }

const RULE_INDEX = createMap(DELIVERY_TOPOLOGY_TABLE.map((rule) => <readonly [string, TopologyRule]>[rule.answerId, rule]))

const questionEntries: [string, Question][] = []
const answerEntries: [string, Answer][] = []
for (const question of decisionFramework.questions) {
  questionEntries.push([question.id, question])
  for (const answer of question.answers) answerEntries.push([answer.id, answer])
}
const QUESTION_INDEX = createMap(questionEntries)
const ANSWER_INDEX = createMap(answerEntries)

/**
 * Looks up the row that licenses an answer to draw something.
 *
 * @param answerId - The answer the reader selected.
 * @returns The row, or undefined when the answer draws nothing at all.
 */
export function ruleFor(answerId: string): TopologyRule | undefined {
  return RULE_INDEX.get(answerId)
}

const lastOf = <T>(rules: readonly TopologyRule[], read: (rule: TopologyRule) => T | undefined): T | undefined => {
  let found: T | undefined
  for (const rule of rules) {
    const value = read(rule)
    if (value !== undefined) found = value
  }
  return found
}

const gateReasonOf = (question: Question): string | undefined => {
  if (!question.unlockedBy || question.unlockedBy.length === 0) return undefined
  const labels = question.unlockedBy.map((gate) => ANSWER_INDEX.get(gate.answerId)?.label ?? gate.answerId)
  return `Not asked. This question opens only if you answer: ${labels.join('; or: ')}.`
}

/**
 * Builds the control that stands in for an element no answer has established.
 *
 * The prompt is authored per question and deliberately short: a question's own
 * circumstance runs to 248 characters, which cannot be drawn as a mark.
 *
 * @param questionId - The question that would establish the element.
 * @param result - The evaluated assessment, which decides whether the question is being asked.
 * @returns The placeholder, or undefined when the question id has no authored copy.
 */
export function placeholderFor(questionId: string, result: EngineResult): TopologyPlaceholder | undefined {
  const question = QUESTION_INDEX.get(questionId)
  const copy = PLACEHOLDER_COPY[questionId]
  if (!question || !copy) return undefined
  const reachable = result.relevant.some((candidate) => candidate.id === questionId)
  const lockedReason = reachable ? undefined : gateReasonOf(question)
  return {
    prompt: copy.prompt,
    accessibleName: lockedReason
      ? `Not asked: ${copy.subject}. Question ${question.rank} is not being asked yet.`
      : `Not established: ${copy.subject}. Answer question ${question.rank}.`,
    questionId,
    questionNumber: question.rank,
    locked: Boolean(lockedReason),
    lockedReason,
  }
}

const provenanceOf = (band: string, result: EngineResult): BandProvenance[] => {
  const ids = BAND_QUESTIONS[band] ?? []
  const chips: BandProvenance[] = []
  for (const questionId of ids) {
    const question = QUESTION_INDEX.get(questionId)
    if (!question) continue
    const answered = result.answered.find((entry) => entry.question.id === questionId)
    if (!answered && questionId !== ids[0]) continue
    chips.push({
      questionId,
      questionNumber: question.rank,
      answerLabel: answered?.answer.label,
      reachable: result.relevant.some((candidate) => candidate.id === questionId),
    })
  }
  return chips
}

const railOf = (answer: Answer | undefined): RailStyle => (answer ? answer.answerClass : 'unanswered')

// why: a group the evidence does not separate draws one chip, so the five-family pile-up that broke the scatter cannot re-form here
const chipsOf = (families: Family[], result: EngineResult): PositionChip[] => {
  const chips: PositionChip[] = []
  const byId = createMap<string, PositionChip>()
  for (const family of families) {
    const surviving = result.surviving.some((candidate) => candidate.id === family.id)
    const clusterId = family.clusterId
    if (!clusterId) {
      chips.push({
        id: family.id,
        label: family.name,
        members: 1,
        struck: !surviving,
        hyperfrontend: family.id === HYPERFRONTEND_FAMILY_ID,
      })
      continue
    }
    const existing = byId.get(clusterId)
    if (existing) {
      existing.members += 1
      existing.struck = existing.struck && !surviving
      continue
    }
    const label = CLUSTER_LABELS[clusterId] ?? clusterId
    const chip: PositionChip = { id: clusterId, label, members: 1, struck: !surviving, hyperfrontend: false }
    byId.set(clusterId, chip)
    chips.push(chip)
  }
  for (const chip of chips) {
    if (chip.members > 1) chip.note = `${chip.members} approaches compose here, and nothing about your delivery topology separates them.`
  }
  return chips
}

const reasonsOf = (families: Family[], result: EngineResult): string[] => {
  const seen: string[] = []
  for (const family of families) {
    const elimination = result.eliminated.find((entry) => entry.family.id === family.id)
    if (!elimination) continue
    const label = ANSWER_INDEX.get(elimination.by.answerId)?.label
    if (label && !seen.includes(label)) seen.push(label)
  }
  return seen
}

/**
 * Derives the three composition positions from the dataset's assembly-locus
 * channel, keeping the request path as two sub-rows because the engine acts on
 * the distinction: one answer closes the assembling row and leaves the
 * forwarding row open.
 *
 * @param result - The evaluated assessment, which decides what is struck.
 * @returns The rows, top to bottom, from build to browser.
 */
export function compositionPositionsOf(result: EngineResult): CompositionPosition[] {
  const { axes, families } = decisionFramework
  const build = families.filter((family) => family.position.depth <= 10)
  const browser = families.filter((family) => family.position.depth >= 100)
  const requestPath = families
    .filter((family) => family.position.depth > 10 && family.position.depth < 100)
    .sort((left, right) => left.position.depth - right.position.depth)

  const groups: PositionGroup[] = [{ id: 'position.build', pole: 'build', poleLabel: axes.depth.low, members: build }]
  for (const family of requestPath) {
    const row: PositionGroup = {
      id: `position.request-path.${family.id}`,
      pole: 'request-path',
      poleLabel: axes.depth.mid,
      members: [family],
    }
    groups.push({ ...row, detail: family.boundary })
  }
  groups.push({ id: 'position.browser', pole: 'browser', poleLabel: axes.depth.high, members: browser })

  return groups.map((group) => ({
    id: group.id,
    pole: group.pole,
    poleLabel: group.poleLabel,
    detail: group.detail,
    struck: !group.members.some((family) => result.surviving.some((candidate) => candidate.id === family.id)),
    reasons: reasonsOf(group.members, result),
    chips: chipsOf(group.members, result),
  }))
}

/**
 * States the contract the surviving approaches cross, or counts how many
 * contracts the answers still allow.
 *
 * @param result - The evaluated assessment.
 * @returns The line, with the shared boundary when the survivors agree on one.
 */
export function contractLineOf(result: EngineResult): ContractLine {
  const boundaries: string[] = []
  for (const family of result.surviving) if (!boundaries.includes(family.boundary)) boundaries.push(family.boundary)
  const shared = boundaries.length === 1 ? boundaries[0] : undefined
  if (boundaries.length === 0) return { distinct: 0, text: 'No approach survives your answers, so there is no contract left to draw.' }
  if (shared) return { shared, distinct: 1, text: shared }
  return { distinct: boundaries.length, text: `${boundaries.length} different contracts are still open here.` }
}

const inSentence = (label: string): string => label.charAt(0).toLowerCase() + label.slice(1)

// why: the request path draws two rows, so counting rows would report four positions where the dataset separates three
const poleLabelsOf = (positions: CompositionPosition[]): string[] => {
  const labels: string[] = []
  for (const position of positions) {
    const label = inSentence(position.poleLabel)
    if (!labels.includes(label)) labels.push(label)
  }
  return labels
}

// why: the thesis is built from the same values as the marks, so the visible sentence and the drawn figure cannot drift apart
const thesisOf = (topology: Omit<DeliveryTopology, 'thesis' | 'announcement'>): string => {
  if (topology.empty) return 'Nothing here is known yet. Every band is drawn from an answer you have not given.'
  const lanes = topology.ownership.lanes
  const named = lanes.map((lane) => lane.label).join(' and ')
  const parties = `${named.charAt(0).toUpperCase()}${named.slice(1)} ${lanes.length > 1 ? 'each ship a piece' : 'builds and ships every piece'}`
  const handover = topology.handover.artifact ? `, and what each hands over is ${topology.handover.artifact}` : ''
  const live = poleLabelsOf(topology.join.positions.filter((position) => !position.struck))
  const where = live.length === 0 ? 'Nothing survives to join them.' : `The parts are put together: ${live.join(', or ')}.`
  const seat = topology.surface.seat.state === 'reader-hosts' ? '' : ` You reported that ${topology.surface.seat.note}.`
  return `${parties}${handover}. ${SEAM_CAPTIONS[topology.join.seam.state]} ${where} ${topology.surface.shapeText}${seat}`
}

/**
 * Turns an evaluated assessment into the topology the independence-seam diagram
 * draws. Pure: the same result always produces the same model, and every mark in
 * it traces to a row of {@link DELIVERY_TOPOLOGY_TABLE} or to the dataset itself.
 *
 * @param result - The evaluated assessment.
 * @returns The four bands, the thesis, and the live-region sentence.
 * @example
 * ```ts
 * const topology = deriveDeliveryTopology(evaluate({}))
 * topology.join.seam.state // 'undecided'
 * ```
 */
export function deriveDeliveryTopology(result: EngineResult): DeliveryTopology {
  const rules: TopologyRule[] = []
  const answersByQuestion = createMap(result.answered.map((entry) => <readonly [string, Answer]>[entry.question.id, entry.answer]))
  for (const entry of result.answered) {
    const rule = ruleFor(entry.answer.id)
    if (rule) rules.push(rule)
  }

  const ownershipAnswer = answersByQuestion.get('question.ownership.composition-parties')
  const ceilingAnswer = answersByQuestion.get('question.migration.participant-ceiling')
  const deployAnswer = answersByQuestion.get('question.deploy.independence')
  const screenAnswer = answersByQuestion.get('question.granularity.single-screen')
  const operatorAnswer = answersByQuestion.get('question.delivery.server-capacity')

  const entailed = rules.some((rule) => rule.seamEntailed === true)
  // why: an ownership fact outranks a stated release policy, because a party that cannot be directed gaps the seam whatever the policy says
  const seamState: SeamState = entailed ? 'gapped-hard' : (lastOf(rules, (rule) => rule.seam) ?? 'undecided')
  const positions = compositionPositionsOf(result)
  const live = poleLabelsOf(positions.filter((position) => !position.struck))
  const closed = poleLabelsOf(positions).length - live.length

  const dependencyOpen = screenAnswer?.id === 'question.granularity.single-screen#mixed-screen'
  const dependencyNotes: string[] = []
  for (const rule of rules) if (rule.dependencyNote) dependencyNotes.push(rule.dependencyNote)
  const requirements: string[] = []
  for (const rule of rules) if (rule.requirement && !requirements.includes(rule.requirement)) requirements.push(rule.requirement)
  const dividers: DividerMark[] = []
  for (const rule of rules) if (rule.divider) dividers.push(rule.divider)
  // why: the doubled wall is earned by the strongest thing the reader required, so a later, milder answer must not downgrade the glyph
  const divider = dividers.find((mark) => mark.glyph === 'double-wall') ?? dividers.find((mark) => mark.glyph === 'wall') ?? dividers[0]

  const ownership: OwnershipBand = {
    lanes: [...(lastOf(rules, (rule) => rule.lanes) ?? [YOUR_TEAM])],
    ghostStrip: lastOf(rules, (rule) => rule.ghostStrip) ?? false,
    controlGlyph: lastOf(rules, (rule) => rule.controlGlyph) ?? 'none',
    controlNote: lastOf(rules, (rule) => rule.controlNote),
    rail: railOf(ownershipAnswer),
    provenance: provenanceOf('ownership', result),
    placeholder: ownershipAnswer ? undefined : placeholderFor('question.ownership.composition-parties', result),
  }

  const handover: HandoverBand = {
    artifact: lastOf(rules, (rule) => rule.handover),
    locked: lastOf(rules, (rule) => rule.handoverLocked) ?? false,
    rail: railOf(ceilingAnswer),
    provenance: provenanceOf('handover', result),
    placeholder: ceilingAnswer ? undefined : placeholderFor('question.migration.participant-ceiling', result),
  }

  const join: JoinBand = {
    seam: {
      state: seamState,
      caption: entailed ? `${SEAM_CAPTIONS['gapped-hard']} Entailed by ownership, not chosen.` : SEAM_CAPTIONS[seamState],
      entailed,
      placeholder: seamState === 'undecided' ? placeholderFor('question.deploy.independence', result) : undefined,
    },
    positions,
    positionsCaption:
      live.length === 0
        ? 'Your answers close every composition position, so nothing in this landscape can put the parts together for you.'
        : live.length === 1
          ? `One composition position is left open by your answers: ${live[0]}.`
          : `${live.length} composition positions are still open, and this figure draws all of them rather than picking the likeliest.`,
    operator: lastOf(rules, (rule) => rule.operator),
    operatorPlaceholder: operatorAnswer ? undefined : placeholderFor('question.delivery.server-capacity', result),
    contract: contractLineOf(result),
    boundaryLanguage: lastOf(rules, (rule) => rule.boundaryLanguage) ?? 'accidents',
    requirements,
    admission: lastOf(rules, (rule) => rule.admission),
    rail: entailed ? 'hard' : railOf(deployAnswer),
    provenance: provenanceOf('join', result),
  }

  const surface: SurfaceBand = {
    shape: lastOf(rules, (rule) => rule.pageShape) ?? 'undetermined',
    shapeText: PAGE_SHAPE_TEXT[lastOf(rules, (rule) => rule.pageShape) ?? 'undetermined'],
    divider,
    regionLink: lastOf(rules, (rule) => rule.regionLink),
    dependency: {
      locked: !dependencyOpen,
      notes: dependencyNotes,
      placeholder: dependencyOpen && dependencyNotes.length === 0 ? placeholderFor('question.deps.major-coexistence', result) : undefined,
    },
    seat: lastOf(rules, (rule) => rule.seat) ?? SEAT_UNANSWERED,
    rail: railOf(screenAnswer),
    provenance: provenanceOf('surface', result),
    placeholder: screenAnswer ? undefined : placeholderFor('question.granularity.single-screen', result),
  }

  const core: Omit<DeliveryTopology, 'thesis' | 'announcement'> = {
    drawnFrom: rules.length,
    answered: result.answered.length,
    empty: result.answered.length === 0,
    ownership,
    handover,
    join,
    surface,
  }

  return {
    ...core,
    thesis: thesisOf(core),
    announcement: closed === 0 ? 'Every position is still open.' : `Composition narrowed to: ${live.join(', ')}. ${closed} closed.`,
  }
}
