import type { TranscodeConfig } from '../models/transcode'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { CHARS_PER_GROUP } from './layout'

/** How far apart consecutive characters release their bytes. */
const DROP_STAGGER_MS = 400

/** How far apart the bytes of one character release. */
const BYTE_STAGGER_MS = 150

/** How far apart consecutive result tiles are drawn out of a funnel. */
const EMERGE_STAGGER_MS = 120

/** How far apart consecutive tiles of the platform's result peel off. */
const GHOST_STAGGER_MS = 100

/** How long a byte takes to drop from its character to the byte row. */
export const DROP_MS = 500

/** How long the byte row takes to close up into threes. */
export const REGROUP_MS = 280

/** How long a funnel takes to draw from its top edge to its bottom. */
export const FUNNEL_MS = 300

/** How long a result tile takes to come out of its funnel. */
export const EMERGE_MS = 550

/** How long a fade of a chip, a label, a band or a padding slot takes. */
export const FADE_MS = 300

/** How long the misread pair flashes before it collapses. */
export const FLASH_MS = 500

/** How long two byte tiles take to collapse into one, and to separate again. */
export const COLLAPSE_MS = 400

/** How long one tile of the platform's result takes to peel off the package's. */
export const GHOST_MS = 350

/** How long the line through the wrong tail takes to draw. */
export const STRIKE_MS = 300

/** How long one row takes to fold back into the row above it. */
export const FOLD_MS = 500

/** Every moment on the stage's timeline. */
export interface TranscodeTimeline {
  /** When each byte starts dropping, in text order. */
  dropAt: readonly number[]
  /** When the encode chip fades in. */
  encodeChipAt: number
  /** When the byte row starts closing up into threes. */
  regroupAt: number
  /** When the padding slots fade in. */
  padAt: number
  /** When each funnel starts drawing, group by group. */
  funnelAt: readonly number[]
  /** When each result tile starts coming out of its funnel. */
  emergeAt: readonly number[]
  /** When the band under the result fades in. */
  bandAt: number
  /** When the platform label fades in. */
  foreignAt: number
  /** When the misread pair starts flashing. */
  flashAt: number
  /** When the misread pair starts collapsing into one byte. */
  collapseAt: number
  /** When the padding slot the collapse leaves behind fades in. */
  ghostPadAt: number
  /** When each tile of the platform's result starts peeling off. */
  ghostAt: readonly number[]
  /** When the line through the wrong tail starts drawing. */
  strikeAt: number
  /** When everything the platform call drew starts fading, and the collapsed byte separates again. */
  ghostOutAt: number
  /** When the decode chip takes the encode chip's place. */
  decodeChipAt: number
  /** When the result row starts folding into the byte row. */
  foldCAt: number
  /** When the byte row starts folding into the character row. */
  foldBAt: number
  /** When the text is back on its own and its band fades in. */
  restoredAt: number
  /** When nothing is moving any more. */
  settledAt: number
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * Each beat waits for the one before it to land and then holds for a moment,
 * so a change is seen as a change before the next thing starts.
 *
 * @param config - The crossing as the scene configured it.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * transcodeTimeline(config).settledAt
 * ```
 */
export function transcodeTimeline(config: TranscodeConfig): TranscodeTimeline {
  const dropAt: number[] = []
  const plainMs = config.plainMs ?? 800
  config.characters.forEach((character, index) => {
    character.bytes.forEach((_, ordinal) => {
      dropAt.push(plainMs + index * DROP_STAGGER_MS + ordinal * BYTE_STAGGER_MS)
    })
  })
  const bytesDoneAt = dropAt.reduce((latest, at) => max(latest, at), 0) + DROP_MS
  const encodeChipAt = bytesDoneAt + 400
  const regroupAt = encodeChipAt + 200
  const padAt = regroupAt + 200
  const funnelAt: number[] = []
  const emergeAt: number[] = []
  // why: the next funnel starts while the last tile of the previous one is still settling, so the two halves of the result read as one pour rather than two
  let cursor = regroupAt + REGROUP_MS + 80
  for (let index = 0; index < config.encoded.length; index += 1) {
    if (index % CHARS_PER_GROUP === 0) {
      funnelAt.push(cursor)
      cursor += 200
    }
    emergeAt.push(cursor)
    cursor += EMERGE_STAGGER_MS
    if (index % CHARS_PER_GROUP === CHARS_PER_GROUP - 1) {
      cursor += 130
    }
  }
  const lastEmergeAt = emergeAt.reduce((latest, at) => max(latest, at), 0)
  const bandAt = lastEmergeAt + EMERGE_MS + 50
  // why: the finished encoding rests on its band before the comparison starts, so the payoff is seen before it is questioned
  const foreignAt = bandAt + FADE_MS + 650
  const flashAt = foreignAt + 200
  const collapseAt = flashAt + FLASH_MS - 100
  const ghostPadAt = collapseAt + 200
  const ghostAt: number[] = []
  const ghostStart = collapseAt + COLLAPSE_MS + 100
  for (let index = 0; index < config.foreign.encoded.length; index += 1) {
    ghostAt.push(ghostStart + index * GHOST_STAGGER_MS)
  }
  const strikeAt = ghostStart + (config.foreign.encoded.length - 1) * GHOST_STAGGER_MS + GHOST_MS + 100
  const ghostOutAt = strikeAt + STRIKE_MS + 800
  const decodeChipAt = ghostOutAt + 100
  const foldCAt = decodeChipAt + 250
  const foldBAt = foldCAt + FOLD_MS - 100
  const restoredAt = foldBAt + FOLD_MS + 50
  return {
    dropAt,
    encodeChipAt,
    regroupAt,
    padAt,
    funnelAt,
    emergeAt,
    bandAt,
    foreignAt,
    flashAt,
    collapseAt,
    ghostPadAt,
    ghostAt,
    strikeAt,
    ghostOutAt,
    decodeChipAt,
    foldCAt,
    foldBAt,
    restoredAt,
    settledAt: restoredAt + FADE_MS,
  }
}
