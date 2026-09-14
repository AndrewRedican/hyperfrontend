import type { MediaProfile } from '../models/profile'
import type { TranscodeConfig } from '../models/transcode'
import { ceil, floor, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { lerp } from '../lib/motion'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** How many bytes one group of the encoding is made from. */
export const BYTES_PER_GROUP = 3

/** How many characters one group of bytes encodes to. */
export const CHARS_PER_GROUP = 4

/** How the frame is sized for the surface it is being drawn for. */
export interface TranscodeMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Side of a character tile. */
  charPx: number
  /** Gap between two character tiles. */
  charGapPx: number
  /** Font size of the character in its tile. */
  charFontPx: number
  /** Side of a byte tile. */
  bytePx: number
  /** Gap between the two byte tiles of one character, as they land. */
  byteFanPx: number
  /** Gap between two byte tiles of one group, once regrouped. */
  slotGapPx: number
  /** Font size of the hex in a byte tile. */
  byteFontPx: number
  /** Side of a result tile. */
  resultPx: number
  /** Gap between two result tiles of one group. */
  resultGapPx: number
  /** Font size of the character in a result tile. */
  resultFontPx: number
  /** Gap between two groups, measured on the result row. */
  groupGapPx: number
  /** Font size of the API chips and the platform label. */
  chipPx: number
  /** Gap between a chip and the row it stands beside. */
  chipGapPx: number
  /** Vertical centre of the character row. */
  rowAY: number
  /** Vertical centre of the byte row. */
  rowBY: number
  /** Vertical centre of the result row. */
  rowCY: number
  /** Vertical centre of the platform's result, under the package's. */
  ghostY: number
  /** Gap between a funnel and the rows above and below it. */
  funnelPadPx: number
}

/** One byte tile, and where it sits at each stage of the crossing. */
export interface ByteSlot {
  /** The hex the tile shows. */
  hex: string
  /** Index of the character it came from. */
  character: number
  /** Which of that character's bytes it is. */
  ordinal: number
  /** Horizontal centre once it has dropped, directly under its character. */
  landedX: number
  /** Horizontal centre once regrouped into threes. */
  groupedX: number
  /** Which group of three it belongs to. */
  group: number
}

/** One tile of the result row. */
export interface ResultSlot {
  /** The character the tile shows. */
  glyph: string
  /** Horizontal centre. */
  x: number
  /** Which group of four it belongs to. */
  group: number
  /** Horizontal centre of the place in the byte row it is drawn out of. */
  sourceX: number
}

