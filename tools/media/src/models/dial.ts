/** How a dial is coloured. */
export type DialTone = 'accent' | 'success' | 'warning' | 'danger'

/** One value a dial is known to hold, at one moment. */
export interface DialStop {
  /** When the dial holds this value, measured from the start of the scene. */
  atMs: number
  /** What it holds. */
  value: number
}

/** One countdown, drawn as a ring draining. */
export interface Dial {
  /** What the dial stands for, set over it. */
  title: string
  /** The value the ring is full at. */
  max: number
  /** Set after the readout. */
  unit?: string
  /** Digits after the point in the readout. */
  decimals?: number
  /** What it holds, and when; in any order, the stage sorts by time. */
  stops: readonly DialStop[]
  /** How the ring and readout are coloured. */
  tone?: DialTone
  /** Named moments the dial passes through, shown under it while they last. */
  states?: readonly DialState[]
  /** What the dial ends on, set under it once it has stopped. */
  outcome?: string
  /** How the outcome is coloured. */
  outcomeTone?: DialTone
}

/** A word under a dial for a stretch of the timeline. */
export interface DialState {
  /** When the word appears. */
  atMs: number
  /** When it leaves. */
  untilMs: number
  /** The word. */
  label: string
  /** How it is coloured. */
  tone?: DialTone
}

/** A card that slides over the dials for a while: the interruption. */
export interface DialOverlay {
  /** When the card arrives. */
  atMs: number
  /** When it leaves. */
  untilMs: number
  /** The card's title. */
  title: string
  /** One line under the title. */
  detail: string
  /** The one button the card offers, or undefined for a card with none. */
  action?: string
}

/** Everything a scene tells the dial stage. */
export interface DialConfig {
  /** One line over the dials, naming what the frame is about. */
  heading?: string
  /** One line under them, arriving once every dial has stopped. */
  caption?: string
  /** The dials, left to right. */
  dials: readonly Dial[]
  /** The interruption, if the scene has one. */
  overlay?: DialOverlay
  /** How long the frame holds after the last stop. */
  restMs?: number
}
