/**
 * The cardiac rhythm engine: a framework-free state machine that paces
 * heartbeats on chained timeouts with heart-rate variability, and models the
 * demo's interactions — extra beats, suppression by holding, flatline, and a
 * slow recovery ramp back to baseline.
 */

/** Where a beat originated: the scheduled rhythm or a visitor interaction. */
export type BeatSource = 'rhythm' | 'user'

/** The rhythm's life stages, driven by pointer/key holds and their release. */
export type RhythmState = 'beating' | 'suppressed' | 'flatline' | 'recovering'

/** One heartbeat as emitted to listeners (and forwarded to the host). */
export interface BeatEvent {
  /** Timestamp (ms) the beat fired. */
  at: number
  /** Monotonic beat counter across all sources. */
  seq: number
  /** Pacing rate (bpm, rounded) in effect when the beat fired. */
  bpm: number
  /** Whether the rhythm scheduled the beat or a visitor triggered it. */
  source: BeatSource
}

/** A rhythm change: a state transition or a pacing-rate change. */
export interface RhythmEvent {
  /** The state the rhythm is now in. */
  state: RhythmState
  /** Current pacing rate (bpm, rounded); 0 while suppressed or flatlined. */
  bpm: number
}

/** Slowest baseline rate a host may request. */
export const MIN_BPM = 40
/** Fastest baseline rate a host may request. */
export const MAX_BPM = 180
/** Resting rate the engine starts at. */
export const DEFAULT_BPM = 72
/** Pseudo-random spread applied to every interval (±4%), read as heart-rate variability. */
export const JITTER_FRACTION = 0.04
/** Hold duration that turns a press into suppression instead of a tap. */
export const HOLD_SUPPRESS_MS = 300
/** Total hold duration after which the suppressed rhythm flatlines. */
export const FLATLINE_HOLD_MS = 4000
/** Pause multiplier after a premature user beat (the compensatory pause). */
export const COMPENSATORY_FACTOR = 1.5
/** Fraction of baseline the first recovery beat paces at. */
export const RECOVERY_START_FACTOR = 0.5
/** Fraction of the remaining gap to baseline each recovery beat closes. */
export const RECOVERY_RAMP = 0.5
/** Pacing-to-baseline ratio at which recovery counts as complete. */
export const RECOVERY_DONE_RATIO = 0.97

/** Injectable dependencies and tuning for {@link createRhythmEngine}. */
export interface RhythmEngineOptions {
  /** Baseline rate in bpm; clamped to 40–180. Defaults to 72. */
  bpm?: number
  /** Uniform random source in [0, 1); defaults to `Math.random`. */
  random?: () => number
  /** Clock source; defaults to `Date.now`. */
  now?: () => number
}

/** The engine handle: lifecycle, interactions, and event subscription. */
export interface RhythmEngine {
  /** Starts the rhythm at baseline; a no-op when already running. */
  start(): void
  /** Stops all timers; the engine can be started again. */
  stop(): void
  /** Begins a hold: past {@link HOLD_SUPPRESS_MS} it suppresses, past {@link FLATLINE_HOLD_MS} it flatlines. */
  press(): void
  /** Ends a hold: a short press fires a user beat, a long one starts recovery. */
  release(): void
  /** Fires one immediate user beat followed by a compensatory pause. */
  tap(): void
  /**
   * Sets the baseline rate, clamped to 40–180 bpm, and echoes a rhythm event.
   *
   * @param bpm - The requested rate.
   * @returns The applied (clamped) rate.
   */
  setRate(bpm: number): number
  /** Returns the current rhythm state. */
  getState(): RhythmState
  /** Returns the current pacing rate (0 while suppressed or flatlined). */
  getPacingBpm(): number
  /** Returns the baseline rate the rhythm settles at. */
  getBaselineBpm(): number
  /**
   * Subscribes to every beat.
   *
   * @param listener - Receives each {@link BeatEvent}.
   * @returns A function that removes the subscription.
   */
  onBeat(listener: (beat: BeatEvent) => void): () => void
  /**
   * Subscribes to rhythm changes.
   *
   * @param listener - Receives each {@link RhythmEvent}.
   * @returns A function that removes the subscription.
   */
  onRhythm(listener: (change: RhythmEvent) => void): () => void
}

/**
 * Clamps a requested rate into the supported 40–180 bpm band.
 *
 * @param bpm - The requested rate.
 * @returns The clamped rate.
 */
function clampRate(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))
}

/**
 * Creates a rhythm engine.
 *
 * @param options - Injectable clock, random source, and starting rate.
 * @returns The {@link RhythmEngine} handle.
 *
 * @example Beating with listeners attached
 * ```typescript
 * const rhythm = createRhythmEngine()
 * rhythm.onBeat((beat) => console.log(beat.seq, beat.source))
 * rhythm.start()
 * ```
 */
