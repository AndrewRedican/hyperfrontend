/**
 * The koi's build, station by station: the table that decides what it looks like.
 *
 * This is the file to edit when a koi is the wrong shape. Every row is one
 * cross-section along the body — how wide it is, how far it reaches above and
 * below its own axis, and how square or pinched that section is. The mesh
 * generators do nothing but loft these numbers, so a shape change is a number
 * change here rather than an algorithm change anywhere.
 *
 * Rows are interpolated with monotone cubic segments, which means a row never
 * introduces a bulge its neighbours did not ask for. Editing one station moves
 * the body locally and leaves the rest alone.
 */
import type { KoiPhysical } from './config.js'

/** One sampled point on a profile curve. */
interface CurveKnot {
  /** Position along the body, 0 at the snout and 1 at the caudal peduncle's end. */
  s: number
  /** The value the profile takes there. */
  value: number
}

/** A profile curve with its monotone tangents precomputed. */
interface Curve {
  /** The knots, in increasing `s`. */
  knots: readonly CurveKnot[]
  /** One tangent per knot, clamped so no segment overshoots its neighbours. */
  tangents: readonly number[]
}

/**
 * Precomputes the Fritsch–Carlson tangents that keep a profile overshoot-free.
 *
 * @param knots - The profile's knots, in increasing `s`.
 * @returns The curve, ready to sample.
 */
function buildCurve(knots: readonly CurveKnot[]): Curve {
  const slopes: number[] = []
  for (let index = 0; index < knots.length - 1; index += 1) {
    const here = knots[index]
    const next = knots[index + 1]
    slopes.push(here === undefined || next === undefined ? 0 : (next.value - here.value) / (next.s - here.s))
  }
  const tangents = knots.map((_unused, index) => {
    const before = slopes[index - 1]
    const after = slopes[index]
    if (before === undefined) {
      return after ?? 0
    }
    if (after === undefined) {
      return before
    }
    // why: A sign change is a genuine turning point in the profile; flattening it there is what stops the cubic from overshooting into a bulge.
    return before * after <= 0 ? 0 : (before + after) / 2
  })
  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index]
    const left = tangents[index]
    const right = tangents[index + 1]
    if (slope === undefined || left === undefined || right === undefined || slope === 0) {
      continue
    }
    const alpha = left / slope
    const beta = right / slope
    const excess = alpha * alpha + beta * beta
    if (excess > 9) {
      const scale = 3 / Math.sqrt(excess)
      tangents[index] = scale * alpha * slope
      tangents[index + 1] = scale * beta * slope
    }
  }
  return { knots, tangents }
}

/**
 * Reads a profile curve at a position along the body.
 *
 * @param curve - The precomputed curve.
 * @param s - Position along the body, 0 at the snout and 1 at the peduncle's end.
 * @returns The interpolated value, clamped to the curve's ends outside `[0, 1]`.
 */
function sampleCurve(curve: Curve, s: number): number {
  const last = curve.knots.length - 1
  const first = curve.knots[0]
  const final = curve.knots[last]
  if (first === undefined || final === undefined) {
    return 0
  }
  if (s <= first.s) {
    return first.value
  }
  if (s >= final.s) {
    return final.value
  }
  let index = 0
  while (index < last - 1) {
    const next = curve.knots[index + 1]
    if (next === undefined || next.s > s) {
      break
    }
    index += 1
  }
  const here = curve.knots[index]
  const next = curve.knots[index + 1]
  const leftTangent = curve.tangents[index]
  const rightTangent = curve.tangents[index + 1]
  if (here === undefined || next === undefined || leftTangent === undefined || rightTangent === undefined) {
    return final.value
  }
  const span = next.s - here.s
  const t = (s - here.s) / span
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * here.value +
    (t3 - 2 * t2 + t) * span * leftTangent +
    (-2 * t3 + 3 * t2) * next.value +
    (t3 - t2) * span * rightTangent
  )
}

