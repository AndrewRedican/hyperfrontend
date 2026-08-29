/**
 * Geometry and copy for the banded landscape: where the dataset cuts itself into bands,
 * which card each family belongs to, and what every cell says.
 *
 * The renderer holds no reasoning. Bands are derived from the shipped coordinates rather
 * than chosen, cards are the clusters the research records rather than groups a threshold
 * invented, and implementation counts are computed and deduped by implementation id.
 * Everything the design calls verified is asserted at module load, so a dataset edit that
 * moves a band or changes a count fails the build instead of printing a wrong number.
 *
 * @module banded-landscape-model
 */

import type { Family } from '../../data/decision-framework'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { decisionFramework } from '../../data/decision-framework'

const { axes, families, implementations } = decisionFramework

/** The smallest difference these two axes may claim, so any wider gap is a real boundary. */
export const SMALLEST_RENDERABLE_DIFFERENCE = 12

const VERIFIED_X_CUTS = [29.5, 90]
const VERIFIED_Y_CUTS = [25.5, 65.5]

const VERIFIED_CARD_COUNTS: Record<string, number> = {
  'card-build-fused-five': 2,
  'card-server-fragment-assembly': 3,
  'card-custom-element-composition': 2,
  'card-federation-lifecycle': 6,
  'card-route-partition': 2,
  'card-virtualized-rehosting': 4,
  'card-document-embedding': 3,
}

/** Authored prose for one band; the numeric range beside it is derived, never typed in. */
export interface BandCopy {
  /** Key for the band, used to build element ids and to look up its cells. */
  id: string
  /** Short heading, and the only band text a single-column reader meets before the sentence. */
  label: string
  /** Pole sentence printed under the label, so a band never reads as a bare range. */
  sentence: string
  /** A reading the band has to disown permanently, printed as header text rather than a footnote. */
  warning?: string
}

/** A band carrying the range the shipped coordinates actually put inside it. */
export interface Band extends BandCopy {
  /** Lowest coordinate any family in the band holds. */
  low: number
  /** Highest coordinate any family in the band holds. */
  high: number
  /** Families in the band, in dataset order. */
  familyIds: string[]
}

/** Where composition executes, as the three-step channel the research permits. */
export interface DepthPole {
  /** Three-slot glyph, which is the whole channel: never a colour ramp and never a size. */
  glyph: string
  /** The words that always follow the glyph immediately, so the glyph is never alone. */
  words: string
}

/** Authored copy for one card, plus the families the card holds. */
export interface CardCopy {
  /** Key for the card, used to build element ids and to assert its implementation count. */
  id: string
  /** Families on the card, in dataset order; more than one only where the evidence does not separate them. */
  familyIds: string[]
  /** Cluster title, absent on a card holding one family, which uses that family's own name. */
  title?: string
  /** The consequence a cluster shares, printed instead of a ranking the evidence cannot support. */
  sharedConsequence?: string
  /** The capability fact the card states in words, where position alone would imply the opposite. */
  statedFact?: string
  /** Reach marker text, present only where a documented spread crosses a band cut. */
  reach?: string
  /** A documented spread that stays inside its own band, stated without a marker. */
  spread?: string
}

/** One card as drawn: its families resolved, its band placement derived, its count computed. */
export interface LandscapeCard {
  /** Key for the card, used to build element ids. */
  id: string
  /** Integration-time band the card sits in. */
  columnId: string
  /** Runtime-realm band the card sits in. */
  rowId: string
  /** Families on the card, in dataset order. */
  members: Family[]
  /** The card title: a cluster name, or the single family's name. Never the plain name. */
  title: string
  /** Where composition executes for every family on the card. */
  depth: DepthPole
  /** Catalogued implementations across the card's families, deduped by implementation id. */
  implementationCount: number
  /** The consequence a cluster shares, printed instead of a ranking the evidence cannot support. */
  sharedConsequence?: string
  /** The capability fact the card states in words, where position alone would imply the opposite. */
  statedFact?: string
  /** Reach marker text, present only where a documented spread crosses a band cut. */
  reach?: string
  /** A documented spread that stays inside its own band, stated without a marker. */
  spread?: string
}

/** One of the nine combinations, holding whatever the landscape puts there. */
export interface LandscapeCell {
  /** Key for the cell, used to build element ids. */
  id: string
  /** Integration-time band the cell belongs to. */
  columnId: string
  /** Runtime-realm band the cell belongs to. */
  rowId: string
  /** Cards in the cell, ordered by where their composition executes. */
  cards: LandscapeCard[]
  /** The sentence an unoccupied cell prints, absent wherever the cell holds cards. */
  emptySentence?: string
}

