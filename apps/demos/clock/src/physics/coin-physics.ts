/**
 * Physics for the clock coin's Y-axis spin.
 *
 * Framework-agnostic and dependency-free. The caller owns the clock: every entry
 * point takes a timestamp in milliseconds, and `step(nowMs)` advances the
 * simulation, so tests can drive time deterministically.
 *
 * Faces live at multiples of 180°: even multiples show the analog face, odd
 * multiples the digital face. The angle is unbounded (spins accumulate).
 */

/** The two coin faces. */
export type CoinFace = 'analog' | 'digital'

/** Simulation phases. */
export type CoinMode = 'resting' | 'dragging' | 'momentum' | 'settling'

/** Callback fired whenever the coin comes to rest on a face. */
export type SettleHandler = (face: CoinFace) => void

/** Tuning knobs and the settle callback. */
export interface CoinPhysicsOptions {
  /** Fired every time the coin settles onto a face. */
  onSettle?: SettleHandler
  /** Degrees of rotation per pixel of drag; defaults to 0.55. */
  degreesPerPixel?: number
  /** Exponential friction rate (1/ms) during momentum; defaults to 0.002. */
  friction?: number
  /** Angular frequency (1/ms) of the settle spring; defaults to 0.012. */
  springOmega?: number
  /** Speed (deg/ms) below which momentum hands over to the spring; defaults to 0.05. */
  settleSpeed?: number
}

/** The live physics handle driving one coin. */
export interface CoinPhysics {
  /** Current rotation in degrees (unbounded). */
  readonly angle: number
  /** Current simulation phase. */
  readonly mode: CoinMode
  /** The face the coin is resting on or heading toward. */
  readonly face: CoinFace
  /** Catches the coin (even mid-spin) at a pointer position. */
  grab(pointerX: number, nowMs: number): void
  /** Rotates 1:1 with the pointer while grabbed. */
  drag(pointerX: number, nowMs: number): void
  /** Releases the coin into momentum (or straight into settling when slow). */
  release(nowMs: number): void
  /** Impulse-flips the coin one face forward (a tap or keyboard flip). */
  tap(nowMs: number): void
  /** Physics-flips the coin to a target face (host command or alarm). */
  flipTo(face: CoinFace, nowMs: number): void
  /** Advances the simulation to `nowMs` and returns the current angle. */
  step(nowMs: number): number
}

const HALF_TURN = 180
const REST_EPSILON_DEG = 0.05
const REST_EPSILON_SPEED = 0.0005
const MAX_STEP_MS = 48

/**
 * Maps an angle to the face shown at its nearest half-turn.
 *
 * @param angle - Rotation in degrees.
 * @returns The face visible when resting at that angle.
 */
export function faceAt(angle: number): CoinFace {
  const halfTurns = Math.round(angle / HALF_TURN)
  return halfTurns % 2 === 0 ? 'analog' : 'digital'
}

/**
 * Creates a coin physics simulation.
 *
 * @param options - Tuning knobs and the settle callback.
 * @returns A {@link CoinPhysics} handle.
 *
 * @example Driving the coin from a rAF loop
 * ```typescript
 * const coin = createCoinPhysics({ onSettle: (face) => console.log(face) })
 * coin.tap(performance.now())
 * const frame = (now: number) => { render(coin.step(now)); requestAnimationFrame(frame) }
 * requestAnimationFrame(frame)
 * ```
 */
