/**
 * The koi's spine: a following chain that gives the body its swim.
 *
 * The nose is driven by the motion loop; every joint behind it is pulled to a
 * fixed distance from the joint ahead. That single constraint is what makes the
 * head lead and the tail lag through a turn — the body bends because it is
 * catching up, not because anything told it to bend.
 *
 * On top of the chain sits the undulation: a travelling lateral wave whose
 * amplitude grows toward the tail and whose frequency rides the koi's speed.
 * The four behavioural phases differ only in how hard and how fast that wave
 * runs, which is enough to read them apart from across the pond.
 */
import type { KoiPhase, Vec2 } from '../model/types.js'

/** How many joints describe one koi's centreline, nose to tail. */
export const SPINE_JOINTS = 12

/** Undulation amplitude as a fraction of body length, per behavioural phase. */
const PHASE_AMPLITUDE: Readonly<Record<KoiPhase, number>> = {
  relaxed: 0.05,
  turning: 0.075,
  escape: 0.125,
  'depth-transition': 0.062,
}

/** Tail-beat frequency in hertz at rest, per behavioural phase. */
const PHASE_FREQUENCY: Readonly<Record<KoiPhase, number>> = {
  relaxed: 0.85,
  turning: 1.15,
  escape: 3.1,
  'depth-transition': 1,
}

/** How many wavelengths of the undulation fit along the body. */
const WAVES_PER_BODY = 0.85

/** How sharply the undulation amplitude grows from nose to tail. */
const AMPLITUDE_FALLOFF = 1.7

/** Extra tail-beat frequency per body length per second of speed. */
const SPEED_TO_FREQUENCY = 0.55

/** How much reduced motion damps amplitude and frequency alike. */
const REDUCED_MOTION_DAMPING = 0.4

/** One koi's centreline. */
export interface SpineState {
  /** Joint positions in pond space, nose first, with the undulation laid over them — what a renderer draws and an outline reports. */
  joints: Vec2[]
  /**
   * The chain the follow constraint actually runs on, before the undulation.
   *
   * Kept apart from {@link SpineState.joints} deliberately: feeding displaced
   * joints back into the constraint makes each frame's swing the next frame's
   * starting point, and the body wags itself apart within a few seconds.
   */
  centreline: Vec2[]
  /** Phase of the travelling undulation, in radians. */
  wavePhase: number
}

/** Everything the spine needs to advance one frame. */
export interface SpineStep {
  /** Where the nose has moved to. */
  nose: Vec2
  /** Nose-to-tail length in CSS pixels. */
  length: number
  /** Speed along the heading in pixels per second. */
  speed: number
  /** The behavioural state driving the undulation. */
  phase: KoiPhase
  /** Seconds since the previous step. */
  dt: number
  /** Whether the visitor asked for reduced motion. */
  reducedMotion: boolean
}

/**
 * Lays a straight spine out behind a nose.
 *
 * @param nose - Nose position in pond space.
 * @param heading - Heading in radians; the body lays out opposite it.
 * @param length - Nose-to-tail length in CSS pixels.
 * @returns A settled spine.
 *
 * @example Placing a koi at boot
 * ```typescript
 * const spine = createSpine({ x: 320, y: 180 }, Math.PI / 4, 140)
 * ```
 */
export function createSpine(nose: Vec2, heading: number, length: number): SpineState {
  const link = length / (SPINE_JOINTS - 1)
  const backX = -Math.cos(heading) * link
  const backY = -Math.sin(heading) * link
  const laid = Array.from({ length: SPINE_JOINTS }, (_unused, index) => ({
    x: nose.x + backX * index,
    y: nose.y + backY * index,
  }))
  return { joints: laid, centreline: laid.map((joint) => ({ ...joint })), wavePhase: 0 }
}

/**
 * Reads the direction from one joint to the next, falling back to a heading.
 *
 * @param ahead - The joint nearer the nose.
 * @param behind - The joint nearer the tail.
 * @returns A unit vector pointing from `behind` toward `ahead`.
 */
function directionBetween(ahead: Vec2, behind: Vec2): Vec2 {
  const dx = ahead.x - behind.x
  const dy = ahead.y - behind.y
  const magnitude = Math.hypot(dx, dy)
  // why: Two joints can land on top of each other when a koi reverses hard; keeping the previous shape beats emitting NaN through the whole body.
  if (magnitude === 0) {
    return { x: 1, y: 0 }
  }
  return { x: dx / magnitude, y: dy / magnitude }
}

/**
 * Advances the spine one frame: the chain follows the nose, then undulates.
 *
 * @param state - The koi's current spine.
 * @param step - Where the nose went and how the body should read.
 * @returns The advanced spine.
 *
 * @example Driving the body from the motion loop
 * ```typescript
 * spine = advanceSpine(spine, { nose, length, speed, phase, dt, reducedMotion })
 * ```
 */
