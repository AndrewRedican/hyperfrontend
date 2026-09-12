import type { LanesConfig } from '../models/lanes'
import type { MediaProfile } from '../models/profile'
import { cos, min, PI, round, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** Where the bypass arc starts, in degrees: straight up from the box. */
const ARC_FROM_DEG = -90

/** How far the bypass arc sweeps, in degrees: clockwise round the right side to straight down. */
const ARC_SWEEP_DEG = 180

/** How the frame is sized for the surface it is being drawn for. */
export interface LanesMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Width of the column the switch stands in, at the left edge. */
  toggleColPx: number
  /** Width of the plain lane, which carries no wrapper and a short name. */
  plainLanePx: number
  /** Width of a wrapped lane. */
  lanePx: number
  /** Vertical centre of the lane names. */
  headYPx: number
  /** Height of the band the lane names sit in. */
  headHPx: number
  /** Where a lane's rail starts. */
  railTopPx: number
  /** Where a lane's rail ends, just above the tray. */
  railBottomPx: number
  /** Vertical centre of a token the moment it appears. */
  spawnYPx: number
  /** Vertical centre of the gate bar, and of the bar that seals a dead lane. */
  gateYPx: number
  /** Vertical centre of the function box. */
  boxYPx: number
  /** Width of the function box. */
  boxWPx: number
  /** Height of the function box. */
  boxHPx: number
  /** Radius of the cache ring round the box. */
  ringRPx: number
  /** Radius of the shield arcs round the box. */
  shieldRPx: number
  /** Radius of the stored-value badge inside the ring. */
  badgeRPx: number
  /** Radius of a token. */
  tokenRPx: number
  /** Top edge of the tray. */
  trayTopPx: number
  /** Bottom edge of the tray. */
  trayBottomPx: number
  /** Vertical centre of the values in the tray. */
  trayYPx: number
  /** Width of the tray in a wrapped lane; a narrower lane gets a narrower tray. */
  trayWPx: number
  /** Distance between two neighbouring slots in the tray. */
  slotPitchPx: number
  /** Length of the gate bar. */
  gateLenPx: number
  /** How far left of the lane's centre the gate's hinge sits. */
  gateHingePx: number
  /** How far a burst reaches from the box when nothing stops it. */
  burstReachPx: number
  /** Width of the switch's pill. */
  pillWPx: number
  /** Height of the switch's pill. */
  pillHPx: number
  /** Font size of the lane names. */
  chipPx: number
  /** Font size of the function's name in the box. */
  labelPx: number
  /** Font size of the argument on a token and of a value in the tray. */
  valuePx: number
  /** Font size of the long value and of the switch's name. */
  smallPx: number
}

/** Where one lane sits across the frame. */
export interface LaneGeometry {
  /** Left edge. */
  left: number
  /** Width. */
  width: number
  /** Horizontal centre, where the rail, the box and the tokens are. */
  cx: number
  /** Width of the tray. */
  trayW: number
  /** Horizontal centre of each call's slot in the tray, index for index with the calls. */
  slots: readonly number[]
}