export function createCoinPhysics(options: CoinPhysicsOptions = {}): CoinPhysics {
  const degreesPerPixel = options.degreesPerPixel ?? 0.55
  const friction = options.friction ?? 0.002
  const springOmega = options.springOmega ?? 0.012
  const settleSpeed = options.settleSpeed ?? 0.05

  let angle = 0
  let velocity = 0
  let mode: CoinMode = 'resting'
  let target = 0
  let lastTime: number | null = null
  let pointerX = 0
  let pointerTime = 0

  const rest = (restAngle: number) => {
    angle = restAngle
    velocity = 0
    mode = 'resting'
    options.onSettle?.(faceAt(restAngle))
  }

  const beginSettle = (settleTarget: number) => {
    target = settleTarget
    mode = 'settling'
  }

  /**
   * Picks the half-turn the coin should land on, biased by momentum: the coin
   * aims for the rest angle its current velocity would carry it to.
   */
  const chooseTarget = () => {
    const projected = angle + velocity / friction
    return Math.round(projected / HALF_TURN) * HALF_TURN
  }

  const advance = (dtMs: number) => {
    if (mode === 'momentum') {
      const decay = Math.exp(-friction * dtMs)
      angle += (velocity / friction) * (1 - decay)
      velocity *= decay
      if (Math.abs(velocity) <= settleSpeed) {
        beginSettle(chooseTarget())
      }
      return
    }
    if (mode === 'settling') {
      // how: Critically damped spring — approaches the target without oscillating.
      const displacement = angle - target
      const acceleration = -springOmega * springOmega * displacement - 2 * springOmega * velocity
      velocity += acceleration * dtMs
      angle += velocity * dtMs
      if (Math.abs(angle - target) < REST_EPSILON_DEG && Math.abs(velocity) < REST_EPSILON_SPEED) {
        rest(target)
      }
    }
  }

  return {
    get angle() {
      return angle
    },
    get mode() {
      return mode
    },
    get face() {
      if (mode === 'settling') {
        return faceAt(target)
      }
      if (mode === 'momentum') {
        return faceAt(angle + velocity / friction)
      }
      return faceAt(angle)
    },

    grab(x: number, nowMs: number) {
      mode = 'dragging'
      velocity = 0
      pointerX = x
      pointerTime = nowMs
      lastTime = nowMs
    },

    drag(x: number, nowMs: number) {
      if (mode !== 'dragging') {
        return
      }
      const deltaX = x - pointerX
      angle += deltaX * degreesPerPixel
      const dt = nowMs - pointerTime
      if (dt > 0) {
        velocity = (deltaX * degreesPerPixel) / dt
      }
      pointerX = x
      pointerTime = nowMs
      lastTime = nowMs
    },

    release(nowMs: number) {
      if (mode !== 'dragging') {
        return
      }
      lastTime = nowMs
      if (Math.abs(velocity) <= settleSpeed) {
        beginSettle(Math.round(angle / HALF_TURN) * HALF_TURN)
        return
      }
      mode = 'momentum'
    },

    tap(nowMs: number) {
      if (mode === 'dragging') {
        return
      }
      lastTime = nowMs
      // how: An impulse whose momentum travel (v/friction) overshoots the next face
      // slightly, so the biased snap always selects one face forward.
      const direction = velocity < 0 ? -1 : 1
      const base = mode === 'resting' ? Math.round(angle / HALF_TURN) * HALF_TURN : angle
      angle = base
      velocity = direction * HALF_TURN * 1.1 * friction
      mode = 'momentum'
    },

    flipTo(face: CoinFace, nowMs: number) {
      lastTime = nowMs
      if (mode === 'resting' && faceAt(angle) === face) {
        return
      }
      // how: Aim at least half a turn forward so a commanded flip always travels.
      let landing = Math.ceil(angle / HALF_TURN + 0.5) * HALF_TURN
      if (faceAt(landing) !== face) {
        landing += HALF_TURN
      }
      velocity = (landing - angle) * friction
      mode = 'momentum'
    },

    step(nowMs: number) {
      if (lastTime === null) {
        lastTime = nowMs
        return angle
      }
      let remaining = nowMs - lastTime
      lastTime = nowMs
      // how: Clamp long gaps (tab hidden) into fixed sub-steps to keep the
      // integration stable.
      while (remaining > 0 && (mode === 'momentum' || mode === 'settling')) {
        advance(Math.min(remaining, MAX_STEP_MS))
        remaining -= MAX_STEP_MS
      }
      return angle
    },
  }
}
