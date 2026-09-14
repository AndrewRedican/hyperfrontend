import type { VaultConfig } from '../models/vault'

/** How long the actors stand before the first copy is taken. */
const IDLE_MS = 600

/** How long after one copy leaves the shelf the next does. */
const CAPTURE_STAGGER_MS = 300

/** How long after the last copy lands the lid starts to close. */
const LID_DELAY_MS = 100

/** How long the locked vault rests before the intruder appears. */
const INTRUDER_DELAY_MS = 700

/** How long after the intruder settles its first bolt leaves. */
const BOLT_DELAY_MS = 150

/** How long after one bolt leaves the next does. */
const BOLT_STAGGER_MS = 200

/** How long the rewritten shelf rests before the first question is asked. */
const QUESTION_DELAY_MS = 700

/** How long the frame breathes between one answer landing and the next question leaving. */
const QUESTION_GAP_MS = 350

/** How long after the last answer lands the band appears under the copies' answers. */
const BAND_DELAY_MS = 150

/** How long the flash on a tile lasts when a copy is photographed off it. */
export const SNAP_MS = 350

/** How long a copy takes to fall from the shelf into the vault. */
export const FALL_MS = 800

/** How long the lid takes to slide shut. */
export const LID_MS = 400

/** How long the lock takes to pop onto the shut lid. */
export const LOCK_MS = 250

/** How long the intruder takes to slide in from the edge of the frame. */
export const SLIDE_MS = 700

/** How long a bolt takes to reach a tile. */
export const BOLT_MS = 450

/** How long a struck tile takes to flip over and come back rewritten. */
export const FLIP_MS = 400

/** How long a question dot takes to reach the tile or the chip. */
export const ASK_MS = 600

/** How long the tile or the chip holds the question before answering. */
export const DWELL_MS = 160

/** How long an answer takes to travel back to its slot. */
export const REPLY_MS = 600

/** How long a tile, a chip or the vault flashes when a question reaches it or a bolt strikes it. */
export const FLASH_MS = 500

/** How long an empty slot's outline takes to fade as its answer lands. */
export const SLOT_FADE_MS = 200

/** How long the band takes to appear. */
export const BAND_MS = 350

/** Every moment one built-in passes through. */
export interface PairSchedule {
  /** When the copy is photographed off the shelf and starts to fall. */
  captureAt: number
  /** When the copy lands as a chip in the vault. */
  landAt: number
  /** When the intruder's bolt leaves for the tile. */
  boltAt: number
  /** When the bolt strikes and the tile starts to flip. */
  hitAt: number
  /** When the tile has come back rewritten. */
  flippedAt: number
  /** When the shelf question leaves its slot. */
  shelfAskAt: number
  /** When the shelf's answer leaves the tile. */
  shelfReplyAt: number
  /** When the shelf's answer lands in its slot. */
  shelfLandAt: number
  /** When the vault question leaves its slot. */
  vaultAskAt: number
  /** When the copy's answer leaves the chip. */
  vaultReplyAt: number
  /** When the copy's answer lands in its slot. */
  vaultLandAt: number
}

/** Every moment on the stage's timeline. */
export interface VaultTimeline {
  /** When the lid starts to slide shut. */
  lidAt: number
  /** When the lid is shut and the lock starts to pop on. */
  lockedAt: number
  /** When the intruder starts to slide in. */
  intruderAt: number
  /** When the intruder is at rest over the shelf. */
  arrivedAt: number
  /** Each built-in's moments, in the scene's order. */
  pairs: readonly PairSchedule[]
  /** When the band starts to appear under the copies' answers. */
  bandAt: number
  /** When nothing moves any more. */
  settledAt: number
}

/** How long one question takes from leaving its slot to the next question leaving. */
const QUESTION_MS = ASK_MS + DWELL_MS + REPLY_MS + QUESTION_GAP_MS

/**
 * Work every moment of the timeline out from the scene's configuration.
 *
 * The beats run strictly in sequence: every copy is taken and the lid is
 * locked before the intruder appears, every tile is rewritten before the
 * first question is asked, and the questions go shelf then vault for each
 * built-in in turn, so the frame can only ever show a copy that was taken
 * before the tampering.
 *
 * @param config - The scene's configuration.
 * @returns Every moment, in milliseconds from the start.
 * @example When the first shelf question leaves
 * ```ts
 * vaultTimeline(config).pairs[0]?.shelfAskAt
 * ```
 */
export function vaultTimeline(config: VaultConfig): VaultTimeline {
  const count = config.pairs.length
  const captures = config.pairs.map((_, index) => IDLE_MS + index * CAPTURE_STAGGER_MS)
  const lastLand = (captures[count - 1] ?? IDLE_MS) + FALL_MS
  const lidAt = lastLand + LID_DELAY_MS
  const lockedAt = lidAt + LID_MS
  const intruderAt = lockedAt + LOCK_MS + INTRUDER_DELAY_MS
  const arrivedAt = intruderAt + SLIDE_MS
  const bolts = config.pairs.map((_, index) => arrivedAt + BOLT_DELAY_MS + index * BOLT_STAGGER_MS)
  const lastFlipped = (bolts[count - 1] ?? arrivedAt) + BOLT_MS + FLIP_MS
  const questionsAt = lastFlipped + QUESTION_DELAY_MS
  const pairs = config.pairs.map((_, index): PairSchedule => {
    const captureAt = captures[index] ?? IDLE_MS
    const boltAt = bolts[index] ?? arrivedAt
    const shelfAskAt = questionsAt + 2 * index * QUESTION_MS
    const vaultAskAt = shelfAskAt + QUESTION_MS
    return {
      captureAt,
      landAt: captureAt + FALL_MS,
      boltAt,
      hitAt: boltAt + BOLT_MS,
      flippedAt: boltAt + BOLT_MS + FLIP_MS,
      shelfAskAt,
      shelfReplyAt: shelfAskAt + ASK_MS + DWELL_MS,
      shelfLandAt: shelfAskAt + ASK_MS + DWELL_MS + REPLY_MS,
      vaultAskAt,
      vaultReplyAt: vaultAskAt + ASK_MS + DWELL_MS,
      vaultLandAt: vaultAskAt + ASK_MS + DWELL_MS + REPLY_MS,
    }
  })
  const lastAnswer = pairs[count - 1]?.vaultLandAt ?? questionsAt
  const bandAt = lastAnswer + BAND_DELAY_MS
  return { lidAt, lockedAt, intruderAt, arrivedAt, pairs, bandAt, settledAt: bandAt + BAND_MS }
}
