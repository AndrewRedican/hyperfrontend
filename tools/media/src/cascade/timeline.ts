import type { CascadeConfig, CascadeTone } from '../models/cascade'
import type { CascadeLayout, CascadeMetrics, Point } from './layout'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long a copy takes to travel from where it is taken to where it lands. */
export const FLIGHT_MS = 500

/** How long after one copy sets off the next one does. */
export const STAGGER_MS = 350

/** How long a step's chip takes to appear. */
export const CHIP_MS = 300

/** How long a landed copy takes to become the value it lands as. */
export const MORPH_MS = 250

/** How long the place a copy was taken from glows, and how long a tile glows on a landing. */
export const GLOW_MS = 600

/** How long the arrow between the versions takes to draw. */
export const ARROW_MS = 300

/** How long one digit takes to roll. */
export const ROLL_MS = 450

/** How long after one digit starts rolling the next one does. */
export const ROLL_STAGGER_MS = 130

/** How long the caret stays after the last character is typed. */
export const CARET_LINGER_MS = 300

/** How long after a step's chip appears its first copy sets off. */
const LEAD_MS = 100

/** How long after the arrow finishes the digits start rolling. */
const ROLL_LEAD_MS = 100

/** How far right the middle of a copy's path must sit to clear the versions when it crosses two rows to the changelog line, at compact size. */
const CHANGELOG_CLEAR = 506

/** How far above the arrow the copy of the bump settles, as a multiple of the version's font size. */
const ARROW_LABEL_LIFT = 0.95

/** Breath after the last thing lands before the frame counts as settled. */
const SETTLE_MS = 300

/** Where a copy is taken from, for the glow it leaves behind. */
export type FlightSource = 'header' | 'field' | 'bump'

/** One copy travelling from where it is taken to where it lands. */
export interface Flight {
  /** The characters the copy carries. */
  text: string
  /** How the characters are coloured. */
  tone: CascadeTone
  /** Where it sets off. */
  from: Point
  /** Where it lands. */
  to: Point
  /** Font size as it sets off. */
  fromPx: number
  /** Font size as it lands. */
  toPx: number
  /** How far right of the straight line its path bows. */
  bow: number
  /** When it sets off. */
  departAt: number
  /** When it lands. */
  arriveAt: number
  /** How long it rests where it landed before it becomes the value there. */
  lingerMs: number
  /** What it is taken from. */
  source: FlightSource
  /** Which header span or field it is taken from. */
  sourceIndex: number
}

/** One stretch of the spine lighting up as a derivation passes down it. */
export interface FillSegment {
  /** Row the lit stretch starts at. */
  fromRow: number
  /** Row it reaches. */
  toRow: number
  /** When it starts moving. */
  startAt: number
  /** When it arrives. */
  endAt: number
}

/** Every moment on the stage's timeline. */
export interface CascadeTimeline {
  /** When the last character of the header is typed. */
  typedAt: number
  /** When each step's chip appears, in step order. */
  chipsAt: readonly number[]
  /** The copies that fall from the header into the fields. */
  parse: readonly Flight[]
  /** The copies that converge on the bump. */
  bump: readonly Flight[]
  /** When the bump's value appears. */
  bumpAt: number
  /** The copy of the bump that drops onto the arrow. */
  increment: Flight
  /** When the arrow starts drawing. */
  arrowAt: number
  /** When each character of the new version starts rolling, or undefined for one that does not change. */
  rollsAt: readonly (number | undefined)[]
  /** The copies that become the changelog tokens, in token order, for the tokens that are copies. */
  changelog: readonly Flight[]
  /** When the tokens that appear in place do so. */
  markerAt: number
  /** The spine lighting up, stretch by stretch. */
  fill: readonly FillSegment[]
  /** When nothing is moving any more. */
  settledAt: number
}

/**
 * The value a landed copy leaves in a field, as coloured there.
 *
 * @param config - The cascade as the scene configured it.
 * @param index - Which field.
 * @returns Its tone, `plain` when the scene gave none.
 */
