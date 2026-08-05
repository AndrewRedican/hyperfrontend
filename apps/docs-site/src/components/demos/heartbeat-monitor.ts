/**
 * Host-side vitals for the heartbeat demo console: an observed-rate window, a
 * compact sweeping ECG strip, and an approval-gated lub-dub chime. All three
 * hang off the one authoritative `beat` stream the feature emits — nothing
 * here reconstructs its own idea of the rhythm, and the displayed rate is
 * measured from received beats, never copied from the pacing target.
 */
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { floor, max, round, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { createFloat32Array, createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/** How far back received beats count toward the observed rate. */
export const OBSERVED_WINDOW_MS = 10000

/** Shortest effective interval the estimate honours — caps the display at 240 bpm and guards coincident timestamps. */
export const MIN_EFFECTIVE_INTERVAL_MS = 250

/** A rolling accumulator of received-beat timestamps yielding the observed rate. */
export interface ObservedBpm {
  /**
   * Records one received beat.
   *
   * @param atMs - Timestamp (ms) the beat arrived.
   */
  addBeat(atMs: number): void
  /**
   * Computes the observed rate at a point in time.
   *
   * @param nowMs - The current timestamp (ms).
   * @returns Beats per minute as a rounded integer; 0 while fewer than two beats remain in the window.
   */
  readingAt(nowMs: number): number
  /** Clears every recorded beat. */
  reset(): void
}

/**
 * Creates an observed-BPM accumulator.
 *
 * While beats flow the reading follows the mean received interval; once they
 * stop, the growing silence takes over the estimate so the value decays
 * instead of freezing, reaching 0 when the window empties.
 *
 * @param windowMs - How far back beats count; defaults to {@link OBSERVED_WINDOW_MS}.
 * @returns The {@link ObservedBpm} handle.
 */
export function createObservedBpm(windowMs: number = OBSERVED_WINDOW_MS): ObservedBpm {
  const stamps: number[] = []
  return {
    addBeat(atMs) {
      stamps.push(atMs)
    },
    readingAt(nowMs) {
      const cutoff = nowMs - windowMs
      while (stamps.length > 0 && stamps[0] !== undefined && stamps[0] < cutoff) {
        stamps.shift()
      }
      const first = stamps[0]
      const last = stamps[stamps.length - 1]
      if (first === undefined || last === undefined || stamps.length < 2) {
        return 0
      }
      const meanInterval = (last - first) / (stamps.length - 1)
      return round(60000 / max(meanInterval, nowMs - last, MIN_EFFECTIVE_INTERVAL_MS))
    },
    reset() {
      stamps.length = 0
    },
  }
}

/** Milliseconds one horizontal pixel of the strip spans. */
const STRIP_MS_PER_PX = 12
/** Pixels of erased lead ahead of the sweep head, keeping a flat trace visibly alive. */
const STRIP_GAP_PX = 18
/** Total duration of one beat's spike complex. */
const COMPLEX_MS = 150
/** Piecewise spike shape: [start, end, amplitude] half-sine bumps; flat elsewhere. */
const SEGMENTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 40, -0.08],
  [40, 110, 1],
  [110, 150, -0.12],
]

/** One received beat positioned on the strip timeline. */
export interface StripBeat {
  /** Timestamp (ms) the beat arrived. */
  at: number
  /** Whether the beat came from the rhythm or a visitor extra. */
  source: 'rhythm' | 'user'
}

/** The compact sweeping ECG strip. */
export interface EcgStrip {
  /**
   * Adds one received beat to the trace.
   *
   * @param beat - The beat's receipt time and source.
   */
  addBeat(beat: StripBeat): void
  /**
   * Forces (or releases) the flat baseline.
   *
   * @param flat - `true` while the rhythm reads as flatlined.
   */
  setFlat(flat: boolean): void
  /** Starts the animation loop. */
  start(): void
  /** Stops the animation loop and clears the canvas. */
  stop(): void
}

/**
 * Samples the composed trace value at a point in time.
 *
 * @param timeMs - The timeline position (ms) to sample.
 * @param beats - The received beats to compose.
 * @param flat - Whether baseline wander is silenced.
 * @returns The summed signed amplitude at `timeMs`.
 */
function stripValue(timeMs: number, beats: readonly StripBeat[], flat: boolean): number {
  let value = flat ? 0 : 0.02 * sin(timeMs * 0.011) + 0.015 * sin(timeMs * 0.0043 + 1.7)
  for (const beat of beats) {
    const phase = timeMs - beat.at
    if (phase < 0 || phase > COMPLEX_MS) {
      continue
    }
    for (const [start, end, amplitude] of SEGMENTS) {
      if (phase >= start && phase <= end) {
        value += (beat.source === 'user' ? 1.3 : 1) * amplitude * sin((Math.PI * (phase - start)) / (end - start))
      }
    }
  }
  return value
}

/**
 * Creates the compact sweeping ECG strip for a canvas.
 *
 * A hospital-monitor sweep: the write head travels left to right at fixed
 * time-per-pixel, overwriting the previous pass with a small erased gap kept
 * ahead of it — so movement stays visible even while the trace is flat, and a
 * flatline still reads as a running monitor.
 *
 * @param canvas - The target canvas element.
 * @returns The {@link EcgStrip} handle.
 */
