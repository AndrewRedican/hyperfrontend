/** How a row is coloured. */
export type PanelTone = 'plain' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'

/**
 * What a panel holds, which decides how its rows are set.
 *
 * `code` is source: monospace, tokenised, and usually typed rather than
 * revealed. `result` is what running it produced: monospace as well, because a
 * value is a value, but marked in the margin so the eye can tell an answer from
 * the question. `note` is prose about either.
 */
export type PanelKind = 'code' | 'result' | 'note'

/** One line inside a panel. */
export interface PanelRow {
  /** The line itself. */
  text: string
  /** When it arrives, measured from the start of the scene. */
  atMs: number
  /**
   * When it leaves again.
   *
   * A panel is usually a listing that fills, and a row that has arrived stays.
   * A panel standing in for a surface that repaints itself is the exception: a
   * prompt's option list is on screen while the question is open and gone once
   * it is answered, and without a way to say so the collapsed answer would have
   * to be drawn under the options it replaced.
   */
  untilMs?: number
  /** How it is coloured. */
  tone?: PanelTone
  /** How long the line takes to type itself; omitted, it simply appears. */
  typeMs?: number
  /** Draw the line on a lit band, for the one line the frame is about. */
  emphasis?: boolean
  /** Strike the line through, for something that was true and is not. */
  strike?: boolean
  /** A short label set in the margin, in place of the kind's own marker. */
  marker?: string
}

/** One column of the frame. */
export interface Panel {
  /** A short heading over the column. */
  title?: string
  /** What the column holds. */
  kind: PanelKind
  /** The lines, in any order; the stage sorts by arrival. */
  rows: readonly PanelRow[]
  /** Relative width, against the other panels; defaults to 1. */
  weight?: number
  /**
   * Where the rows sit in a column taller than they are.
   *
   * A session fills from the top because that is what a terminal does. A short
   * listing beside a long one reads better centred, which is the difference
   * between a column with room in it and a column that looks unfinished.
   */
  align?: 'top' | 'center' | 'bottom'
  /**
   * Draw the column as a terminal window rather than as a plain pane.
   *
   * For the panels that are standing in for a session rather than for a
   * listing. The bar carries the panel's title, so a column with chrome and no
   * title gets a bar with nothing in it, which is what a terminal looks like.
   */
  chrome?: boolean
}

/**
 * A panel stage's look, as a set of colours.
 *
 * The same shape of idea as the terminal and flow themes: the treatment is
 * data, so one implementation carries several looks and a scene can hand over
 * a whole theme of its own without touching this package.
 */
export interface PanelTheme {
  /** Name a scene selects this theme by. */
  id: string
  /** The surface the frame sits on. */
  backdrop: string
  /** A panel's own surface. */
  panel: string
  /** A panel's outline. */
  panelBorder: string
  /** The rule between a panel's title and its rows. */
  rule: string
  /** Colour of a panel's title. */
  title: string
  /** Colour of the marker set in a result row's margin. */
  marker: string
  /** The band an emphasised row is drawn on. */
  emphasis: string
  /** The bar over a column drawn with chrome. */
  chrome: string
  /** The three dots in that bar. */
  buttons: readonly [string, string, string]
  /** Colour of the caret at the end of a line still being typed. */
  cursor: string
  /** Colour each tone is written in. */
  tones: Readonly<Record<PanelTone, string>>
  /** Colours the code tokeniser paints with. */
  syntax: PanelSyntaxColours
}

/** What the tokeniser colours, and with what. */
export interface PanelSyntaxColours {
  /** Anything from `//` to the end of the line. */
  comment: string
  /** A quoted or backticked run. */
  string: string
  /** A bare number. */
  number: string
  /** One of the language's own words. */
  keyword: string
  /** A name immediately before an opening parenthesis. */
  call: string
  /** Braces, brackets, commas and operators. */
  punctuation: string
}

/** A theme as a scene states it: a built-in name, or one written out in full. */
export type PanelThemeRef = string | PanelTheme

/** Everything a scene tells the panel stage. */
export interface PanelConfig {
  /** The visual treatment, defaulting to the first built-in theme. */
  theme?: PanelThemeRef
  /** One line over the panels, naming what the frame is about. */
  heading?: string
  /** One line under them, arriving once every row has. */
  caption?: string
  /** The columns, left to right. */
  panels: readonly Panel[]
  /** Stack the panels rather than setting them side by side. */
  stacked?: boolean
  /** How long the frame holds after the last row lands. */
  restMs?: number
}
