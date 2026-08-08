/**
 * Turning what a koi is doing into how a koi is shaped.
 *
 * This is the layer that lets a consumer say `speed` and `turnRate` and get a
 * convincing animal back, without knowing that a spine exists. Everything a
 * behaviour loop wants to express — cruising, banking into a turn, bolting from
 * a shadow, drifting to a halt — arrives here as six numbers and leaves as the
 * curvature parameters the pose model integrates.
 *
 * Nothing snaps. Every parameter chases its target on its own time constant, so
 * a koi asked to escape winds its body up over a few frames the way a real one
 * does, and a koi released from a turn unwinds rather than springing straight.
 */
import type { KoiMotionInput, KoiSwimTrim } from './config.js'
import type { SwimParameters } from './spine-pose.js'
import { DEFAULT_MOTION, DEFAULT_TRIM } from './config.js'
import { STILL_SWIM } from './spine-pose.js'

/** The nine development states the workbench offers, and the pond will draw from. */
export const MOTION_PRESETS: Readonly<Record<string, KoiMotionInput>> = {
  Still: { ...DEFAULT_MOTION, speed: 0 },
  Idle: { ...DEFAULT_MOTION, speed: 0.08 },
  'Relaxed swim': { ...DEFAULT_MOTION, speed: 0.55 },
  'Fast swim': { ...DEFAULT_MOTION, speed: 1.7, acceleration: 0.2 },
  'Gentle left turn': { ...DEFAULT_MOTION, speed: 0.55, turnRate: 0.5 },
  'Gentle right turn': { ...DEFAULT_MOTION, speed: 0.55, turnRate: -0.5 },
  'Hard left turn': { ...DEFAULT_MOTION, speed: 1.1, turnRate: 1.9 },
  'Hard right turn': { ...DEFAULT_MOTION, speed: 1.1, turnRate: -1.9 },
  Escape: { ...DEFAULT_MOTION, speed: 3.4, turnRate: 1.2, acceleration: 2.6, escapeIntensity: 1 },
}

/** How fast each parameter chases its target, in seconds to close most of the gap. */
const RESPONSE = <const>{
  wave: 0.22,
  turn: 0.12,
  bank: 0.3,
  pitch: 0.35,
}

/**
 * Clamps a value into a band.
 *
 * @param value - The value to clamp.
 * @param min - Band floor.
 * @param max - Band ceiling.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Moves a value toward a target at a fixed time constant, frame-rate independently.
 *
 * @param current - Where the value is now.
 * @param target - Where it is heading.
 * @param response - Seconds to close most of the gap.
 * @param dt - Seconds elapsed.
 * @returns The advanced value.
 */
function chase(current: number, target: number, response: number, dt: number): number {
  // why: An exponential rather than a fixed step means the same easing at 30 fps and at 144 fps, which matters because the pond will run at whatever the tab gives it.
  return current + (target - current) * (1 - Math.exp(-dt / response))
}

/**
 * Reads the swim a motion state implies, before smoothing.
 *
 * @param motion - What the koi is doing.
 * @param trim - This koi's own trim on the model.
 * @returns The curvature parameters that shape it.
 *
 * @example Posing a koi statically at a known behaviour
 * ```typescript
 * const pose = evaluateSpine(length, targetSwim(MOTION_PRESETS.Escape, DEFAULT_TRIM), 0)
 * ```
 */
export function targetSwim(motion: KoiMotionInput, trim: KoiSwimTrim = DEFAULT_TRIM): SwimParameters {
  const speed = Math.max(0, motion.speed)
  const escape = clamp(motion.escapeIntensity, 0, 1)
  const surge = Math.max(0, motion.acceleration)
  const turn = clamp(motion.turnRate, -3, 3)
  return {
    // magic: A swimming fish holds its tail-beat amplitude roughly constant across speeds and varies its frequency instead; these numbers are calibrated so the tail tip sweeps about a fifth of a body length at cruise, which is what a carp actually does.
    amplitude: (9 + Math.min(speed, 2.2) * 2.4 + escape * 2.5 + surge) * trim.amplitude,
    // why: The wave starts further forward the harder the koi swims, which is the difference a viewer reads as effort — a cruising fish waves only its tail, a bolting one throws its whole body.
    waveStart: clamp(0.64 - speed * 0.14 - escape * 0.44 - trim.waveReach, 0.02, 0.8),
    waveGrowth: clamp(2.3 - escape * 0.9 - Math.min(speed, 2) * 0.2, 1.15, 2.4),
    wavesPerBody: (0.95 + Math.min(speed, 3) * 0.07 + escape * 0.3) * trim.wavesPerBody,
    caudalLag: 0.12 + escape * 0.07,
    // magic: Saturating the bend keeps a koi asked for an impossible turn rate looking like a fish at its limit rather than a hoop.
    turnBend: 2.3 * Math.tanh(turn * 0.82) * trim.turn,
    turnCentre: 0.32 + escape * 0.1,
    turnSpread: 0.3 + escape * 0.13,
    bank: clamp(turn * 0.22, -0.38, 0.38),
    rollBeat: 0.028 + escape * 0.055,
    pitch: clamp(motion.climbRate * 0.55, -0.5, 0.5),
    sway: 0.006 + escape * 0.012,
  }
}

