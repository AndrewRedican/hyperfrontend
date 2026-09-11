import { abs, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Where one card sits, in the coordinate space of the map that holds it.
 */
export interface SpineBox {
  /** Distance from the map's top edge to the card's top edge */
  top: number
  /** Distance from the map's top edge to the card's bottom edge */
  bottom: number
  /** Distance from the map's left edge to the card's left edge */
  left: number
  /** Distance from the map's left edge to the card's right edge */
  right: number
}

/**
 * The run of the spine, in the same coordinate space.
 */
export interface SpineSegment {
  /** Distance from the map's top edge to where the spine begins */
  top: number
  /** How far it runs from there */
  height: number
}

/**
 * How far apart two cards' top edges may be and still count as one row.
 *
 * Cards in a grid row share a top edge to the sub-pixel, so the tolerance is
 * there for rounding and nothing else.
 */
const ROW_TOLERANCE = 0.5

/** A row of the layout, and how the axis meets it. */
interface SpineRow {
  /** Top edge of the row */
  top: number
  /** Bottom edge of the row's tallest card */
  bottom: number
  /** The card the axis passes through, when one does */
  hit: SpineBox | null
  /** Whether the axis passes between two cards of the row instead */
  straddled: boolean
}

/**
 * Group cards into the rows the grid laid them out in.
 *
 * @param cards - Every card, in document order
 * @returns Rows in reading order, each holding its cards in order
 */
function groupRows(cards: readonly SpineBox[]): SpineBox[][] {
  const rows: SpineBox[][] = []

  for (const card of cards) {
    const current = rows[rows.length - 1]
    if (current && abs(current[0].top - card.top) <= ROW_TOLERANCE) {
      current.push(card)
    } else {
      rows.push([card])
    }
  }

  return rows
}

/**
 * Work out how the axis meets one row.
 *
 * @param row - The row's cards
 * @param axis - The spine's horizontal position
 * @returns The row's extent and its relationship to the axis
 */
function describeRow(row: readonly SpineBox[], axis: number): SpineRow {
  const hit = row.find((card) => card.left <= axis && axis <= card.right) ?? null
  return {
    top: row[0].top,
    bottom: max(...row.map((card) => card.bottom)),
    hit,
    straddled: hit === null && row.some((card) => card.right < axis) && row.some((card) => card.left > axis),
  }
}

/**
 * Where the spine runs, given where the cards are.
 *
 * The spine is the vertical axis down the middle of the library index, and
 * the rule for it is that it connects cards rather than spanning the grid
 * they happen to sit in. It begins at the bottom edge of the first card it
 * would otherwise pass behind, and it ends at the top edge of the last: so it
 * emanates from the flagship and arrives at whichever card is last on its
 * path, and it never continues below that into the empty space an incomplete
 * final row leaves beside a lone card.
 *
 * Nothing here knows how many columns the grid has or how many packages are
 * on it. A row is on the spine's path if the axis passes through one of its
 * cards, or between two of them. A grid with an odd number of columns puts a
 * card on the axis and the spine stops at that card's top edge; a grid with
 * an even number puts the axis in the gap between the middle pair, and the
 * spine runs down that gap to the pair's bottom edge, so a pair the axis
 * threads is threaded whole. Both fall out of the same two questions, which
 * is what keeps the geometry right when packages are added, when a level
 * changes its column count, or when a phone folds everything to one column
 * and every card is on the path.
 *
 * @param cards - Every card on the map, in document order, in the map's coordinates
 * @param axis - The spine's horizontal position, in the same coordinates
 * @returns The run of the spine, or null when nothing is left for it to connect
 *
 * @example A flagship above a three-column row whose middle card the axis crosses
 * ```typescript
 * computeSpine(
 *   [
 *     { top: 0, bottom: 100, left: 0, right: 600 },
 *     { top: 150, bottom: 250, left: 0, right: 190 },
 *     { top: 150, bottom: 250, left: 205, right: 395 },
 *     { top: 150, bottom: 250, left: 410, right: 600 },
 *   ],
 *   300
 * )
 * // { top: 100, height: 50 }: from the flagship's bottom edge to the middle card's top edge
 * ```
 */
export function computeSpine(cards: readonly SpineBox[], axis: number): SpineSegment | null {
  const onPath = groupRows(cards)
    .map((row) => describeRow(row, axis))
    .filter((row) => row.hit !== null || row.straddled)
  const first = onPath[0]
  const last = onPath[onPath.length - 1]

  if (!first || !last) {
    return null
  }

  const start = first.hit ? first.hit.bottom : first.top
  const end = last.hit ? last.hit.top : last.bottom

  return end > start ? { top: start, height: end - start } : null
}