export function createEcgStrip(canvas: HTMLCanvasElement): EcgStrip {
  const context = canvas.getContext('2d')
  const beats: StripBeat[] = []
  const samples = createFloat32Array(canvas.width)
  const written = createUint8Array(canvas.width)
  let flat = false
  let frame = 0
  let lastColumn: number | null = null

  const paint = (): void => {
    if (context === null) {
      return
    }
    const { width, height } = canvas
    const now = dateNow()
    while (beats.length > 0 && beats[0] !== undefined && beats[0].at < now - COMPLEX_MS - 1000) {
      beats.shift()
    }
    // how: Every column owns the instant the head passed it — written exactly once per lap, at that column's own time.
    const column = floor(now / STRIP_MS_PER_PX)
    const from = lastColumn === null ? column : lastColumn + 1
    const start = column - from >= width ? column - width + 1 : from
    for (let abs = start; abs <= column; abs += 1) {
      const x = abs % width
      samples[x] = stripValue(abs * STRIP_MS_PER_PX, beats, flat)
      written[x] = 1
    }
    lastColumn = column
    const headX = column % width

    context.clearRect(0, 0, width, height)
    context.strokeStyle = '#f43f5e'
    context.lineWidth = 1.6
    context.shadowColor = '#f43f5e'
    context.shadowBlur = 5
    context.beginPath()
    const baselineY = height * 0.62
    const amplitude = height * 0.4
    let drawing = false
    for (let x = 0; x < width; x += 1) {
      const ahead = (x - headX + width) % width
      const value = samples[x]
      if (written[x] !== 1 || value === undefined || (ahead > 0 && ahead <= STRIP_GAP_PX)) {
        drawing = false
        continue
      }
      const y = baselineY - value * amplitude
      if (drawing) {
        context.lineTo(x, y)
      } else {
        context.moveTo(x, y)
        drawing = true
      }
    }
    context.stroke()
    context.shadowBlur = 0
    frame = requestAnimationFrame(paint)
  }

  return {
    addBeat(beat) {
      beats.push(beat)
    },
    setFlat(next) {
      flat = next
    },
    start() {
      if (frame === 0) {
        frame = requestAnimationFrame(paint)
      }
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
      context?.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}

/** The approval-gated heartbeat chime. */
export interface LubDub {
  /**
   * Enables sound. Must be called from a user interaction: it creates and
   * resumes the audio context, which browsers only allow under a gesture.
   *
   * @returns `true` when audio is running; `false` when unsupported or refused.
   */
  enable(): Promise<boolean>
  /** Disables sound; further beats stay silent until re-enabled. */
  disable(): void
  /** Reports whether sound is currently enabled. */
  isEnabled(): boolean
  /** Plays one lub-dub. A no-op while disabled, so callers never gate. */
  playBeat(): void
}

/** The two thumps of one beat: onset offset (s), start/end frequency (Hz), peak gain, decay length (s). */
const THUMPS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 64, 38, 0.5, 0.11],
  [0.15, 52, 32, 0.34, 0.13],
]

/**
 * Creates the host-owned heartbeat chime.
 *
 * The feature declares the `autoplay` capability in its manifest; this host
 * surfaces that request as an explicit "Enable heartbeat sound" approval and
 * owns the playback that follows — the reliable ownership under cross-origin
 * autoplay policy, since the approving click happens in the host's own frame.
 *
 * @returns The {@link LubDub} handle.
 */
export function createLubDub(): LubDub {
  let context: AudioContext | null = null
  let output: DynamicsCompressorNode | null = null
  let enabled = false
  let activeVoices = 0

  const ensureOutput = (target: AudioContext): DynamicsCompressorNode => {
    if (output !== null) {
      return output
    }
    // why: The compressor is what lets closely spaced taps stack audibly instead of clipping.
    const compressor = target.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.knee.value = 18
    compressor.ratio.value = 8
    compressor.attack.value = 0.002
    compressor.release.value = 0.15
    compressor.connect(target.destination)
    output = compressor
    return compressor
  }

  return {
    async enable() {
      if (context === null && typeof window !== 'undefined' && typeof window.AudioContext === 'function') {
        context = new window.AudioContext()
      }
      if (context === null) {
        return false
      }
      try {
        // why: resume() is the autoplay gate — it resolves under the approving click and rejects otherwise, and a refusal must land as "still muted", never as an uncaught error.
        await context.resume()
      } catch {
        return false
      }
      if (context.state !== 'running') {
        return false
      }
      ensureOutput(context)
      enabled = true
      return true
    },
    disable() {
      enabled = false
      if (context !== null) {
        void context.suspend().catch(() => undefined)
      }
    },
    isEnabled: () => enabled,
    playBeat() {
      if (!enabled || context === null || activeVoices >= 12) {
        return
      }
      const into = ensureOutput(context)
      const at = context.currentTime + 0.001
      for (const [offset, fromHz, toHz, peak, decay] of THUMPS) {
        const osc = context.createOscillator()
        const envelope = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(fromHz, at + offset)
        osc.frequency.exponentialRampToValueAtTime(toHz, at + offset + decay)
        envelope.gain.setValueAtTime(0.0001, at + offset)
        envelope.gain.linearRampToValueAtTime(peak, at + offset + 0.006)
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + offset + decay)
        osc.connect(envelope)
        envelope.connect(into)
        activeVoices += 1
        osc.onended = () => {
          activeVoices -= 1
          osc.disconnect()
          envelope.disconnect()
        }
        osc.start(at + offset)
        osc.stop(at + offset + decay + 0.05)
      }
    },
  }
}