/** A koi's live swimming state: what it is doing, and how far through the beat it is. */
export interface KoiSwimState {
  /** The smoothed curvature parameters the pose model reads. */
  readonly swim: SwimParameters
  /** How far through the tail beat the koi is, in radians. */
  readonly phase: number
  /** Tail-beat frequency the phase is currently advancing at, in hertz. */
  readonly frequency: number
  /** What the koi was last told to do. */
  readonly motion: KoiMotionInput
  /** This koi's own trim on the swimming model. */
  readonly trim: KoiSwimTrim
  /**
   * Adjusts this koi's trim; anything left out keeps its current value.
   *
   * @param input - The trim to take on.
   */
  setTrim(input: Partial<KoiSwimTrim>): void
  /**
   * Tells the koi what to do; anything left out keeps its current value.
   *
   * @param input - The motion to chase.
   */
  setMotion(input: Partial<KoiMotionInput>): void
  /**
   * Advances the beat and eases every parameter toward its target.
   *
   * @param dt - Seconds elapsed.
   */
  advance(dt: number): void
  /**
   * Jumps the beat to an exact phase, for freezing and scrubbing.
   *
   * @param phase - Phase in radians.
   */
  setPhase(phase: number): void
  /**
   * Drops every parameter onto its target with no easing.
   *
   * @param input - The motion to settle at; anything left out keeps its current value.
   */
  settle(input?: Partial<KoiMotionInput>): void
}

/**
 * The tail-beat frequency a motion state swims at.
 *
 * @param motion - What the koi is doing.
 * @param trim - This koi's own trim on the model.
 * @returns Frequency in hertz.
 */
function beatFrequency(motion: KoiMotionInput, trim: KoiSwimTrim): number {
  // magic: A carp covers roughly seven tenths of its own length per tail beat, so speed sets frequency and the idle term is what keeps a hovering fish sculling.
  return (0.34 + Math.max(0, motion.speed) / 0.7 + clamp(motion.escapeIntensity, 0, 1) * 2.6) * trim.frequency
}

/**
 * Opens a koi's swimming state.
 *
 * @param initial - What the koi starts out doing.
 * @param trim - Its own trim on the swimming model.
 * @returns The state, already settled on `initial`.
 *
 * @example Driving a koi from a behaviour loop
 * ```typescript
 * const swim = createSwimState({ speed: 0.6 })
 * swim.setMotion({ turnRate: -0.8, escapeIntensity: 0.4 })
 * swim.advance(delta)
 * ```
 */
export function createSwimState(initial: Partial<KoiMotionInput> = {}, trim: Partial<KoiSwimTrim> = {}): KoiSwimState {
  const motion: KoiMotionInput = { ...DEFAULT_MOTION, ...initial }
  const settings: KoiSwimTrim = { ...DEFAULT_TRIM, ...trim }
  let swim: SwimParameters = targetSwim(motion, settings)
  let phase = 0
  let frequency = beatFrequency(motion, settings)

  return {
    get swim() {
      return swim
    },
    get phase() {
      return phase
    },
    get frequency() {
      return frequency
    },
    get motion() {
      return { ...motion }
    },
    get trim() {
      return { ...settings }
    },
    setMotion(input) {
      Object.assign(motion, input)
    },
    setTrim(input) {
      Object.assign(settings, input)
    },
    setPhase(next) {
      phase = next
    },
    settle(input = {}) {
      Object.assign(motion, input)
      swim = targetSwim(motion, settings)
      frequency = beatFrequency(motion, settings)
    },
    advance(dt) {
      const step = clamp(dt, 0, 0.1)
      const agility = 0.55 + settings.responsiveness
      const target = targetSwim(motion, settings)
      frequency = chase(frequency, beatFrequency(motion, settings), RESPONSE.wave, step)
      swim = {
        amplitude: chase(swim.amplitude, target.amplitude, RESPONSE.wave / agility, step),
        waveStart: chase(swim.waveStart, target.waveStart, RESPONSE.wave, step),
        waveGrowth: chase(swim.waveGrowth, target.waveGrowth, RESPONSE.wave, step),
        wavesPerBody: chase(swim.wavesPerBody, target.wavesPerBody, RESPONSE.wave, step),
        caudalLag: chase(swim.caudalLag, target.caudalLag, RESPONSE.wave, step),
        turnBend: chase(swim.turnBend, target.turnBend, RESPONSE.turn / agility, step),
        turnCentre: chase(swim.turnCentre, target.turnCentre, RESPONSE.turn, step),
        turnSpread: chase(swim.turnSpread, target.turnSpread, RESPONSE.turn, step),
        bank: chase(swim.bank, target.bank, RESPONSE.bank, step),
        rollBeat: chase(swim.rollBeat, target.rollBeat, RESPONSE.wave, step),
        pitch: chase(swim.pitch, target.pitch, RESPONSE.pitch, step),
        sway: chase(swim.sway, target.sway, RESPONSE.wave, step),
      }
      phase += frequency * step * Math.PI * 2
    },
  }
}

/** A koi that has stopped dead, for tests and for the workbench's frozen state. */
export const STILL_STATE: SwimParameters = { ...STILL_SWIM }
