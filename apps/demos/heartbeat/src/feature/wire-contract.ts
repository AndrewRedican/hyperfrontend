/**
 * Binds the heartbeat contract to the rhythm engine.
 *
 * The feature owns the rhythm; the wiring forwards every beat and rhythm
 * change to the host, answers latency pings, and applies rate commands.
 * Both sides are injected as narrow interfaces so the wiring is unit-testable
 * without a live host channel or running timers.
 */
import type { BeatEvent, RhythmEvent } from '../rhythm/rhythm-engine'

/** The slice of the feature handle the wiring needs. */
export interface FeatureLink {
  /** Sends a contract event to the host. */
  send(type: string, data?: unknown): void
  /** Registers a handler for a host command. */
  on(event: string, handler: (data: unknown) => void): unknown
  /** Registers a responder for a correlated host request. */
  handle(type: string, handler: (data: unknown) => unknown): unknown
  /** Reports whether the feature holds state worth confirming before close. */
  setDirty(dirty: boolean): void
}

/** The slice of the rhythm engine the wiring needs. */
export interface RhythmLink {
  /** Applies a clamped baseline rate and returns the applied value. */
  setRate(bpm: number): number
  /** Subscribes to every beat; returns an unsubscribe. */
  onBeat(listener: (beat: BeatEvent) => void): () => void
  /** Subscribes to rhythm changes; returns an unsubscribe. */
  onRhythm(listener: (change: RhythmEvent) => void): () => void
}

/**
 * Narrows an unknown payload to a plain record.
 *
 * @param value - The candidate payload.
 * @returns `true` when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Wires the rhythm engine to the host: beats and rhythm changes flow out,
 * pings are answered, and rate commands are applied.
 *
 * @param feature - The feature handle (or a test double) to bind.
 * @param rhythm - The rhythm engine (or a test double) owning the beats.
 *
 * @example Wiring the live feature
 * ```typescript
 * wireHeartbeatContract(feature, heartRhythm)
 * ```
 */
export function wireHeartbeatContract(feature: FeatureLink, rhythm: RhythmLink): void {
  rhythm.onBeat((beat) => {
    feature.send('beat', beat)
  })

  rhythm.onRhythm((change) => {
    feature.send('rhythm', change)
    // why: A disturbed rhythm is this demo's "unsaved work" — a host proposing a polite close sees dirty until the heart beats steadily again.
    feature.setDirty(change.state !== 'beating')
  })

  // how: A correlated request gets the echo back directly; the `pong` event
  // still fires so plain event listeners observe the answer too.
  feature.handle('ping', (data) => {
    if (!isRecord(data) || typeof data['seq'] !== 'number' || typeof data['sentAt'] !== 'number') {
      throw new Error('ping requires numeric seq and sentAt')
    }
    const reply = { seq: data['seq'], sentAt: data['sentAt'] }
    feature.send('pong', reply)
    return reply
  })

  feature.on('set-rate', (data) => {
    if (isRecord(data) && typeof data['bpm'] === 'number' && Number.isFinite(data['bpm'])) {
      // note: The engine echoes the applied (clamped) rate as a `rhythm` event, which the wiring above forwards — no explicit confirmation needed here.
      rhythm.setRate(data['bpm'])
    }
  })
}
