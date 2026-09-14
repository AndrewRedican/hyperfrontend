import type { Mark } from './banner'
import type { ThemeTones } from './theme'

/** One board: a method of the stream, and the column each of its draws fell into. */
export interface GaltonBoard {
  /** The method call, as a reader would write it, set above the board. */
  label: string
  /** The tone the board's grains are coloured with. */
  tone: keyof ThemeTones
  /**
   * The column each draw landed in, in draw order.
   *
   * Every entry is an index from 0 to one less than the board's column count.
   * The sequence is the evidence: it is what the seeded stream produced, binned,
   * and nothing in the stage reorders or smooths it.
   */
  draws: readonly number[]
}

/** The package API the boards draw from. */
export interface GaltonApi {
  /** The call that opened the stream, as a reader would write it. */
  name: string
  /** The package's mark, drawn beside the name. */
  mark: Mark
}

/** Everything a scene tells the galton stage. */
export interface GaltonConfig {
  /** The call that opened the stream, set once above both boards. */
  api: GaltonApi
  /** The boards, left to right. */
  boards: readonly GaltonBoard[]
  /** How many columns every board has. */
  columns: number
  /** The values written under the two ends of every floor. */
  axis: readonly [string, string]
  /** When the first grain of every board is released. */
  startMs: number
  /** Time between one grain's release and the next, on each board. */
  everyMs: number
  /** How long a grain takes to fall from the top of the board to its resting place. */
  fallMs: number
  /** How long the frame rests after the last grain lands. */
  restMs: number
}
