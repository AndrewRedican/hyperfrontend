/**
 * `spine(t, s)` — the one function the whole animation is built on.
 *
 * The koi is never posed by moving vertices. It is posed by bending a curve, and
 * the mesh is carried along by whichever part of that curve it sits on. Every
 * behaviour the koi has is a different way of bending the same curve, which is
 * why a hard turn and a relaxed cruise deform the same body convincingly instead
 * of needing separate animations.
 *
 * The curve is built from *curvature* rather than from displacement, and then
 * integrated. That ordering is what preserves the koi's length: a fish that is
 * bent double is exactly as long as a fish swimming straight, so the body can
 * never stretch, pinch or slide through itself no matter how hard it is driven.
 * The travelling wave's own net heading is subtracted afterwards, so a swimming
 * koi holds its course instead of spiralling with the beat.
 */
import { CAUDAL_ROOT, PIVOT_STATION } from './config.js'

/** How many stations describe one koi from snout to caudal tip. */
export const SPINE_SAMPLES = 32

/** One station of the posed spine. */
export interface SpineStation {
  /** Where along the koi this station sits, 0 at the snout and 1 at the caudal tip. */
  station: number
  /** Model-space centre of the body here. */
  position: [number, number, number]
  /** Local heading in radians; positive swings toward the left flank. */
  yaw: number
  /** Local bank in radians; positive rolls the left flank downward. */
  roll: number
  /** Local nose-up pitch in radians. */
  pitch: number
}

/** The koi's whole posed centreline. */
export interface SpinePose {
  /** Every station, snout first. */
  stations: SpineStation[]
  /** The phase of the tail beat this pose was taken at, in radians. */
  phase: number
}

/** How the spine should bend. Every behaviour reduces to these numbers. */
export interface SwimParameters {
  /** Peak curvature of the travelling wave, in radians per unit station. */
  amplitude: number
  /** How far back the wave begins, 0 at the snout and 1 at the tail. */
  waveStart: number
  /** How sharply the wave's amplitude grows behind its start. */
  waveGrowth: number
  /** How many wavelengths fit along the koi. */
  wavesPerBody: number
  /** How far the tail fin trails the peduncle, in turns of the beat. */
  caudalLag: number
  /** Steady bend from a turn, in radians across the whole body; positive swings the head toward the left flank. */
  turnBend: number
  /** Where the turn's bend is centred along the koi. */
  turnCentre: number
  /** How far the turn's bend is spread along the koi. */
  turnSpread: number
  /** Bank angle in radians; positive rolls the left flank downward. */
  bank: number
  /** How much the body rolls with each tail beat, in radians. */
  rollBeat: number
  /** Nose-up pitch in radians. */
  pitch: number
  /** How far the whole body slides sideways with the beat, as a fraction of length. */
  sway: number
}

/** A koi holding still: straight, level and unbent. */
export const STILL_SWIM: SwimParameters = {
  amplitude: 0,
  waveStart: 0.2,
  waveGrowth: 1.7,
  wavesPerBody: 0.85,
  caudalLag: 0.13,
  turnBend: 0,
  turnCentre: 0.34,
  turnSpread: 0.3,
  bank: 0,
  rollBeat: 0,
  pitch: 0,
  sway: 0,
}

/**
 * How much of a turn's bend lands at a station.
 *
 * @param station - Position along the koi, 0 at the snout.
 * @param centre - Where the bend is centred.
 * @param spread - How far the bend reaches either side of its centre.
 * @returns An unnormalised weight.
 */
function turnWeight(station: number, centre: number, spread: number): number {
  const distance = (station - centre) / spread
  return Math.exp(-distance * distance)
}

/**
 * How much of the travelling wave has grown in by a station.
 *
 * @param station - Position along the koi, 0 at the snout.
 * @param parameters - The swim being evaluated.
 * @returns A weight from 0 ahead of the wave to 1 at the tail.
 */
function waveWeight(station: number, parameters: SwimParameters): number {
  const front = Math.min(0.98, parameters.waveStart)
  const grown = (station - front) / (1 - front)
  return grown <= 0 ? 0 : Math.min(1, grown) ** parameters.waveGrowth
}

/**
 * Poses the koi's spine at one instant.
 *
 * @param length - The koi's nose-to-caudal-tip length in scene units.
 * @param parameters - How the spine should bend.
 * @param phase - Phase of the tail beat in radians; advancing it swims the koi.
 * @returns The posed centreline.
 *
 * @example Freezing a koi mid-beat to inspect its geometry
 * ```typescript
 * const pose = evaluateSpine(physical.length, { ...RELAXED_SWIM, turnBend: 0.9 }, Math.PI / 2)
 * ```
 */