/** Where everything sits, measured once and read by every frame. */
export interface TranscodeLayout {
  /** Horizontal centre of each character tile. */
  characters: readonly number[]
  /** Every byte, in text order. */
  bytes: readonly ByteSlot[]
  /** Horizontal centre of every slot of the byte row, the empty padding slots included. */
  slots: readonly number[]
  /** Every result tile, in order. */
  results: readonly ResultSlot[]
  /** How many groups the byte row regroups into. */
  groups: number
  /** Left edge of the byte row once regrouped. */
  bytesLeft: number
  /** Left edge of the result row. */
  resultsLeft: number
  /** Right edge of the result row. */
  resultsRight: number
  /** Left edge of the character row. */
  charsLeft: number
  /** Right edge of the character row. */
  charsRight: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * Everything scales with the profile's width, so the wide profile gets the
 * same composition at a larger size rather than the same size with more room
 * around it.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's character tile
 * ```ts
 * transcodeMetrics(resolveProfile('compact')).charPx // 40
 * ```
 */
export function transcodeMetrics(profile: MediaProfile): TranscodeMetrics {
  const unit = profile.width / DESIGN_WIDTH
  return {
    insetPx: round(18 * unit),
    charPx: round(40 * unit),
    charGapPx: round(22 * unit),
    charFontPx: round(22 * unit),
    bytePx: round(36 * unit),
    byteFanPx: round(4 * unit),
    slotGapPx: round(6 * unit),
    byteFontPx: round(13 * unit),
    resultPx: round(32 * unit),
    resultGapPx: round(6 * unit),
    resultFontPx: round(15 * unit),
    groupGapPx: round(26 * unit),
    chipPx: round(12 * unit),
    chipGapPx: round(16 * unit),
    rowAY: round(85 * unit),
    rowBY: round(175 * unit),
    rowCY: round(265 * unit),
    ghostY: round(312 * unit),
    funnelPadPx: round(6 * unit),
  }
}

/**
 * Lay the three rows out across the frame.
 *
 * The character row is centred on its own. The byte row lands under the
 * characters, one tile under each single-byte character and a fanned pair
 * under a two-byte one, and then regroups into threes whose centres line up
 * with the fours of the result row, so the funnels between the two rows are
 * symmetric and the resolved picture is centred.
 *
 * @param config - The crossing as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @param profile - The presentation target being composed for.
 * @returns Where every tile sits at every stage.
 * @example Where the first result tile is drawn out of
 * ```ts
 * transcodeLayout(config, transcodeMetrics(profile), profile).results[0]?.sourceX
 * ```
 */
export function transcodeLayout(config: TranscodeConfig, metrics: TranscodeMetrics, profile: MediaProfile): TranscodeLayout {
  const centre = profile.width / 2
  const charPitch = metrics.charPx + metrics.charGapPx
  const charsWidth = config.characters.length * charPitch - metrics.charGapPx
  const charsLeft = round(centre - charsWidth / 2)
  const characters = config.characters.map((_, index) => charsLeft + metrics.charPx / 2 + index * charPitch)

  const byteCount = config.characters.reduce((sum, character) => sum + character.bytes.length, 0)
  const groups = ceil(byteCount / BYTES_PER_GROUP)
  const resultGroupWidth = CHARS_PER_GROUP * metrics.resultPx + (CHARS_PER_GROUP - 1) * metrics.resultGapPx
  const groupPitch = resultGroupWidth + metrics.groupGapPx
  const groupCentre = (group: number): number => centre + (group - (groups - 1) / 2) * groupPitch
  const bytePitch = metrics.bytePx + metrics.slotGapPx
  const slots: number[] = []
  for (let slot = 0; slot < groups * BYTES_PER_GROUP; slot += 1) {
    const group = floor(slot / BYTES_PER_GROUP)
    slots.push(groupCentre(group) + ((slot % BYTES_PER_GROUP) - (BYTES_PER_GROUP - 1) / 2) * bytePitch)
  }

  const bytes: ByteSlot[] = []
  config.characters.forEach((character, characterIndex) => {
    const fanPitch = metrics.bytePx + metrics.byteFanPx
    character.bytes.forEach((hex, ordinal) => {
      const slot = bytes.length
      bytes.push({
        hex,
        character: characterIndex,
        ordinal,
        landedX: (characters[characterIndex] ?? centre) + (ordinal - (character.bytes.length - 1) / 2) * fanPitch,
        groupedX: slots[slot] ?? centre,
        group: floor(slot / BYTES_PER_GROUP),
      })
    })
  })

  const resultPitch = metrics.resultPx + metrics.resultGapPx
  const results: ResultSlot[] = []
  for (let index = 0; index < config.encoded.length; index += 1) {
    const group = floor(index / CHARS_PER_GROUP)
    const ordinal = index % CHARS_PER_GROUP
    const firstSlot = slots[group * BYTES_PER_GROUP] ?? centre
    const lastSlot = slots[group * BYTES_PER_GROUP + BYTES_PER_GROUP - 1] ?? centre
    results.push({
      glyph: config.encoded[index] ?? '',
      x: groupCentre(group) + (ordinal - (CHARS_PER_GROUP - 1) / 2) * resultPitch,
      group,
      // why: the first character of a group is made from the first byte and the last from the last, so each tile is drawn out of the place along the three bytes its bits came from
      sourceX: lerp(firstSlot, lastSlot, ordinal / (CHARS_PER_GROUP - 1)),
    })
  }

  const firstSlot = slots[0] ?? centre
  const firstResult = results[0]?.x ?? centre
  const lastResult = results[results.length - 1]?.x ?? centre
  return {
    characters,
    bytes,
    slots,
    results,
    groups,
    bytesLeft: firstSlot - metrics.bytePx / 2,
    resultsLeft: firstResult - metrics.resultPx / 2,
    resultsRight: lastResult + metrics.resultPx / 2,
    charsLeft,
    charsRight: charsLeft + charsWidth,
  }
}
