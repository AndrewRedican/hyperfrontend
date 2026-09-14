import type { EnvelopeConfig } from '../models/envelope'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How far apart consecutive blocks of a run start growing, at full speed. */
const BLOCK_STAGGER_MS = 30

/** How long one block takes to grow to its full size, at full speed. */
const BLOCK_GROW_MS = 160

/** How far apart consecutive cells start scrambling, at full speed. */
const CELL_STAGGER_MS = 80

/** How long one cell spends cycling through glyphs before it settles, at full speed. */
const SCRAMBLE_MS = 220

/** How long the shackle takes to drop into the lock, at full speed. */
const LOCK_MS = 260

/** How much faster the second call runs than the first, which the eye has already followed once. */
const REPEAT_SPEED = 0.7

/** How long a key takes to slide from the edge of the frame to its lock. */
export const KEY_MS = 700

/** How long the shackle takes to lift once the right key has arrived. */
export const OPEN_MS = 280

/** How far apart consecutive cells start unscrambling. */
export const UNSEAL_STAGGER_MS = 45

/** How long the second strip shakes against the wrong key. */
export const JITTER_MS = 420

/** How long a fade-in of a label, a chip or the sign takes. */
export const FADE_MS = 300

/** The moments one call to seal a strip passes through. */
export interface SealSchedule {
  /** When the first salt block starts growing. */
  saltAt: number
  /** When the first initialisation vector block starts growing. */
  ivAt: number
  /** When the first cell starts scrambling. */
  scrambleAt: number
  /** When the first tag block starts growing. */
  tagAt: number
  /** When the lock appears, open, at the end of the tag. */
  lockAt: number
  /** When the shackle starts dropping. */
  closeAt: number
  /** When the strip is sealed. */
  sealedAt: number
  /** How far apart consecutive blocks start growing. */
  blockStaggerMs: number
  /** How long one block takes to grow. */
  blockGrowMs: number
  /** How far apart consecutive cells start scrambling. */
  cellStaggerMs: number
  /** How long one cell spends scrambling. */
  scrambleMs: number
  /** How long the shackle takes to drop. */
  lockMs: number
}

/** Every moment on the stage's timeline. */
export interface EnvelopeTimeline {
  /** The first call, sealing the first strip. */
  a: SealSchedule
  /** When the second strip's plain secret starts fading in. */
  plainBAt: number
  /** The second call, sealing the second strip. */
  b: SealSchedule
  /** When the sign between the two strips fades in. */
  signAt: number
  /** When the decrypt chip fades in. */
  decryptAt: number
  /** When the right key sets off for the first strip's lock. */
  keyAAt: number
  /** When the first strip's shackle starts lifting. */
  openAAt: number
  /** When the first strip's cells start unscrambling. */
  unsealAt: number
  /** When the wrong key sets off for the second strip's lock. */
  keyBAt: number
  /** When the second strip starts shaking against the wrong key. */
  jitterAt: number
  /** When the second strip's lock turns and the cross lands on it. */
  refuseAt: number
  /** When nothing is moving any more. */
  settledAt: number
}

/**
 * The moments one sealing passes through, given when it starts and how fast it runs.
 *
 * Each run waits for the one before it to finish growing, the cells wait for
 * the last run before them, and the tag starts as the last cell settles, so
 * the buffer is visibly written left to right.
 *
 * @param startMs - When the first salt block starts growing.
 * @param speed - How much faster than the reference durations this sealing runs; 1 is the reference.
 * @param config - The strip as the scene configured it.
 * @returns Every moment of that sealing, with the durations it was scaled to.
 * @example The first strip's schedule, at the reference speed
 * ```ts
 * sealSchedule(600, 1, config).sealedAt
 * ```
 */
export function sealSchedule(startMs: number, speed: number, config: EnvelopeConfig): SealSchedule {
  const blockStaggerMs = round(BLOCK_STAGGER_MS * speed)
  const blockGrowMs = round(BLOCK_GROW_MS * speed)
  const cellStaggerMs = round(CELL_STAGGER_MS * speed)
  const scrambleMs = round(SCRAMBLE_MS * speed)
  const lockMs = round(LOCK_MS * speed)
  const saltAt = startMs
  const ivAt = saltAt + config.salt.bytes * blockStaggerMs + round(50 * speed)
  const scrambleAt = ivAt + config.iv.bytes * blockStaggerMs + round(100 * speed)
  const tagAt = scrambleAt + (config.secret.length - 1) * cellStaggerMs + scrambleMs + round(60 * speed)
  const lockAt = tagAt + config.tag.bytes * blockStaggerMs - round(40 * speed)
  const closeAt = lockAt + round(200 * speed)
  return {
    saltAt,
    ivAt,
    scrambleAt,
    tagAt,
    lockAt,
    closeAt,
    sealedAt: closeAt + lockMs,
    blockStaggerMs,
    blockGrowMs,
    cellStaggerMs,
    scrambleMs,
    lockMs,
  }
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * @param config - The strip as the scene configured it.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * envelopeTimeline(config).settledAt
 * ```
 */
export function envelopeTimeline(config: EnvelopeConfig): EnvelopeTimeline {
  const a = sealSchedule(config.plainMs ?? 600, 1, config)
  const plainBAt = a.sealedAt + 250
  const b = sealSchedule(plainBAt + FADE_MS, REPEAT_SPEED, config)
  const signAt = b.sealedAt + 250
  const decryptAt = signAt + FADE_MS + 50
  const keyAAt = decryptAt + 150
  const openAAt = keyAAt + KEY_MS + 150
  const unsealAt = openAAt + 200
  const unsealedAt = unsealAt + (config.secret.length - 1) * UNSEAL_STAGGER_MS + SCRAMBLE_MS
  const keyBAt = unsealedAt + 200
  const jitterAt = keyBAt + KEY_MS + 100
  const refuseAt = jitterAt + 250
  return {
    a,
    plainBAt,
    b,
    signAt,
    decryptAt,
    keyAAt,
    openAAt,
    unsealAt,
    keyBAt,
    jitterAt,
    refuseAt,
    settledAt: refuseAt + FADE_MS + 100,
  }
}