export function createRhythmEngine(options: RhythmEngineOptions = {}): RhythmEngine {
  const random = options.random ?? (() => Math.random())
  const now = options.now ?? (() => Date.now())

  let baseline = clampRate(options.bpm ?? DEFAULT_BPM)
  let state: RhythmState = 'beating'
  let recoveryBpm = baseline
  let seq = 0
  let running = false
  let holding = false
  let beatTimer: ReturnType<typeof setTimeout> | undefined
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let flatlineTimer: ReturnType<typeof setTimeout> | undefined

  const beatListeners = new Set<(beat: BeatEvent) => void>()
  const rhythmListeners = new Set<(change: RhythmEvent) => void>()

  const pacingBpm = (): number => {
    if (state === 'suppressed' || state === 'flatline') {
      return 0
    }
    return state === 'recovering' ? recoveryBpm : baseline
  }

  const emitRhythm = (): void => {
    const change: RhythmEvent = { state, bpm: Math.round(pacingBpm()) }
    for (const listener of rhythmListeners) {
      listener(change)
    }
  }

  const transition = (next: RhythmState): void => {
    if (state === next) {
      return
    }
    state = next
    emitRhythm()
  }

  const jitteredInterval = (bpm: number, factor = 1): number => {
    // why: ±JITTER_FRACTION of pseudo-random spread makes the rhythm read as a heart with natural variability instead of a metronome.
    const jitter = 1 + (random() * 2 - 1) * JITTER_FRACTION
    return (60000 / bpm) * jitter * factor
  }

  const clearBeatTimer = (): void => {
    clearTimeout(beatTimer)
    beatTimer = undefined
  }

  const emitBeat = (source: BeatSource): void => {
    seq += 1
    const beat: BeatEvent = { at: now(), seq, bpm: Math.round(pacingBpm()), source }
    for (const listener of beatListeners) {
      listener(beat)
    }
  }

  const fireRhythmBeat = (): void => {
    emitBeat('rhythm')
    if (state === 'recovering') {
      // how: Each recovered beat closes half the remaining gap to baseline; close enough counts as fully recovered.
      recoveryBpm += (baseline - recoveryBpm) * RECOVERY_RAMP
      if (recoveryBpm >= baseline * RECOVERY_DONE_RATIO) {
        recoveryBpm = baseline
        transition('beating')
      }
    }
    schedule(jitteredInterval(pacingBpm()))
  }

  function schedule(delayMs: number): void {
    clearBeatTimer()
    beatTimer = setTimeout(fireRhythmBeat, delayMs)
  }

  const fireUserBeat = (): void => {
    emitBeat('user')
    // why: A premature beat lands early, so the next scheduled beat waits a touch longer — the compensatory pause that makes an ectopic beat feel real.
    schedule(jitteredInterval(pacingBpm(), COMPENSATORY_FACTOR))
  }

  return {
    start() {
      if (running) {
        return
      }
      running = true
      state = 'beating'
      recoveryBpm = baseline
      emitRhythm()
      schedule(jitteredInterval(baseline))
    },
    stop() {
      running = false
      holding = false
      clearBeatTimer()
      clearTimeout(holdTimer)
      clearTimeout(flatlineTimer)
    },
    press() {
      if (!running || holding) {
        return
      }
      holding = true
      holdTimer = setTimeout(() => {
        // why: Only a sustained hold suppresses — a shorter press stays a tap, resolved at release.
        clearBeatTimer()
        transition('suppressed')
      }, HOLD_SUPPRESS_MS)
      flatlineTimer = setTimeout(() => {
        transition('flatline')
      }, FLATLINE_HOLD_MS)
    },
    release() {
      if (!running || !holding) {
        return
      }
      holding = false
      clearTimeout(holdTimer)
      clearTimeout(flatlineTimer)
      if (state === 'suppressed' || state === 'flatline') {
        // why: Coming back from silence starts slow and ramps up — an instant return to baseline would look like nothing happened.
        recoveryBpm = baseline * RECOVERY_START_FACTOR
        transition('recovering')
        schedule(jitteredInterval(recoveryBpm))
        return
      }
      fireUserBeat()
    },
    tap() {
      if (!running || holding || state === 'suppressed' || state === 'flatline') {
        return
      }
      fireUserBeat()
    },
    setRate(bpm: number): number {
      const applied = clampRate(bpm)
      baseline = applied
      if (state === 'recovering' && recoveryBpm > baseline) {
        // why: A lowered baseline must cap the ramp, or recovery would overshoot downward forever.
        recoveryBpm = baseline
      }
      // why: Echoed even without a state change so a host's set-rate is always confirmed with the applied value.
      emitRhythm()
      if (running && (state === 'beating' || state === 'recovering')) {
        schedule(jitteredInterval(pacingBpm()))
      }
      return applied
    },
    getState: () => state,
    getPacingBpm: () => pacingBpm(),
    getBaselineBpm: () => baseline,
    onBeat(listener) {
      beatListeners.add(listener)
      return () => beatListeners.delete(listener)
    },
    onRhythm(listener) {
      rhythmListeners.add(listener)
      return () => rhythmListeners.delete(listener)
    },
  }
}
