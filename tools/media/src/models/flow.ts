/**
 * One side of an exchange.
 *
 * Two endpoints rather than an arbitrary number, because the thing worth
 * drawing is a conversation and a conversation with five participants is a
 * different diagram that should be a different stage.
 */
export interface FlowEndpoint {
  /** Name of the participant. */
  title: string
  /** One short line under the name, such as what it is running. */
  subtitle?: string
  /** A second line under that, for a state the participant is in. */
  note?: string
}

/** Which side of the exchange something comes from. */
export type FlowSide = 'left' | 'right'

/** How a delivered message is coloured in the log. */
export type FlowTone = 'plain' | 'muted' | 'accent' | 'success' | 'warning'

/** One message crossing between the endpoints. */
export interface FlowMessage {
  /** Which side sends it. */
  from: FlowSide
  /** What the message is called, as it appears on the wire and in the log. */
  label: string
  /** When it leaves its sender, measured from the start of the scene. */
  atMs: number
  /** How long it spends in flight. */
  flightMs?: number
  /** How the delivered message is coloured in the log. */
  tone?: FlowTone
  /**
   * What the message carries, in a few words.
   *
   * A protocol's message names say what step this is; they do not say what is
   * actually crossing, and the payload is usually the interesting half. It is
   * set smaller under the name on the wire and after it in the log.
   */
  detail?: string
  /**
   * How often the message repeats after the first one.
   *
   * For the traffic that is a cadence rather than an event: a heartbeat is one
   * fact about a session, not eight, so it pulses on the wire on this interval
   * and takes a single line in the log with a count beside it.
   */
  repeatEveryMs?: number
  /** When the repetition stops; ignored unless the message repeats. */
  repeatUntilMs?: number
}

/** A named stretch of the exchange, called out while it is happening. */
export interface FlowPhase {
  /** When this stretch begins. */
  atMs: number
  /** What is happening in it. */
  label: string
}

/** Everything a scene tells the flow stage. */
export interface FlowConfig {
  /** The participant on the left. */
  left: FlowEndpoint
  /** The participant on the right. */
  right: FlowEndpoint
  /** What crosses between them, in any order; the stage sorts by time. */
  messages: readonly FlowMessage[]
  /** Named stretches of the exchange, called out as each begins. */
  phases?: readonly FlowPhase[]
  /** A line under the diagram once the last message has landed. */
  settled?: string
  /** How long the diagram holds after the last message lands. */
  restMs?: number
}
