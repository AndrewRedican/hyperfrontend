import type { Mark } from './banner'

/** One line of the spec listing. */
export interface BridgeLine {
  /** Spaces before the line's first character. */
  indent?: number
  /** The package export the line starts with, drawn as a chip; omitted for a line that is only text. */
  api?: string
  /** The characters after the chip, or the whole line when there is no chip; empty for a blank line. */
  text: string
  /** Index of the primitive the line rests on, which its wire draws to once it is typed; omitted for a line that rests on none. */
  rests?: number
  /** Whether this is the test the run reports on: it gets the check once the verdict comes back. */
  verdict?: boolean
}

/** One platform primitive the spec runs on. */
export interface BridgePrimitive {
  /** The name as a reader would write it. */
  name: string
  /** Whether the label keeps a count of the lines wired to it. */
  tally?: boolean
}

/** One number of the coverage figure. */
export interface BridgeFigure {
  /** The column's heading, as the table prints it. */
  label: string
  /** The percentage the number counts up to. */
  value: number
}

/** The figure the run closes on. */
export interface BridgeReport {
  /** The package entry that produces the figure, drawn as a chip beside it. */
  api: string
  /** The numbers, left to right. */
  figures: readonly BridgeFigure[]
}

/** Everything a scene tells the bridge stage. */
export interface BridgeConfig {
  /** The package's mark, drawn on every chip. */
  mark: Mark
  /** The spec file's name, set quietly at the top of the sheet. */
  file: string
  /** The listing, top to bottom. */
  lines: readonly BridgeLine[]
  /** The primitives, top to bottom. */
  primitives: readonly BridgePrimitive[]
  /** When the first line starts typing. */
  typeAtMs: number
  /** How fast the lines type, in characters per second. */
  typeCps: number
  /** The coverage figure and the tick that lands beside it. */
  report: BridgeReport
  /** How long the frame holds after the tick lands. */
  restMs?: number
}