/**
 * Builds a profile curve from paired arrays.
 *
 * @param stations - Positions along the body, increasing.
 * @param values - The value at each station.
 * @returns The curve.
 */
function profile(stations: readonly number[], values: readonly number[]): Curve {
  return buildCurve(stations.map((s, index) => ({ s, value: values[index] ?? 0 })))
}

/** The stations every profile below is sampled at, snout to peduncle end. */
const STATIONS = [0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.33, 0.42, 0.52, 0.63, 0.74, 0.84, 0.92, 1]

/** Lateral half-width at each station, as a fraction of body length. */
const HALF_WIDTH = profile(STATIONS, [0.016, 0.034, 0.05, 0.064, 0.078, 0.09, 0.097, 0.096, 0.089, 0.076, 0.058, 0.041, 0.031, 0.026])

/** Dorsal half-height above the section's own axis, as a fraction of body length. */
const TOP = profile(STATIONS, [0.013, 0.033, 0.052, 0.067, 0.082, 0.096, 0.111, 0.117, 0.113, 0.102, 0.086, 0.069, 0.057, 0.05])

/** Ventral half-depth below the section's own axis, as a fraction of body length. */
const BOTTOM = profile(STATIONS, [0.015, 0.037, 0.05, 0.059, 0.069, 0.08, 0.091, 0.094, 0.089, 0.079, 0.065, 0.051, 0.042, 0.037])

/** Superellipse exponent for the upper half; above 2 flattens the back, below 2 peaks it. */
const CORNER_TOP = profile(STATIONS, [2, 2.2, 2.45, 2.62, 2.7, 2.52, 2.32, 2.2, 2.12, 2.02, 1.92, 1.82, 1.72, 1.62])

/** Superellipse exponent for the lower half. */
const CORNER_BOTTOM = profile(STATIONS, [2, 2.1, 2.25, 2.34, 2.36, 2.3, 2.22, 2.16, 2.1, 2.02, 1.94, 1.84, 1.74, 1.64])

/** How far the section's own axis rides above the model axis, as a fraction of body length. */
const RISE = profile(STATIONS, [-0.005, -0.005, -0.003, 0, 0.002, 0.004, 0.006, 0.006, 0.005, 0.003, 0.001, -0.001, -0.003, -0.005])

/** One cross-section of the koi's body, in body-length units. */
export interface KoiSection {
  /** Lateral half-width. */
  halfWidth: number
  /** How far the section reaches above its own axis. */
  top: number
  /** How far the section reaches below its own axis. */
  bottom: number
  /** Superellipse exponent governing the upper half's flatness. */
  cornerTop: number
  /** Superellipse exponent governing the lower half's flatness. */
  cornerBottom: number
  /** How far the section's axis rides above the model axis. */
  rise: number
  /** How strongly a ridge stands proud along the dorsal midline, 0 to 1. */
  ridge: number
}

/**
 * A bell centred on a station, used to apply a knob to one region of the body.
 *
 * @param s - Position along the body.
 * @param centre - Where the region is centred.
 * @param spread - How far the region reaches either side.
 * @returns A weight from 0 outside the region to 1 at its centre.
 */
function region(s: number, centre: number, spread: number): number {
  const distance = (s - centre) / spread
  return Math.exp(-distance * distance)
}

/**
 * Reads the koi's cross-section at a position along its body.
 *
 * @param physical - The koi's build; its multipliers are applied here.
 * @param s - Position along the body, 0 at the snout and 1 at the peduncle's end.
 * @returns The section, in body-length units.
 *
 * @example Lofting a ring
 * ```typescript
 * const section = sampleSection(physical, ring / (rings - 1))
 * const point = sectionPoint(section, theta)
 * ```
 */
