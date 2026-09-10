/** How a track is coloured. */
export type GaugeTone = 'plain' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'

/** One value a track is known to hold, at one moment. */
export interface GaugeStop {
  /** When the track holds this value, measured from the start of the scene. */
  atMs: number
  /** What it holds. */
  value: number
}

/**
 * One quantity, and everything it does over the length of the scene.
 *
 * The value between two stops is interpolated, which is what makes a stated
 * list of moments into a moving bar. Two stops with different numbers are a
 * bar filling; two with the same number are a bar deliberately holding still,
 * which is how a paused countdown is said.
 */
export interface GaugeTrack {
  /** What the quantity is called. */
  label: string
  /** The value the track is full at. */
  max: number
  /** What it holds, and when; in any order, the stage sorts by time. */
  stops: readonly GaugeStop[]
  /** How the bar and its readout are coloured. */
  tone?: GaugeTone
  /** Set after the readout, such as `s` or `%`. */
  unit?: string
  /** Digits after the point in the readout; defaults to none. */
  decimals?: number
  /** A short line under the label, for what the number means. */
  note?: string
}

/** A set of tracks read together. */
export interface GaugeGroup {
  /** A short heading over the set. */
  title?: string
  /** The quantities, in the order they are drawn. */
  tracks: readonly GaugeTrack[]
  /**
   * Whether the bars run across or up.
   *
   * `row` is the default and is for a handful of named quantities read against
   * each other. `column` stands them on end and drops the readouts, which is
   * what twenty bins of a distribution need to be legible at all.
   */
  orientation?: 'row' | 'column'
}

/**
 * A gauge stage's look, as a set of colours.
 *
 * The same shape of idea as the other stages' themes: the treatment is data,
 * so one implementation carries several looks.
 */
export interface GaugeTheme {
  /** Name a scene selects this theme by. */
  id: string
  /** The surface the frame sits on. */
  backdrop: string
  /** A group's surface. */
  panel: string
  /** A group's outline. */
  panelBorder: string
  /** The empty part of a track. */
  trough: string
  /** Colour of a group's heading. */
  title: string
  /** Colour of a track's label. */
  label: string
  /** Colour of the line under a label. */
  note: string
  /** Colour each tone fills and reads out in. */
  tones: Readonly<Record<GaugeTone, string>>
}

/** A theme as a scene states it: a built-in name, or one written out in full. */
export type GaugeThemeRef = string | GaugeTheme

/** Everything a scene tells the gauge stage. */
export interface GaugeConfig {
  /** The visual treatment, defaulting to the first built-in theme. */
  theme?: GaugeThemeRef
  /** One line over the groups, naming what the frame is about. */
  heading?: string
  /** One line under them, arriving once every track has settled. */
  caption?: string
  /** The sets of quantities, left to right. */
  groups: readonly GaugeGroup[]
  /** Stack the groups rather than setting them side by side. */
  stacked?: boolean
  /** How long the frame holds after the last stop. */
  restMs?: number
}
