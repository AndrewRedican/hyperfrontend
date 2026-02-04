/**
 * Individual validation error
 */
export interface ValidationError {
  /** Error message describing the problem */
  message: string
  /** Path to the property that failed validation */
  path?: string
  /** The value that failed validation */
  value?: unknown
  /** Optional error code for programmatic handling */
  code?: string
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[]
}

/**
 * Context for validation operations
 */
export interface ValidationContext {
  /** Whether to throw errors instead of returning result */
  strict?: boolean
  /** JSON schema to validate against (if applicable) */
  schema?: unknown
  /** Whether to collect all errors or stop at first */
  collectAllErrors?: boolean
}
