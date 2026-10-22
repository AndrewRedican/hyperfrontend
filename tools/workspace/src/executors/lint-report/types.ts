/**
 * Entry parsed from lint output.
 */
export interface LintEntry {
  /** Relative file path from workspace root. */
  file: string

  /** Line number of the error/warning. */
  line: number

  /** Severity level. */
  severity: 'error' | 'warning'

  /** Error/warning message. */
  message: string

  /** Lint rule name. */
  rule: string
}

/**
 * Legend entry mapping code to rule details.
 */
export interface LegendEntry {
  /**  Short code (E1, W1, etc).  */
  code: string

  /** Severity level. */
  severity: 'error' | 'warning'

  /** Lint rule name. */
  rule: string

  /** Error/warning message. */
  message: string
}

/**
 * File-level aggregation for sorting.
 */
export interface FileStats {
  /**  Relative file path.  */
  file: string

  /**  Number of errors in this file.  */
  errorCount: number

  /**  Number of warnings in this file.  */
  warningCount: number

  /**  Total line count affected (for range size comparison).  */
  lineCount: number

  /**  Grouped entries by code.  */
  codeGroups: Map<string, number[]>
}

/**
 * Project whose lint task failed without reporting any lint error.
 */
export interface CrashedProject {
  /** Nx project name. */
  project: string

  /** Phrase describing how the lint command ended, null when the project was not rerun on its own. */
  failure: string | null

  /** Tail of the output of the project's own lint run, null when the project was not rerun on its own. */
  tail: string | null
}
