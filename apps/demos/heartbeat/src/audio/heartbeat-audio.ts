/**
 * Web-Audio "lub-dub" for the heartbeat: two soft low-frequency thumps per
 * beat, synthesized on demand — no audio asset, no dependency. A master
 * compressor keeps rapid or stacked beats audible without clipping, and the
 * whole module stays silent until it is explicitly enabled by a user action,
 * so nothing ever autoplays.
 */

/** Voices allowed to overlap before further beats are skipped — a safety valve against runaway stacking. */
const MAX_ACTIVE_VOICES = 12

/** The two thumps of one beat: onset offset (s), start/end frequency (Hz), peak gain, and decay length (s). */
const THUMPS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  // note: The "lub" — deeper, stronger, right on the beat.
  [0, 64, 38, 0.5, 0.11],
  // note: The "dub" — softer and shorter, ~150 ms behind, like the second valve closing.
  [0.15, 52, 32, 0.34, 0.13],
]

/** The heartbeat sound engine. */
export interface HeartbeatAudio {
  /**
   * Enables sound. Must be called from a user interaction: it creates and
   * resumes the audio context, which browsers only allow under a gesture.
   *
   * @returns `true` when audio is running; `false` when the environment has no
   * audio support or the browser refused to start playback.
   */
  enable(): Promise<boolean>
  /** Disables sound; further beats stay silent until re-enabled. */
  disable(): void
  /** Reports whether sound is currently enabled. */
  isEnabled(): boolean
  /** Plays one lub-dub. A no-op while disabled, so callers never gate. */
  playBeat(): void
}

/**
 * Builds an audio context when the environment supports one.
 *
 * @returns A running-or-suspended context, or `null` without Web Audio.
 */
function defaultContextFactory(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return null
  }
  return new window.AudioContext()
}

/**
 * Creates the heartbeat sound engine.
 *
 * @param createContext - Injectable context factory; defaults to the browser's `AudioContext`.
 * @returns The {@link HeartbeatAudio} handle.
 *
 * @example Enabling from a user gesture and sounding every beat
 * ```typescript
 * const audio = createHeartbeatAudio()
 * button.onclick = () => void audio.enable()
 * rhythm.onBeat(() => audio.playBeat())
 * ```
 */
export function createHeartbeatAudio(createContext: () => AudioContext | null = defaultContextFactory): HeartbeatAudio {
  let context: AudioContext | null = null
  let output: DynamicsCompressorNode | null = null
  let enabled = false
  let activeVoices = 0

  const ensureOutput = (target: AudioContext): DynamicsCompressorNode => {
    if (output !== null) {
      return output
    }
    // why: The compressor is what lets closely spaced taps stack audibly instead of clipping — peaks squash, quiet passages stay put.
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

  const thump = (
    target: AudioContext,
    into: DynamicsCompressorNode,
    at: number,
    fromHz: number,
    toHz: number,
    peak: number,
    decay: number
  ): void => {
    const osc = target.createOscillator()
    const envelope = target.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(fromHz, at)
    osc.frequency.exponentialRampToValueAtTime(toHz, at + decay)
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(peak, at + 0.006)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(envelope)
    envelope.connect(into)
    activeVoices += 1
    osc.onended = () => {
      activeVoices -= 1
      osc.disconnect()
      envelope.disconnect()
    }
    osc.start(at)
    osc.stop(at + decay + 0.05)
  }

  return {
    async enable() {
      if (context === null) {
        context = createContext()
      }
      if (context === null) {
        return false
      }
      try {
        // why: resume() is the autoplay gate — browsers resolve it under a user gesture and reject otherwise, and a rejection must land as "still muted", never as an uncaught error.
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
      if (!enabled || context === null || activeVoices >= MAX_ACTIVE_VOICES) {
        return
      }
      const into = ensureOutput(context)
      const at = context.currentTime + 0.001
      for (const [offset, fromHz, toHz, peak, decay] of THUMPS) {
        thump(context, into, at + offset, fromHz, toHz, peak, decay)
      }
    },
  }
}
