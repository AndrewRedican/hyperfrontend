/**
 * The answer-to-element table behind the independence-seam diagram: the marks the
 * figure may draw, and the named answer that licenses each one.
 *
 * The governing rule is that an element may be drawn only if a named answer id
 * produces it. Every mark therefore appears here as a row of
 * {@link DELIVERY_TOPOLOGY_TABLE}, and an answer absent from the table draws
 * nothing, which is what keeps a delivery diagram from drifting into
 * registries, environments and pipeline stages the assessment never asked about.
 *
 * @module delivery-topology-table
 */

import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** How a party lane is filled. One treatment per epistemic state, never shared. */
export type PartyTreatment = 'your-team' | 'another-team' | 'cannot-direct' | 'not-established'
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

/** The reader's own lane, which every ownership answer carries because the reader is a party by construction. */
export const YOUR_TEAM: PartyLane = { id: 'party.you', label: 'your team', treatment: 'your-team' }
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

const RULE_INDEX = createMap(DELIVERY_TOPOLOGY_TABLE.map((rule) => <readonly [string, TopologyRule]>[rule.answerId, rule]))

/**
 * Looks up the row that licenses an answer to draw something.
 *
 * @param answerId - The answer the reader selected.
 * @returns The row, or undefined when the answer draws nothing at all.
 */
export function ruleFor(answerId: string): TopologyRule | undefined {
  return RULE_INDEX.get(answerId)
}
