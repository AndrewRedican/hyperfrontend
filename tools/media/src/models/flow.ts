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
}

/** Which side of the exchange something comes from. */
export type FlowSide = 'left' | 'right'

/** How a delivered message is coloured in the log. */
export type FlowTone = 'plain' | 'muted' | 'accent' | 'success'

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
}

/**
 * A flow diagram's look, as a set of colours.
 *
 * The same shape as a terminal theme and for the same reason: keeping the look
 * entirely in data is what lets one implementation carry several treatments
 * without any of them being a second implementation.
 */
export interface FlowTheme {
  /** Name a scene selects this theme by. */
  id: string
  /** The surface the diagram sits on. */
  backdrop: string
  /** An endpoint panel's surface. */
  panel: string
  /** An endpoint panel's outline. */
  panelBorder: string
  /** An endpoint panel's outline while it is sending or receiving. */
  panelActive: string
  /** The line messages travel along. */
  wire: string
  /** A message in flight. */
  packet: string
  /** Colour of an endpoint's name. */
  title: string
  /** Colour of an endpoint's second line. */
  subtitle: string
  /** Colour each tone is written in. */
  tones: Readonly<Record<FlowTone, string>>
}

/** A theme as a scene states it: a built-in name, or one written out in full. */
export type FlowThemeRef = string | FlowTheme

/** Everything a scene tells the flow stage. */
export interface FlowConfig {
  /** The visual treatment, defaulting to the first built-in theme. */
  theme?: FlowThemeRef
  /** The participant on the left. */
  left: FlowEndpoint
  /** The participant on the right. */
  right: FlowEndpoint
  /** What crosses between them, in any order; the stage sorts by time. */
  messages: readonly FlowMessage[]
  /** A line under the diagram once the last message has landed. */
  settled?: string
  /** How long the diagram holds after the last message lands. */
  restMs?: number
}