export function sampleSection(physical: KoiPhysical, s: number): KoiSection {
  const { head } = physical
  // why: The head's own knobs must fade out where the head ends, or widening the face also widens the shoulders.
  const headWeight = s >= head.length ? 0 : Math.cos((s / head.length) * Math.PI * 0.5) ** 2
  const shoulderWeight = region(s, 0.31, 0.15)
  // why: The peduncle knobs reach forward far enough to blend, so a thinner tail base does not leave a step at the tail.
  const peduncleWeight = s <= 0.62 ? 0 : Math.sin(((s - 0.62) / 0.38) * Math.PI * 0.5) ** 2
  const snoutWeight = s >= 0.09 ? 0 : Math.cos((s / 0.09) * Math.PI * 0.5) ** 2

  const widthScale =
    physical.width *
    (1 + headWeight * (head.width - 1)) *
    (1 + shoulderWeight * (physical.shoulder - 1)) *
    (1 + peduncleWeight * (physical.peduncleWidth - 1))
  const heightScale = physical.height * (1 + headWeight * (head.height - 1)) * (1 + peduncleWeight * (physical.peduncleDepth - 1))

  // magic: A blunt snout is a koi's most recognisable feature from above; the knob adds width and depth to the first tenth of the body without touching the cheeks.
  const snoutSwell = 1 + snoutWeight * head.snout * 0.85

  return {
    halfWidth: sampleCurve(HALF_WIDTH, s) * widthScale * snoutSwell,
    // magic: The forehead knob domes the skull between the eyes, which is the difference between a face and a wedge.
    top: sampleCurve(TOP, s) * heightScale * (1 + region(s, 0.13, 0.09) * head.forehead * 0.22),
    bottom: sampleCurve(BOTTOM, s) * heightScale * (1 + region(s, 0.42, 0.2) * physical.belly * 0.3) * snoutSwell,
    cornerTop: sampleCurve(CORNER_TOP, s),
    // magic: A fuller belly is a rounder belly, not just a deeper one, so the exponent rises with the depth.
    cornerBottom: sampleCurve(CORNER_BOTTOM, s) * (1 + region(s, 0.42, 0.22) * physical.belly * 0.16),
    rise: sampleCurve(RISE, s),
    // why: The ridge fades out over the head, where a koi's back is flat, and again at the peduncle, where the whole section is already a blade.
    ridge: physical.dorsalRidge * Math.min(1, Math.max(0, (s - 0.16) / 0.2)) * (1 - peduncleWeight * 0.55),
  }
}

/**
 * Walks the outline of one cross-section.
 *
 * The section is a superellipse whose upper and lower halves carry their own
 * exponent, so one station can be flat-backed and round-bellied at once. That is
 * what keeps the koi from reading as a tube: the head is a broad flattened
 * wedge, the midships a dorsally weighted oval, and the peduncle a blade.
 *
 * @param section - The section to walk, from {@link sampleSection}.
 * @param theta - Position around the section in turns: 0 is the dorsal midline, 0.25 the left flank, 0.5 the belly.
 * @returns The offset from the model axis, in body-length units.
 *
 * @example Lofting one ring of the body
 * ```typescript
 * const section = sampleSection(physical, s)
 * const ring = Array.from({ length: 24 }, (_unused, j) => sectionPoint(section, j / 24))
 * ```
 */
export function sectionPoint(section: KoiSection, theta: number): { y: number; z: number } {
  const angle = theta * Math.PI * 2
  const cy = Math.cos(angle)
  const cz = Math.sin(angle)
  const upper = cy >= 0
  const reach = upper ? section.top : section.bottom
  const power = 2 / (upper ? section.cornerTop : section.cornerBottom)
  // magic: A high power concentrated at the dorsal midline lifts a narrow keel without disturbing the flanks, which is the ridge you see running down a koi's back.
  const keel = section.ridge * section.top * 0.2 * Math.max(cy, 0) ** 8
  return {
    y: section.rise + Math.sign(cy) * reach * Math.abs(cy) ** power + keel,
    z: Math.sign(cz) * section.halfWidth * Math.abs(cz) ** power,
  }
}
