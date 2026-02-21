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
 * Options for validation operations.
 */
export interface ValidateOptions {
  /** Whether to collect all errors or stop at first (default: true) */
  collectAllErrors?: boolean
  /** Whether to report errors for invalid regex patterns (default: false) */
  strictPatterns?: boolean
}
