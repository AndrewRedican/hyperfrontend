import type { Mark } from './banner'

/** The two package names the frame carries. */
export interface SealedApi {
  /** The factory that makes an end of the channel, named above the sending end. */
  channel: string
  /** The callback a refused frame is reported through, named on the tray it lands in. */
  drop: string
  /** The package's mark, drawn beside both names. */
  mark: Mark
}

/** The two ends of the transport, named as the package readme's example names them. */
export interface SealedEnds {
  /** The end that seals and sends, on the left. */
  sender: string
  /** The end that opens, on the right. */
  receiver: string
}

/** Everything a scene tells the sealed stage. */
export interface SealedConfig {
  /** The calls whose behaviour the exchange shows. */
  api: SealedApi
  /** The two ends of the pipe. */
  ends: SealedEnds
  /** What the public material each end sends first is called; it rides with the token. */
  hello: string
  /**
   * How many messages are sealed, carried and opened before the replay.
   *
   * The counters run from 1 to this number, the listener copies the last of
   * them, and the comparison the receiver shows when it refuses the copy is
   * against this number.
   */
  messages: number
  /** The code the refused copy is reported with, written in the tray beside it. */
  replayCode: string
  /** How long the frame holds after the code is written. */
  restMs?: number
}