/** One integration-time column, with its three cells and its single-column fallback line. */
export interface LandscapeColumn {
  /** The integration-time band this column draws. */
  band: Band
  /** The column's three cells, in the order they are drawn top to bottom. */
  cells: LandscapeCell[]
  /** One line standing in for the column's unoccupied cells once the grid collapses to one column. */
  emptyLine: string
}

const COLUMN_COPY: BandCopy[] = [
  { id: 'x-a', label: 'Everything ships together', sentence: axes.x.low },
  {
    id: 'x-b',
    label: 'Each part ships on its own',
    sentence: 'The page is assembled from whatever each team last published',
  },
  { id: 'x-c', label: 'Joins a running page', sentence: axes.x.high },
]

const ROW_COPY: BandCopy[] = [
  {
    id: 'y-r1',
    label: 'One shared runtime',
    sentence: 'A fault, a stray style or a patched built-in reaches all of them',
  },
  {
    id: 'y-r2',
    label: 'A simulated private runtime',
    sentence: 'Each part gets a private runtime the page simulates around it',
  },
  { id: 'y-r3', label: 'Its own browser document', sentence: axes.y.high, warning: 'This is about accidents, not attackers.' },
]

const CARD_COPY: CardCopy[] = [
  {
    id: 'card-build-fused-five',
    familyIds: ['family.modular-monolith', 'family.package-composition', 'family.spa-routing', 'family.server-templates', 'family.islands'],
    title: 'One build, one deploy',
    sharedConsequence:
      'The evidence does not separate these five: contract drift is structurally impossible and no part has a deploy schedule of its own. Choose inside this group on grounds these two axes do not measure.',
  },
  {
    id: 'card-server-fragment-assembly',
    familyIds: ['family.server-fragment-assembly'],
    spread: 'Members span X 55 to 89, entirely inside this column.',
  },
  {
    id: 'card-custom-element-composition',
    familyIds: ['family.custom-element-composition'],
    spread: 'Members span Y 0 to 23, entirely inside this row.',
  },
  {
    id: 'card-federation-lifecycle',
    familyIds: ['family.module-graph-federation', 'family.lifecycle-orchestration'],
    title: 'Loaded, then mounted',
    sharedConsequence:
      'These two axes put both at one point. They differ in the seam rather than in the space: federation loads a module graph, an orchestrator mounts a lifecycle.',
  },
  {
    id: 'card-route-partition',
    familyIds: ['family.route-partition'],
    statedFact: 'Participants never appear on one screen. It reaches this row by keeping them apart, not by walling them off.',
  },
  {
    id: 'card-virtualized-rehosting',
    familyIds: ['family.virtualized-rehosting'],
    reach: 'Members span Y 23 to 58; sandbox strength genuinely differs.',
  },
  {
    id: 'card-document-embedding',
    familyIds: ['family.document-embedding'],
    statedFact: 'Two teams on one screen, behind browser-enforced walls.',
  },
]

const MEMBER_NOTES: Record<string, string | undefined> = {
  'family.islands': 'the only one of the five where a failure is bounded to one region',
}

const EMPTY_SENTENCES: Record<string, string | undefined> = {
  'x-a/y-r2':
    'Nothing here. No approach in this landscape reaches a simulated realm, or puts its parts in separate documents, while shipping them in one build.',
  'x-a/y-r3':
    'Nothing here. No approach in this landscape reaches a simulated realm, or puts its parts in separate documents, while shipping them in one build.',
  'x-b/y-r2': 'Nothing here. No independently shipped approach in this landscape uses a simulated private runtime.',
  'x-c/y-r1': 'Nothing here. Nothing that admits parts into a running page keeps them all in one fully shared runtime.',
}

const COLUMN_EMPTY_LINES: Record<string, string> = {
  'x-a': 'No approach in this band reaches a simulated realm or separate documents.',
  'x-b': 'No approach in this band uses a simulated private runtime.',
  'x-c': 'No approach in this band keeps everything in one fully shared runtime.',
}

/** The three assembly-locus positions, which is every depth step the research permits. */
export const DEPTH_POLES: DepthPole[] = [
  { glyph: '#..', words: axes.depth.low },
  { glyph: '.#.', words: axes.depth.mid },
  { glyph: '..#', words: axes.depth.high },
]

/** The four facts this landscape cannot carry, printed as visible content rather than a footnote. */
export const CANNOT_SHOW: string[] = [
  'Adoption cost is invisible here, and it is often the constraint that decides.',
  'Trust is a separate gate rather than a height: a same-origin frame sits at the top of the last row and still holds host authority.',
  'Whether two teams can share one screen is on neither axis.',
  'Roster authority, release actuation, contract explicitness and orchestration thickness still decide real cases.',
]

const familyById = createMap(families.map((family) => [family.id, family]))

/**
 * Resolves a family id against the dataset, refusing to carry on with a card that names
 * a family the projection no longer ships.
 *
 * @param id - Family id taken from the authored card copy.
 * @returns The family the id names.
 */