export function evaluateSpine(length: number, parameters: SwimParameters, phase: number): SpinePose {
  const step = 1 / (SPINE_SAMPLES - 1)
  const curvature: number[] = []
  let turnTotal = 0

  for (let index = 0; index < SPINE_SAMPLES; index += 1) {
    turnTotal += turnWeight(index * step, parameters.turnCentre, parameters.turnSpread)
  }

  for (let index = 0; index < SPINE_SAMPLES; index += 1) {
    const station = index * step
    // how: The tail fin is given extra phase lag past the caudal root, so the membrane arrives late and whips through the beat rather than swinging as one board with the peduncle.
    const lag = station <= CAUDAL_ROOT ? 0 : parameters.caudalLag * Math.PI * 2 * ((station - CAUDAL_ROOT) / (1 - CAUDAL_ROOT))
    const swim =
      parameters.amplitude * waveWeight(station, parameters) * Math.sin(phase - station * parameters.wavesPerBody * Math.PI * 2 - lag)
    // why: Yaw accumulates toward the tail, so a bend that should swing the *head* to the left has to enter the integral with the opposite sign.
    const turn =
      turnTotal === 0
        ? 0
        : (-parameters.turnBend * turnWeight(station, parameters.turnCentre, parameters.turnSpread) * SPINE_SAMPLES) / turnTotal
    curvature.push(swim + turn)
  }

  const yaws: number[] = []
  let running = 0
  let yawSum = 0
  for (let index = 0; index < SPINE_SAMPLES; index += 1) {
    running += (curvature[index] ?? 0) * step
    yaws.push(running)
    yawSum += running
  }
  // why: Integrating a wave leaves a standing offset that would swing the koi's whole heading with the beat; removing the mean is what keeps a swimming fish on course.
  const yawMean = yawSum / SPINE_SAMPLES

  const stations: SpineStation[] = Array.from({ length: SPINE_SAMPLES }, (_unused, index) => ({
    station: index * step,
    position: <[number, number, number]>[0, 0, 0],
    yaw: (yaws[index] ?? 0) - yawMean,
    roll:
      parameters.bank +
      parameters.rollBeat *
        waveWeight(index * step, parameters) *
        Math.sin(phase - index * step * parameters.wavesPerBody * Math.PI * 2 + Math.PI * 0.5),
    pitch: parameters.pitch,
  }))

  const pivot = Math.round(PIVOT_STATION * (SPINE_SAMPLES - 1))
  const segment = length * step
  const seed = stations[pivot]
  if (seed !== undefined) {
    // magic: A swimming fish's centre of mass slides a little across the beat; without it the body looks pinned to a rail.
    seed.position = [0, 0, parameters.sway * length * Math.sin(phase - PIVOT_STATION * parameters.wavesPerBody * Math.PI * 2)]
  }

  for (let index = pivot - 1; index >= 0; index -= 1) {
    advance(stations, index, index + 1, segment, parameters.pitch, 1)
  }
  for (let index = pivot + 1; index < SPINE_SAMPLES; index += 1) {
    advance(stations, index, index - 1, segment, parameters.pitch, -1)
  }

  return { stations, phase }
}

/**
 * Steps one station off its neighbour along the shared tangent.
 *
 * @param stations - The stations being posed, in place.
 * @param target - Index to write.
 * @param from - Index to step off.
 * @param segment - Distance between stations in scene units.
 * @param pitch - Nose-up pitch in radians.
 * @param direction - `1` when walking toward the snout, `-1` when walking toward the tail.
 */
function advance(stations: SpineStation[], target: number, from: number, segment: number, pitch: number, direction: 1 | -1): void {
  const here = stations[target]
  const anchor = stations[from]
  if (here === undefined || anchor === undefined) {
    return
  }
  // why: Stepping along the tangent averaged across the pair keeps the chain second-order accurate, which is what stops a hard turn from shortening the koi.
  const yaw = (here.yaw + anchor.yaw) * 0.5
  const cosPitch = Math.cos(pitch)
  here.position = [
    anchor.position[0] + Math.cos(yaw) * cosPitch * segment * direction,
    anchor.position[1] + Math.sin(pitch) * segment * direction,
    anchor.position[2] + Math.sin(yaw) * cosPitch * segment * direction,
  ]
}

/**
 * Reads the spine at an arbitrary station, interpolating between samples.
 *
 * @param pose - The posed spine.
 * @param station - Where along the koi to read, 0 at the snout and 1 at the caudal tip.
 * @returns The interpolated station.
 *
 * @example Hanging a collision capsule off the posed body
 * ```typescript
 * const midships = sampleSpinePose(pose, 0.45)
 * ```
 */
export function sampleSpinePose(pose: SpinePose, station: number): SpineStation {
  const clamped = Math.min(1, Math.max(0, station))
  const scaled = clamped * (SPINE_SAMPLES - 1)
  const index = Math.min(SPINE_SAMPLES - 2, Math.floor(scaled))
  const blend = scaled - index
  const near = pose.stations[index]
  const far = pose.stations[index + 1]
  if (near === undefined || far === undefined) {
    return { station: clamped, position: [0, 0, 0], yaw: 0, roll: 0, pitch: 0 }
  }
  return {
    station: clamped,
    position: [
      near.position[0] + (far.position[0] - near.position[0]) * blend,
      near.position[1] + (far.position[1] - near.position[1]) * blend,
      near.position[2] + (far.position[2] - near.position[2]) * blend,
    ],
    yaw: near.yaw + (far.yaw - near.yaw) * blend,
    roll: near.roll + (far.roll - near.roll) * blend,
    pitch: near.pitch + (far.pitch - near.pitch) * blend,
  }
}
