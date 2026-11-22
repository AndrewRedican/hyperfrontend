import type { Mark } from './banner'

/** One step of the service, drawn as a pane both lanes cross. */
export interface HairpinStep {
  /** The step's name as a reader would import it, drawn as a chip above its pane. */
  name: string
  /**
   * Whether the step marks a response that comes back through it.
   *
   * A step that does is crossed twice by every request it lets past: once on
   * the way in, where nothing happens, and once on the way out, where the
   * returning value gains a band.
   */
  decorates?: boolean
  /** How long a request this step answers rests at the head of the turn before its value sets off back. */
  workMs?: number
}

/** One request sent to the service. */
export interface HairpinRequest {
  /** When it enters the frame. */
  atMs: number
  /** Index of the step that answers it, where its path turns. */
  answeredBy: number
}

/** Everything a scene tells the hairpin stage. */
export interface HairpinConfig {
  /** The package's mark, drawn on every chip. */
  mark: Mark
  /** The call that runs the service as a process, drawn as a chip on the edge of the process. */
  runner: string
  /** The steps, outermost first. */
  steps: readonly HairpinStep[]
  /** The requests, in the order they are sent. */
  requests: readonly HairpinRequest[]
  /** The stop signal's platform name, set plainly beside the wire it arrives on. */
  signal: string
  /**
   * When the signal reaches the process and its way in starts to close.
   *
   * A request that has not reached the way in by then is refused; one that
   * has is in flight and is answered.
   */
  stopAtMs: number
  /** The code the process ends with, shown where the wire from the process ends. */
  exitCode: number
  /** How far a request travels in a second, in CSS pixels of the compact frame. */
  speed: number
  /** How long the frame holds after the code lands. */
  restMs?: number
}