export function advanceSpine(state: SpineState, step: SpineStep): SpineState {
  const link = step.length / (SPINE_JOINTS - 1)
  const damping = step.reducedMotion ? REDUCED_MOTION_DAMPING : 1

  // how: Follow-the-leader — each joint is pulled onto the circle of radius `link` around the joint ahead, so the body trails the head through every turn.
  const chain: Vec2[] = [{ x: step.nose.x, y: step.nose.y }]
  for (let index = 1; index < SPINE_JOINTS; index += 1) {
    const ahead = chain[index - 1] ?? step.nose
    const previous = state.centreline[index] ?? ahead
    const direction = directionBetween(previous, ahead)
    chain.push({ x: ahead.x + direction.x * link, y: ahead.y + direction.y * link })
  }

  const bodyLengthsPerSecond = step.length === 0 ? 0 : step.speed / step.length
  const frequency = (PHASE_FREQUENCY[step.phase] + bodyLengthsPerSecond * SPEED_TO_FREQUENCY) * damping
  const wavePhase = state.wavePhase + frequency * step.dt * Math.PI * 2
  const amplitude = PHASE_AMPLITUDE[step.phase] * step.length * damping

  // how: The undulation is applied perpendicular to each segment after the chain has settled, so it bends the body without stretching it.
  const joints = chain.map((joint, index) => {
    if (index === 0) {
      return joint
    }
    const ahead = chain[index - 1] ?? joint
    const tangent = directionBetween(joint, ahead)
    const along = index / (SPINE_JOINTS - 1)
    const swing = Math.sin(wavePhase - along * WAVES_PER_BODY * Math.PI * 2) * amplitude * Math.pow(along, AMPLITUDE_FALLOFF)
    return { x: joint.x - tangent.y * swing, y: joint.y + tangent.x * swing }
  })

  return { joints, centreline: chain, wavePhase }
}

/**
 * The koi's width profile, nose to tail.
 *
 * Returns the half-width at a point along the body as a fraction of the koi's
 * widest half-width: a quick swell behind the head, a long hold through the
 * shoulders, then a taper to the narrow peduncle the tail fin hangs off.
 *
 * @param along - Position along the body, 0 at the nose and 1 at the tail.
 * @returns The half-width fraction, 0 to 1.
 */
export function widthProfile(along: number): number {
  const t = along < 0 ? 0 : along > 1 ? 1 : along
  // magic: The stations trace a nishikigoi silhouette — a narrow snout, the beam carried between the gills and midships, then a long run down to the peduncle.
  if (t < 0.1) {
    // why: The snout is narrow and rounds out over the head; starting near full beam is what turned the first attempt into a tadpole.
    return 0.2 + (t / 0.1) * 0.52
  }
  if (t < 0.28) {
    const local = (t - 0.1) / 0.18
    return 0.72 + local * 0.28
  }
  if (t < 0.44) {
    return 1
  }
  const local = (t - 0.44) / 0.56
  // why: A gentle ease keeps the flank full past midships and spends the whole back half tapering, which is the line that reads as a koi.
  return 1 - Math.pow(local, 1.15) * 0.92
}

/**
 * The half-width at each spine joint.
 *
 * @param length - Nose-to-tail length in CSS pixels.
 * @param girthRatio - Widest half-width as a fraction of body length.
 * @returns One half-width per joint, nose first.
 */
export function spineGirth(length: number, girthRatio: number): number[] {
  const beam = length * girthRatio
  return Array.from({ length: SPINE_JOINTS }, (_unused, index) => widthProfile(index / (SPINE_JOINTS - 1)) * beam)
}

/**
 * Thins a spine down to the few samples the host needs for proximity work.
 *
 * The full spine is twelve joints; the host only ever asks "roughly where is
 * this body", so five evenly spaced samples travel instead of all twelve.
 *
 * @param joints - The full spine, nose first.
 * @param samples - How many samples to take; at least two.
 * @returns The thinned chain, nose first, always including nose and tail.
 *
 * @example Reporting a compact outline
 * ```typescript
 * feature.send('outline', { spine: sampleSpine(spine.joints, 5), girth: sampleSpine(girths, 5) })
 * ```
 */
export function sampleSpine<T>(joints: readonly T[], samples: number): T[] {
  const count = Math.max(2, Math.min(samples, joints.length))
  if (joints.length <= count) {
    return [...joints]
  }
  // how: Collecting the wanted indices and filtering keeps the result total — an index-and-read pass would hand back optionals under noUncheckedIndexedAccess.
  const wanted = new Set<number>()
  for (let index = 0; index < count; index += 1) {
    wanted.add(Math.round((index * (joints.length - 1)) / (count - 1)))
  }
  return joints.filter((_unused, index) => wanted.has(index))
}