/** Everything that is measured once for a frame. */
export interface LanesLayout {
  /** Horizontal centre of the switch. */
  toggleX: number
  /** Where each lane sits, index for index with the config's lanes. */
  lanes: readonly LaneGeometry[]
  /** Radius of the arc a bypassed token rides round the box: outside the ring, touching it. */
  arcR: number
  /** Where the stored-value badge sits, relative to the box's centre. */
  badgeDx: number
  /** Where the stored-value badge sits, relative to the box's centre. */
  badgeDy: number
  /** How far along the bypass arc, from 0 to 1, a token passes the badge. */
  badgeT: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * Everything scales with the profile's width, so the wide profile gets the
 * same composition at a larger size rather than the same size with more room
 * around it.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's token radius
 * ```ts
 * lanesMetrics(resolveProfile('compact')).tokenRPx // 11
 * ```
 */
export function lanesMetrics(profile: MediaProfile): LanesMetrics {
  const unit = profile.width / DESIGN_WIDTH
  return {
    insetPx: round(18 * unit),
    toggleColPx: round(42 * unit),
    plainLanePx: round(98 * unit),
    lanePx: round(156 * unit),
    headYPx: round(46 * unit),
    headHPx: round(38 * unit),
    railTopPx: round(74 * unit),
    railBottomPx: round(298 * unit),
    spawnYPx: round(84 * unit),
    gateYPx: round(146 * unit),
    boxYPx: round(206 * unit),
    boxWPx: round(60 * unit),
    boxHPx: round(34 * unit),
    ringRPx: round(48 * unit),
    shieldRPx: round(46 * unit),
    badgeRPx: round(9 * unit),
    tokenRPx: round(11 * unit),
    trayTopPx: round(302 * unit),
    trayBottomPx: round(328 * unit),
    trayYPx: round(315 * unit),
    trayWPx: round(116 * unit),
    slotPitchPx: round(40 * unit),
    gateLenPx: round(72 * unit),
    gateHingePx: round(44 * unit),
    burstReachPx: round(66 * unit),
    pillWPx: round(16 * unit),
    pillHPx: round(28 * unit),
    chipPx: round(11 * unit),
    labelPx: round(12 * unit),
    valuePx: round(12 * unit),
    smallPx: round(11 * unit),
  }
}

/**
 * Where a point on the bypass arc is, relative to the box's centre.
 *
 * @param radius - How far from the box's centre the arc runs.
 * @param t - Position along the arc from 0 (straight above the box) to 1 (straight below it).
 * @returns How far right and how far down the point is from the box's centre.
 * @example The point half way round, level with the box on its right
 * ```ts
 * alongArc(59, 0.5) // { dx: 59, dy: 0 }
 * ```
 */
export function alongArc(radius: number, t: number): ArcPoint {
  const angle = ((ARC_FROM_DEG + ARC_SWEEP_DEG * t) * PI) / 180
  return { dx: radius * cos(angle), dy: radius * sin(angle) }
}

/** An offset from the box's centre. */
export interface ArcPoint {
  /** Horizontal offset. */
  dx: number
  /** Vertical offset. */
  dy: number
}

/**
 * Lay the lanes out across the frame.
 *
 * The switch takes a column at the left, the plain lane is narrower than the
 * wrapped ones because it carries neither a wrapper nor a long name, and the
 * wrapped lanes share what is left equally. Each tray's slots are spaced so
 * that the same call lands at the same offset in every lane.
 *
 * @param config - The lanes as the scene configured them.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Where everything sits.
 * @example The centre of the second lane in the compact profile
 * ```ts
 * lanesLayout(config, lanesMetrics(profile)).lanes[1]?.cx
 * ```
 */
export function lanesLayout(config: LanesConfig, metrics: LanesMetrics): LanesLayout {
  const calls = config.calls.length
  let left = metrics.insetPx + metrics.toggleColPx
  const lanes = config.lanes.map((lane) => {
    const width = lane.kind === 'plain' ? metrics.plainLanePx : metrics.lanePx
    const cx = left + width / 2
    const trayW = min(metrics.trayWPx, width - round(metrics.insetPx * 0.4))
    // why: a narrow lane packs its slots closer so the last value still sits inside its tray
    const pitch = calls > 1 ? min(metrics.slotPitchPx, (trayW - metrics.tokenRPx * 2) / (calls - 1)) : 0
    const slots: number[] = []
    for (let index = 0; index < calls; index += 1) {
      slots.push(cx + (index - (calls - 1) / 2) * pitch)
    }
    const geometry: LaneGeometry = { left, width, cx, trayW, slots }
    left += width
    return geometry
  })
  // magic: 40 degrees up from the box's right, at 0.83 of the ring's radius, is the pocket between the box's rounded corner and the ring
  const badgeAngle = (-40 * PI) / 180
  const badgeRadius = metrics.ringRPx * 0.83
  return {
    toggleX: metrics.insetPx + metrics.toggleColPx / 2,
    lanes,
    arcR: metrics.ringRPx + metrics.tokenRPx,
    badgeDx: badgeRadius * cos(badgeAngle),
    badgeDy: badgeRadius * sin(badgeAngle),
    badgeT: (-40 - ARC_FROM_DEG) / ARC_SWEEP_DEG,
  }
}