function requireFamily(id: string): Family {
  const family = familyById.get(id)
  if (!family) throw createError(`banded-landscape: unknown family ${id}`)
  return family
}

/**
 * Splits one axis at every gap the dataset leaves wider than the smallest difference the
 * axes may claim, then attaches the authored copy to each band that falls out.
 *
 * The split is forced by the data rather than chosen: cuts land at the midpoint of a
 * qualifying gap, and the count of cuts has to match the count of authored bands, so a
 * coordinate edit that opens or closes a gap fails here rather than drawing a band the
 * evidence no longer supports.
 *
 * @param copy - Authored band prose, ordered from the low end of the axis to the high end.
 * @param coordinateOf - Reads the axis coordinate from a family.
 * @param verifiedCuts - The cuts the shipped dataset is known to produce.
 * @returns One band per authored entry, each carrying its real range and members.
 */
function bandsFrom(copy: BandCopy[], coordinateOf: (family: Family) => number, verifiedCuts: number[]): Band[] {
  const ordered = [...families].sort((left, right) => coordinateOf(left) - coordinateOf(right))
  const cuts: number[] = []
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = coordinateOf(ordered[index - 1])
    const current = coordinateOf(ordered[index])
    if (current - previous > SMALLEST_RENDERABLE_DIFFERENCE) cuts.push((previous + current) / 2)
  }
  if (cuts.length !== verifiedCuts.length || cuts.some((cut, index) => cut !== verifiedCuts[index])) {
    throw createError(`banded-landscape: expected cuts ${verifiedCuts.join(', ')} but the dataset produces ${cuts.join(', ')}`)
  }
  const edges = [-1, ...cuts, 101]
  return copy.map((band, index) => {
    const members = ordered.filter((family) => coordinateOf(family) > edges[index] && coordinateOf(family) < edges[index + 1])
    if (members.length === 0) throw createError(`banded-landscape: band ${band.id} has no members`)
    return {
      ...band,
      low: coordinateOf(members[0]),
      high: coordinateOf(members[members.length - 1]),
      familyIds: members.map((family) => family.id),
    }
  })
}

/** Integration-time bands, low to high, which are the grid's three columns left to right. */
export const COLUMN_BANDS: Band[] = bandsFrom(COLUMN_COPY, (family) => family.position.x, VERIFIED_X_CUTS)

/**
 * Runtime-realm bands, low to high, drawn top to bottom so the shared-runtime end is the
 * top row.
 *
 * The axis is deliberately inverted. Two decades of consultant grids have taught readers
 * that the top-right cell is the winner's box, and the family this site implements is
 * already the most favored in the dataset; seating it there would add a positional
 * endorsement on top of a lean the page cannot afford. Nothing is lost, because height was
 * never security, and reading order becomes shared, then simulated, then separate: the
 * order of increasing separation and increasing cost.
 */
export const ROW_BANDS: Band[] = bandsFrom(ROW_COPY, (family) => family.position.y, VERIFIED_Y_CUTS)

/**
 * Counts the implementations that realize any of a set of families, deduped by
 * implementation id.
 *
 * Three catalogued implementations span two families each, so adding per-family counts
 * would over-report every card that holds one of those pairs.
 *
 * @param familyIds - Families to count implementations across.
 * @returns How many distinct catalogued implementations realize at least one of them.
 * @example
 * ```ts
 * implementationCountFor(['family.module-graph-federation', 'family.lifecycle-orchestration']) // 6
 * ```
 */
export function implementationCountFor(familyIds: string[]): number {
  const counted = createSet<string>()
  for (const implementation of implementations) {
    if (implementation.families.some((id) => familyIds.includes(id))) counted.add(implementation.id)
  }
  return counted.size
}

/**
 * Picks the assembly-locus pole a depth coordinate sits at.
 *
 * The dataset holds three clumps and nothing between them, so three steps report the data
 * exactly while a continuous ramp would invent a magnitude.
 *
 * @param depth - The family's assembly-locus coordinate.
 * @returns The pole whose glyph and words the card prints.
 * @example
 * ```ts
 * depthPoleOf(55).glyph // '.#.'
 * ```
 */
export function depthPoleOf(depth: number): DepthPole {
  if (depth < 30) return DEPTH_POLES[0]
  if (depth < 70) return DEPTH_POLES[1]
  return DEPTH_POLES[2]
}

/**
 * Reads the annotation a member chip carries beyond its name.
 *
 * Grouping five families behind one cluster title suppresses their differences by design,
 * so the one difference the evidence does record is printed rather than lost.
 *
 * @param familyId - The family whose chip is being drawn.
 * @returns The annotation, or undefined when the family has none.
 * @example
 * ```ts
 * memberNoteFor('family.islands') // 'the only one of the five where a failure is bounded to one region'
 * ```
 */
