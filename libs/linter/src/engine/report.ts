/**
 * What a rule reports and what a file's lint produces: problems with offsets while the engine
 * works, positions once it answers.
 *
 * @module engine/report
 */

/** A replacement of one span of the text. */
export interface Fix {
  /** The offset of the first character replaced. */
  readonly start: number
  /** The offset after the last character replaced. */
  readonly end: number
  /** The replacement. */
  readonly text: string
}

/** A fix the user may choose to apply. */
export interface Suggestion {
  /** What applying it does, in words. */
  readonly message: string
  /** The replacement. */
  readonly fix: Fix
}

/** A position a rule names outright, for a language whose reports do not follow the offsets. */
export interface Location {
  /** The line, as printed. */
  readonly line: number
  /** The column, as printed. */
  readonly column: number
  /** The end line, or absent for a point. */
  readonly endLine?: number
  /** The end column, or absent for a point. */
  readonly endColumn?: number
}

/** What a rule reports, with offsets. */
export interface Problem {
  /** The offset where the problem starts; what the directives and the ordering go by. */
  readonly start: number
  /** The offset where it ends; absent when the rule names a point rather than a range. */
  readonly end?: number
  /** The position printed instead of the one the offsets give, when the rule names it. */
  readonly at?: Location
  /** The text shown to the user. */
  readonly message: string
  /** A fix, when the rule offers one. */
  readonly fix?: Fix
  /** Suggestions, when the rule offers any; they are reported, not applied. */
  readonly suggestions?: readonly Suggestion[]
}

/** A problem as the linter answers it. */
export interface Message {
  /** The rule id, or null for a fatal problem such as a parse error. */
  readonly ruleId: string | null
  /** 1 for a warning, 2 for an error. */
  readonly severity: 1 | 2
  /** The text shown to the user. */
  readonly message: string
  /** The 1-based start line, or null for a problem about the file as a whole. */
  readonly line: number | null
  /** The 1-based start column, or null for a problem about the file as a whole. */
  readonly column: number | null
  /** The 1-based end line, or null when the problem has no range. */
  readonly endLine: number | null
  /** The 1-based end column, or null when the problem has no range. */
  readonly endColumn: number | null
  /** True when the problem stopped linting. */
  readonly fatal: boolean
  /** The fix offered, or null. */
  readonly fix: Fix | null
  /** The suggestions offered. */
  readonly suggestions: readonly Suggestion[]
}

/** What linting one file produced. */
export interface FileResult {
  /** The absolute path. */
  readonly filePath: string
  /** The problems left after fixes and suppressions, in position order. */
  readonly messages: readonly Message[]
  /** The text after fixes, or null when nothing changed. */
  readonly output: string | null
}

/**
 * Orders messages by position, then rule.
 *
 * @param a - One message
 * @param b - Another
 * @returns Negative when `a` comes first
 *
 * @example Sort a file's messages for printing
 * ```ts
 * const ordered = [...messages].sort(compareMessages)
 * ```
 */
export function compareMessages(a: Message, b: Message): number {
  return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0) || (a.ruleId ?? '').localeCompare(b.ruleId ?? '')
}
