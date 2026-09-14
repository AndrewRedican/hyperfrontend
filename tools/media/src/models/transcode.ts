import type { Mark } from './banner'

/** One character of the text, and the bytes it is written as. */
export interface TranscodeCharacter {
  /** The character, as it is shown in its tile. */
  glyph: string
  /** Its UTF-8 bytes, each as two upper-case hex digits. */
  bytes: readonly string[]
}

/** The package calls the frame names. */
export interface TranscodeApi {
  /** The call that turns the text into its encoding, named beside the result as it forms. */
  encode: string
  /** The call that turns the encoding back into the text, named beside the result as it folds away. */
  decode: string
  /** The package's mark, drawn beside both names. */
  mark: Mark
}

/**
 * The platform call the package is compared with, and what it makes of the same text.
 *
 * The platform's encoder reads one character of the text as a single byte
 * where the package reads it as several, and the encoding it returns differs
 * from the package's from that byte's first character on.
 */
export interface TranscodeForeign {
  /** The platform function's name, such as `btoa`. */
  name: string
  /** Index of the character it misreads. */
  character: number
  /** The single byte it reads that character as. */
  byte: string
  /** What it returns for the whole text. */
  encoded: string
}

/** Everything a scene tells the transcode stage. */
export interface TranscodeConfig {
  /** The calls whose behaviour the crossing shows. */
  api: TranscodeApi
  /** The text, one tile per character, with the bytes each becomes. */
  characters: readonly TranscodeCharacter[]
  /** What the package encodes the text as, one tile per character. */
  encoded: string
  /** The platform call, and the encoding it returns instead. */
  foreign: TranscodeForeign
  /** How long the text is shown alone before its first byte drops. */
  plainMs?: number
  /** How long the frame holds after the text is restored. */
  restMs?: number
}