export function memberNoteFor(familyId: string): string | undefined {
  return MEMBER_NOTES[familyId]
}

/**
 * Finds the band a coordinate falls in.
 *
 * @param bands - Bands on one axis, low to high.
 * @param coordinate - The coordinate to place.
 * @returns The band that holds it.
 */
function bandFor(bands: Band[], coordinate: number): Band {
  const found = bands.find((band) => coordinate >= band.low && coordinate <= band.high)
  if (!found) throw createError(`banded-landscape: ${coordinate} falls in no band`)
  return found
}

/**
 * Builds every card from its authored copy, placing it by its members' coordinates and
 * asserting that the card is a group the evidence and the catalogue both agree with.
 *
 * @returns The seven cards, each with its band placement, depth pole and implementation count.
 */
function buildCards(): LandscapeCard[] {
  return CARD_COPY.map((copy) => {
    const members = copy.familyIds.map(requireFamily)
    const column = bandFor(COLUMN_BANDS, members[0].position.x)
    const row = bandFor(ROW_BANDS, members[0].position.y)
    for (const member of members) {
      if (bandFor(COLUMN_BANDS, member.position.x) !== column || bandFor(ROW_BANDS, member.position.y) !== row) {
        throw createError(`banded-landscape: card ${copy.id} spans more than one cell`)
      }
      const clustered = families.filter((family) => family.clusterId !== undefined && family.clusterId === member.clusterId)
      const grouped = clustered.map((family) => family.id).join()
      if (members.length > 1 && grouped !== copy.familyIds.join()) {
        throw createError(`banded-landscape: card ${copy.id} does not match the cluster recorded on ${member.id}`)
      }
      if (members.length === 1 && member.clusterId !== undefined) {
        throw createError(`banded-landscape: ${member.id} is clustered in the data but drawn alone`)
      }
    }
    const implementationCount = implementationCountFor(copy.familyIds)
    if (implementationCount !== VERIFIED_CARD_COUNTS[copy.id]) {
      throw createError(`banded-landscape: card ${copy.id} counts ${implementationCount}, verified ${VERIFIED_CARD_COUNTS[copy.id]}`)
    }
    return {
      id: copy.id,
      columnId: column.id,
      rowId: row.id,
      members,
      title: copy.title ?? members[0].name,
      depth: depthPoleOf(members[0].position.depth),
      implementationCount,
      sharedConsequence: copy.sharedConsequence,
      statedFact: copy.statedFact,
      reach: copy.reach,
      spread: copy.spread,
    }
  })
}

const CARDS = buildCards()

/**
 * Assembles the nine cells into three columns, ordering each cell's cards by where their
 * composition executes so vertical order inside a cell means something.
 *
 * @returns The three columns, each with its band, its three cells and its collapsed line.
 */
function buildColumns(): LandscapeColumn[] {
  const placed = createSet<string>()
  const columns = COLUMN_BANDS.map((band) => {
    const cells = ROW_BANDS.map((row) => {
      const cards = CARDS.filter((card) => card.columnId === band.id && card.rowId === row.id).sort(
        (left, right) => DEPTH_POLES.indexOf(left.depth) - DEPTH_POLES.indexOf(right.depth)
      )
      for (const card of cards) for (const member of card.members) placed.add(member.id)
      const key = `${band.id}/${row.id}`
      const emptySentence = EMPTY_SENTENCES[key]
      if (cards.length === 0 && !emptySentence) throw createError(`banded-landscape: cell ${key} is empty and has no sentence`)
      if (cards.length > 0 && emptySentence) throw createError(`banded-landscape: cell ${key} holds cards and an empty sentence`)
      return { id: key, columnId: band.id, rowId: row.id, cards, emptySentence }
    })
    return { band, cells, emptyLine: COLUMN_EMPTY_LINES[band.id] }
  })
  if (placed.size !== families.length) throw createError(`banded-landscape: ${placed.size} of ${families.length} families reached a cell`)
  return columns
}

/** The landscape as drawn: three columns of three cells, holding seven cards over twelve families. */
export const LANDSCAPE_COLUMNS: LandscapeColumn[] = buildColumns()

/** How far the axis runs between the first two columns, which is the discontinuity the cliff marks. */
export const CLIFF_GAP = COLUMN_BANDS[1].low - COLUMN_BANDS[0].high

/** How far the axis runs between the last two columns, drawn as an ordinary gutter. */
export const ORDINARY_GAP = COLUMN_BANDS[2].low - COLUMN_BANDS[1].high

/** The finding the fat top row draws rather than asserts, counted from the shipped coordinates. */
export const SHARED_RUNTIME_SENTENCE = `${ROW_BANDS[0].familyIds.length} of the ${families.length} approaches in this landscape run in one shared runtime.`
