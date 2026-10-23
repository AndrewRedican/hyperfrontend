import type { Mark } from './banner'

/**
 * One problem a rule finds on the sheet, and what its fix writes in its place.
 *
 * The columns address the source text of the line as the scene lists it, so a
 * finding is stated the way a report states it: this line, these columns,
 * this rule, and the text the fix leaves behind.
 */
export interface MendFinding {
  /** Zero-based index of the line in the listing. */
  line: number
  /** Zero-based column the reported span starts at. */
  from: number
  /** Zero-based column the reported span ends before. */
  to: number
  /** The id of the rule that reports it, drawn beside the node it listens on. */
  rule: string
  /** What the fix writes over the span. */
  text: string
}

/** What a mend scene configures the stage with. */
export interface MendConfig {
  /** The package's identity mark, drawn on the command chip. */
  mark: Mark
  /** The file's name, written above the listing. */
  file: string
  /** The command the chip names. */
  command: string
  /** The flag that lights when the fixes are applied. */
  fixFlag: string
  /** The listing, one entry per line, blank lines included. */
  lines: readonly string[]
  /** The problems the rules find, in reading order. */
  findings: readonly MendFinding[]
  /** How long the reading beam spends on each line. */
  readLineMs: number
  /** How long the finished frame is held before the timeline ends. */
  restMs?: number
}
