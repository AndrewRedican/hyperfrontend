import type { MediaProfile } from '../models/profile'
import { hypot, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** How many samples a leg's curve is measured over when its length is estimated. */
const LENGTH_SAMPLES = 24

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, in CSS pixels. */
export interface Box {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  width: number
  /** Height. */
  height: number
}

/** One cubic curve of a route. */
export interface Leg {
  /** Where the leg starts. */
  from: Point
  /** First control point. */
  control1: Point
  /** Second control point. */
  control2: Point
  /** Where the leg ends. */
  to: Point
  /** How long the leg is, in pixels, so the legs of a route share its time by length. */
  length: number
}

/**
 * A path something travels: one or more curves joined end to end.
 *
 * A route with more than one leg is what lets a flight turn a corner: a
 * question from the lower row slides sideways into the channel between the
 * columns before it rises, so it never crosses the answer landed above it.
 */
export interface Route {
  /** The legs, in order. */
  legs: readonly Leg[]
  /** The whole route's length, in pixels. */
  length: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface VaultMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Width of a built-in's tile on the shelf. */
  tileWidthPx: number
  /** Height of a tile. */
  tileHeightPx: number
  /** Font size of the API chips and the shelf tiles' names. */
  chipPx: number
  /** Font size of the asker's value, the answers and the intruder's name. */
  monoPx: number
  /** Font size of the small labels: the shelf's name, the subpaths, the replacements. */
  smallPx: number
  /** Height of the vault's lid. */
  lidHeightPx: number
  /** Size of the lock on the lid. */
  lockPx: number
  /** Size of the package mark watermarked inside the vault. */
  watermarkPx: number
  /** Height of an answer pill. */
  pillHeightPx: number
  /** Height of an empty answer slot. */
  slotHeightPx: number
  /** Radius of a question dot. */
  dotPx: number
  /** Stroke width of the intruder's bolt. */
  boltPx: number
  /** Size of the intruder's script icon. */
  iconPx: number
  /** Size of the pictograms that mark the asker's columns. */
  pictogramPx: number
}

/** Where one built-in's actors sit, and the routes between them. */
export interface PairLayout {
  /** Where the built-in's tile sits on the shelf. */
  tile: Box
  /** Centre of the tile. */
  tileCentre: Point
  /** Centre of the copy's chip inside the vault. */
  chip: Point
  /** Vertical centre of the subpath written under the chip. */
  subpathY: number
  /** The slot the shelf's answer lands in. */
  shelfSlot: Box
  /** The slot the copy's answer lands in. */
  vaultSlot: Box
  /** The route a copy takes off the shelf into the vault. */
  fall: Route
  /** The route the intruder's bolt takes to the tile. */
  bolt: Route
  /** The route a question takes from the shelf slot to the foot of the tile; its answer comes back the same way. */
  shelfRoute: Route
  /** The route a question takes from the vault slot to the slot in the lid; its answer comes back the same way. */
  vaultRoute: Route
}

/** Where everything sits, measured once for the profile. */
export interface VaultLayout {
  /** The globals shelf across the top. */
  shelf: Box
  /** Left-centre of the shelf's name. */
  shelfLabel: Point
  /** The vault. */
  vault: Box
  /** The lid, at its closed size. */
  lid: Box
  /** How wide the lid is while it is open, retracted to the vault's left. */
  lidOpenWidth: number
  /** Centre of the slot in the lid a question is posted through. */
  lidSlot: Point
  /** Centre of the lock that appears once the lid is shut. */
  lock: Point
  /** Where the intruder comes to rest, over the shelf's right end. */
  intruder: Box
  /** Where the intruder's left edge is before it slides in: past the frame's right edge. */
  intruderStartX: number
  /** The asker's card. */
  asker: Box
  /** The field the asker's value is written in. */
  valueField: Box
  /** Centre of the pictogram at the outer corner of the shelf column. */
  shelfPictogram: Point
  /** Centre of the pictogram at the outer corner of the vault column. */
  vaultPictogram: Point
  /** The band drawn under the vault column once every copy has answered. */
  band: Box
  /** Each built-in's actors, in the scene's order. */
  pairs: readonly PairLayout[]
}

/**
 * A point on a cubic curve.
 *
 * @param p0 - Start.
 * @param p1 - First control point.
 * @param p2 - Second control point.
 * @param p3 - End.
 * @param t - Position along the curve from 0 to 1.
 * @returns The point at `t`.
 * @example The middle of a curve
 * ```ts
 * cubicAt(p0, p1, p2, p3, 0.5)
 * ```
 */
export function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/**
 * Where something is when it has travelled part of a route.
 *
 * Progress is shared out between the legs by their length, so a flight moves
 * at one speed across a corner rather than slowing on the short leg.
 *
 * @param route - The path being travelled.
 * @param t - Progress along it from 0 to 1.
 * @returns The point on the route.
 * @example Half way along a route
 * ```ts
 * routeAt(route, 0.5)
 * ```
 */
export function routeAt(route: Route, t: number): Point {
  const last = route.legs[route.legs.length - 1]
  if (last === undefined) {
    return { x: 0, y: 0 }
  }
  let remaining = max(0, t) * route.length
  for (const leg of route.legs) {
    if (remaining <= leg.length || leg === last) {
      const share = leg.length <= 0 ? 1 : min(1, remaining / leg.length)
      return cubicAt(leg.from, leg.control1, leg.control2, leg.to, share)
    }
    remaining -= leg.length
  }
  return last.to
}

/**
 * Build one curved leg, measuring it.
 *
 * @param from - Where it starts.
 * @param control1 - First control point.
 * @param control2 - Second control point.
 * @param to - Where it ends.
 * @returns The leg, with its length estimated by sampling.
 */
function curve(from: Point, control1: Point, control2: Point, to: Point): Leg {
  let length = 0
  let previous = from
  for (let index = 1; index <= LENGTH_SAMPLES; index += 1) {
    const point = cubicAt(from, control1, control2, to, index / LENGTH_SAMPLES)
    length += hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }
  return { from, control1, control2, to, length }
}

/**
 * Build one straight leg.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @returns A leg whose control points sit on its two ends.
 */
function straight(from: Point, to: Point): Leg {
  return { from, control1: from, control2: to, to, length: hypot(to.x - from.x, to.y - from.y) }
}

/**
 * Join legs into a route.
 *
 * @param legs - Curves and straight pieces in travelling order; each is expected to start where the one before ends.
 * @returns The pieces joined, with their total length.
 */
function makeRoute(...legs: readonly Leg[]): Route {
  return { legs, length: legs.reduce((total, leg) => total + leg.length, 0) }
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's tile height
 * ```ts
 * vaultMetrics(resolveProfile('compact')).tileHeightPx // 44
 * ```
 */
export function vaultMetrics(profile: MediaProfile): VaultMetrics {
  const unit = profile.width / DESIGN_WIDTH
  return {
    insetPx: round(20 * unit),
    tileWidthPx: round(118 * unit),
    tileHeightPx: round(44 * unit),
    chipPx: round(12 * unit),
    monoPx: round(12 * unit),
    smallPx: round(11 * unit),
    lidHeightPx: round(16 * unit),
    lockPx: round(14 * unit),
    watermarkPx: round(120 * unit),
    pillHeightPx: round(24 * unit),
    slotHeightPx: round(34 * unit),
    dotPx: round(5 * unit),
    boltPx: round(3 * unit),
    iconPx: round(20 * unit),
    pictogramPx: round(18 * unit),
  }
}

/** The fixed actors one built-in's layout is worked out against. */
interface Surroundings {
  /** The shelf the tile stands on. */
  shelf: Box
  /** The vault the copy falls into. */
  vault: Box
  /** The slot in the lid a question is posted through. */
  lidSlot: Point
  /** Where the intruder rests. */
  intruder: Box
  /** The asker's card. */
  asker: Box
  /** Horizontal centre of the channel between the two answer columns. */
  channelX: number
  /** Horizontal centre of the column the chips stack in, left of the vault's middle. */
  chipX: number
  /** Horizontal centre of the channel down the vault's right side a later copy drops through. */
  dropX: number
}

/**
 * Lay one built-in's actors out and draw the routes between them.
 *
 * @param index - Which built-in, in the scene's order.
 * @param metrics - The measurements this profile is drawn at.
 * @param unit - How many CSS pixels one design pixel is.
 * @param around - The fixed actors the routes run between.
 * @returns Where the built-in's tile, chip and slots sit, and the routes between them.
 */
function pairLayout(index: number, metrics: VaultMetrics, unit: number, around: Surroundings): PairLayout {
  const px = (value: number): number => round(value * unit)
  const { shelf, vault, lidSlot, intruder, asker, channelX, chipX, dropX } = around
  const tileCentre = { x: px(206 + 138 * index), y: shelf.y + shelf.height / 2 }
  const tile = {
    x: tileCentre.x - metrics.tileWidthPx / 2,
    y: tileCentre.y - metrics.tileHeightPx / 2,
    width: metrics.tileWidthPx,
    height: metrics.tileHeightPx,
  }
  const chip = { x: chipX, y: vault.y + px(46) + index * px(58) }
  const rowTop = asker.y + px(28) + index * px(44)
  const shelfSlot = { x: asker.x + px(14), y: rowTop, width: px(90), height: metrics.slotHeightPx }
  const vaultSlot = { x: asker.x + px(152), y: rowTop, width: px(140), height: metrics.slotHeightPx }
  const shelfStart = { x: shelfSlot.x + shelfSlot.width / 2, y: rowTop + metrics.slotHeightPx / 2 }
  const vaultStart = { x: vaultSlot.x + vaultSlot.width / 2, y: rowTop + metrics.slotHeightPx / 2 }
  // why: the first copy falls into an empty vault and goes straight to its place; a later copy drops down the channel at the vault's right, clear of the chips already stacked, and swings in under the last of them
  const fall =
    index === 0
      ? makeRoute(curve(tileCentre, { x: tileCentre.x - px(10), y: px(135) }, { x: chip.x + px(46), y: px(160) }, chip))
      : makeRoute(
          curve(tileCentre, { x: tileCentre.x - px(10), y: px(130) }, { x: dropX + px(10), y: px(128) }, { x: dropX, y: vault.y + px(14) }),
          curve(
            { x: dropX, y: vault.y + px(14) },
            { x: dropX + px(4), y: chip.y - px(18) },
            { x: dropX - px(14), y: chip.y + px(12) },
            chip
          )
        )
  const bolt = makeRoute(
    curve(
      { x: intruder.x, y: intruder.y + intruder.height / 2 },
      { x: intruder.x - px(20), y: px(26) },
      { x: tileCentre.x + px(30), y: px(18) },
      { x: tileCentre.x, y: tile.y }
    )
  )
  // why: a shelf question leaves its slot to the left, up the card's margin and through the gap beside the vault, so a lower-row question never crosses the answer already landed above it
  // why: it ends at the tile's lower edge rather than its centre, so the answer that comes back out starts under the name instead of over it
  const shelfRoute = makeRoute(
    curve(
      shelfStart,
      { x: shelfStart.x - px(90), y: shelfStart.y - px(8) },
      { x: max(tileCentre.x, vault.x + vault.width + px(40)), y: px(130) },
      { x: tileCentre.x, y: tile.y + tile.height + px(4) }
    )
  )
  // why: the top row has nothing above it, so its question arcs straight over the card; a lower row slides into the channel between the columns first and rises where no answer ever sits
  const vaultRoute =
    index === 0
      ? makeRoute(curve(vaultStart, { x: vaultStart.x - px(70), y: px(112) }, { x: px(300), y: px(98) }, lidSlot))
      : makeRoute(
          straight(vaultStart, { x: channelX, y: vaultStart.y }),
          curve({ x: channelX, y: vaultStart.y }, { x: channelX, y: px(100) }, { x: px(330), y: px(90) }, lidSlot)
        )
  return { tile, tileCentre, chip, subpathY: chip.y + px(24), shelfSlot, vaultSlot, fall, bolt, shelfRoute, vaultRoute }
}

/**
 * Lay the composition out across the frame.
 *
 * The shelf runs along the top, the vault sits bottom left and the asker
 * bottom right, with a clear corridor between the shelf and the two cards
 * that every question and answer travels along.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param profile - The presentation target being composed for.
 * @param pairCount - How many built-ins the scene copies.
 * @returns Where everything sits.
 * @example Where the first chip sits
 * ```ts
 * vaultLayout(vaultMetrics(profile), profile, 2).pairs[0]?.chip
 * ```
 */
export function vaultLayout(metrics: VaultMetrics, profile: MediaProfile, pairCount: number): VaultLayout {
  const unit = profile.width / DESIGN_WIDTH
  const px = (value: number): number => round(value * unit)
  const shelf = { x: px(40), y: px(44), width: px(560), height: px(62) }
  const vault = { x: px(40), y: px(176), width: px(220), height: px(154) }
  const lid = { x: vault.x - px(4), y: vault.y - px(8), width: vault.width + px(8), height: metrics.lidHeightPx }
  const chipX = vault.x + px(74)
  const lidSlot = { x: chipX, y: lid.y + lid.height / 2 }
  const intruder = { x: px(470), y: px(40), width: px(120), height: px(72) }
  const asker = { x: px(300), y: px(150), width: px(306), height: px(180) }
  const around: Surroundings = {
    shelf,
    vault,
    lidSlot,
    intruder,
    asker,
    channelX: asker.x + px(128),
    chipX,
    dropX: vault.x + vault.width - px(34),
  }
  const pairs: PairLayout[] = []
  for (let index = 0; index < pairCount; index += 1) {
    pairs.push(pairLayout(index, metrics, unit, around))
  }
  const firstRow = pairs[0]?.vaultSlot
  const lastRow = pairs[pairs.length - 1]?.vaultSlot
  const bandTop = (firstRow?.y ?? asker.y) - px(4)
  const bandBottom = (lastRow === undefined ? asker.y : lastRow.y + lastRow.height) + px(4)
  return {
    shelf,
    shelfLabel: { x: shelf.x + px(14), y: shelf.y + shelf.height / 2 },
    vault,
    lid,
    lidOpenWidth: px(60),
    lidSlot,
    lock: { x: vault.x + vault.width - px(20), y: lid.y + lid.height / 2 },
    intruder,
    intruderStartX: profile.width + px(12),
    asker,
    valueField: { x: asker.x + px(14), y: asker.y + px(124), width: asker.width - px(28), height: px(32) },
    shelfPictogram: { x: asker.x + px(24), y: asker.y + px(12) },
    vaultPictogram: { x: asker.x + asker.width - px(24), y: asker.y + px(12) },
    band: { x: asker.x + px(148), y: bandTop, width: px(148), height: bandBottom - bandTop },
    pairs,
  }
}
