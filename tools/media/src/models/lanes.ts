import type { Mark } from './banner'

/**
 * What a lane wraps the function in.
 *
 * `plain` is the control: the function on its own, so a throw ends the lane.
 * `once` runs the function the first time and hands every later call the
 * stored result. `gate` reads a predicate before each call and skips the call
 * while it is false. `shield` lets every call through and swallows a throw.
 */
export type LaneKind = 'plain' | 'once' | 'gate' | 'shield'

/** One vertical lane of the frame. */
export interface Lane {
  /** Which wrapper the lane draws around the function. */
  kind: LaneKind
  /**
   * The name at the head of the lane.
   *
   * The package export for a wrapped lane, drawn as an API chip; the bare
   * function for the plain lane, drawn as a foreign label. A newline in the
   * name breaks the chip onto two lines, for an export too long for one.
   */
  name: string
}

/** One call, made to every lane at the same moment. */
export interface LaneCall {
  /** When the call's token appears at the top of the lanes. */
  atMs: number
  /** The argument, drawn on the token and collected in the tray when the call returns it. */
  arg: string
}

/** Everything a scene tells the lanes stage. */
export interface LanesConfig {
  /** The package's mark, drawn beside each wrapped lane's name. */
  mark: Mark
  /** The wrapped function's name, drawn in the box at the middle of every lane. */
  fn: string
  /** The name of the switch in the margin that the function and the gate read. */
  toggle: string
  /** The lanes, left to right. */
  lanes: readonly Lane[]
  /** The calls, in order. */
  calls: readonly LaneCall[]
  /** When the switch goes off; a call made while it is off makes the function throw. */
  offAtMs: number
  /** When the switch comes back on. */
  onAtMs: number
  /** How long the frame holds after the last call has settled. */
  restMs?: number
}
