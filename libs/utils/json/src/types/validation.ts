/**
 * Individual validation error.
 */
export interface ValidationError {
  /** Human-readable error message */
  message: string
  /** JSON Pointer path to the failing property (e.g., '/foo/bar/0') */
  path: string
  /** The value that failed validation */
  instance?: unknown
  /** Optional error code for programmatic handling */
  code?: string
  /** Additional error parameters */
  params?: Record<string, unknown>
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[]
}

/**
 * Result of a pattern safety check.
 */
export interface PatternSafetyResult {
  /** Whether the pattern is considered safe */
  safe: boolean
  /** Reason if unsafe (for error reporting) */
  reason?: string
}

/**
 * Function type for custom pattern safety checkers.
 * Users can provide their own implementation (e.g., using safe-regex2).
 *
 * @param pattern - The regex pattern string to check
 * @returns Result indicating if the pattern is safe
 *
 * @example
 * ```typescript
 * import safeRegex from 'safe-regex2'
 *
 * const checker: PatternSafetyChecker = (pattern) => ({
 *   safe: safeRegex(pattern),
 *   reason: 'Pattern may cause catastrophic backtracking'
 * })
 *
 * validate(data, schema, { patternSafetyChecker: checker })
 * ```
 */
export type PatternSafetyChecker = (pattern: string) => PatternSafetyResult

/**
 * Options for validation operations.
 */
export interface ValidateOptions {
  /** Whether to collect all errors or stop at first (default: true) */
  collectAllErrors?: boolean
  /** Whether to report errors for invalid regex patterns (default: false) */
  strictPatterns?: boolean
  /**
   * Whether to check patterns for ReDoS vulnerabilities (default: false).
   * When true, uses built-in heuristics to detect common dangerous patterns.
   * When a function is provided, uses that function for safety checking.
   *
   * Built-in heuristics catch obvious cases like nested quantifiers.
   * For comprehensive protection, provide a custom checker using safe-regex2.
   */
  safePatterns?: boolean | PatternSafetyChecker
}