function fieldTone(config: CascadeConfig, index: number): CascadeTone {
  return config.parse.fields[index]?.tone ?? 'plain'
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * Every flight is a move between two points the layout measured, and every
 * other moment is read off the flights: a tile glows when a copy lands on
 * it, the spine lights as the first copy of a step travels, the digits roll
 * once the copy of the bump has reached the arrow. Nothing is remembered
 * between frames.
 *
 * @param config - The cascade as the scene configured it.
 * @param layout - Where everything sits.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * cascadeTimeline(config, layout, metrics).settledAt
 * ```
 */
export function cascadeTimeline(config: CascadeConfig, layout: CascadeLayout, metrics: CascadeMetrics): CascadeTimeline {
  const characters = config.header.reduce((count, part) => count + part.text.length, 0)
  const typedAt = config.typeAtMs + (characters * 1000) / config.typeCps
  const headerY = layout.rows[0] ?? metrics.rowTopPx
  const parse = config.parse.fields.map((field, index): Flight => {
    const span = layout.header[field.from]
    const tile = layout.fields[index]
    const departAt = config.parse.atMs + LEAD_MS + STAGGER_MS * index
    return {
      text: (span?.text ?? '').trim(),
      tone: config.header[field.from]?.tone ?? 'plain',
      from: { x: (span?.x ?? 0) + (span?.width ?? 0) / 2, y: headerY },
      to: tile?.value ?? { x: 0, y: 0 },
      fromPx: metrics.headerPx,
      toPx: metrics.valuePx,
      bow: 0,
      departAt,
      arriveAt: departAt + FLIGHT_MS,
      lingerMs: 0,
      source: 'header',
      sourceIndex: field.from,
    }
  })
  const bumpDepartAt = config.bump.atMs + LEAD_MS
  const bump = config.bump.from.map(
    (index): Flight => ({
      text: config.parse.fields[index]?.value ?? '',
      tone: fieldTone(config, index),
      from: layout.fields[index]?.value ?? { x: 0, y: 0 },
      to: layout.bump.value,
      fromPx: metrics.valuePx,
      toPx: metrics.valuePx,
      bow: 0,
      departAt: bumpDepartAt,
      arriveAt: bumpDepartAt + FLIGHT_MS,
      lingerMs: 0,
      source: 'field',
      sourceIndex: index,
    })
  )
  const bumpAt = bumpDepartAt + FLIGHT_MS
  const incrementDepartAt = config.increment.atMs + LEAD_MS
  const increment: Flight = {
    text: config.bump.value,
    tone: 'accent',
    from: layout.bump.value,
    // why: the bump settles above the arrow as its label, and stays until the digits it decided start to roll
    to: { x: (layout.version.arrowFrom + layout.version.arrowTo) / 2, y: layout.version.y - metrics.versionPx * ARROW_LABEL_LIFT },
    fromPx: metrics.valuePx,
    toPx: metrics.valuePx,
    bow: 0,
    departAt: incrementDepartAt,
    arriveAt: incrementDepartAt + FLIGHT_MS,
    lingerMs: ARROW_MS + ROLL_LEAD_MS,
    source: 'bump',
    sourceIndex: 0,
  }
  const arrowAt = increment.arriveAt
  let rolling = 0
  const rollsAt = [...config.increment.to].map((character, index): number | undefined => {
    if (character === config.increment.from[index]) {
      return undefined
    }
    const at = arrowAt + ARROW_MS + ROLL_LEAD_MS + ROLL_STAGGER_MS * rolling
    rolling += 1
    return at
  })
  const markerAt = config.changelog.atMs + LEAD_MS
  let copies = 0
  const changelog: Flight[] = []
  config.changelog.tokens.forEach((token, index) => {
    const slot = layout.tokens[index]
    if (token.from === undefined || slot === undefined) {
      return
    }
    const departAt = markerAt + STAGGER_MS * copies
    copies += 1
    const from = layout.fields[token.from]?.value ?? { x: 0, y: 0 }
    // why: a path bows right only as far as it must to clear the versions it crosses, so a copy that already starts clear of them drops straight
    const bow = max(0, CHANGELOG_CLEAR * metrics.scale - (from.x + slot.centre.x) / 2) * 2
    changelog.push({
      text: config.parse.fields[token.from]?.value ?? '',
      tone: token.tone ?? fieldTone(config, token.from),
      from,
      to: slot.centre,
      fromPx: metrics.valuePx,
      toPx: metrics.linePx,
      bow,
      departAt,
      arriveAt: departAt + FLIGHT_MS,
      lingerMs: 0,
      source: 'field',
      sourceIndex: token.from,
    })
  })
  const firstParse = parse[0]
  const firstBump = bump[0]
  const firstChangelog = changelog[0]
  const fill: FillSegment[] = [
    { fromRow: 0, toRow: 1, startAt: firstParse?.departAt ?? config.parse.atMs, endAt: firstParse?.arriveAt ?? config.parse.atMs },
    { fromRow: 1, toRow: 2, startAt: firstBump?.departAt ?? bumpDepartAt, endAt: firstBump?.arriveAt ?? bumpAt },
    { fromRow: 2, toRow: 3, startAt: increment.departAt, endAt: increment.arriveAt },
    { fromRow: 3, toRow: 4, startAt: firstChangelog?.departAt ?? markerAt, endAt: firstChangelog?.arriveAt ?? markerAt },
  ]
  const lastRoll = rollsAt.reduce<number>((latest, at) => (at === undefined ? latest : max(latest, at + ROLL_MS)), 0)
  const lastLanding = changelog.reduce((latest, flight) => max(latest, flight.arriveAt + MORPH_MS), markerAt + MORPH_MS)
  return {
    typedAt,
    chipsAt: [config.parse.atMs, config.bump.atMs, config.increment.atMs, config.changelog.atMs],
    parse,
    bump,
    bumpAt,
    increment,
    arrowAt,
    rollsAt,
    changelog,
    markerAt,
    fill,
    settledAt: max(lastRoll, lastLanding) + SETTLE_MS,
  }
}
