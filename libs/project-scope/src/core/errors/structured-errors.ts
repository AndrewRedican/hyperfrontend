import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Structured error with code and context.
 */
export interface StructuredError extends Error {
  /** Machine-readable error code for programmatic handling */
  code: string
  /** Additional contextual information about the error */
  context?: Record<string, unknown>
}

/**
 * Create a structured error with code and optional context.
 *
 * @param message - The human-readable error message
 * @param code - The machine-readable error code for programmatic handling
 * @param context - Additional contextual information about the error
 * @returns Structured error instance with code and context properties
 *
 * @example
 * ```typescript
 * import { createStructuredError } from '@hyperfrontend/project-scope'
 *
 * throw createStructuredError(
 *   'Configuration file not found',
 *   'CONFIG_NOT_FOUND',
 *   { path: './config.json', searched: ['./config.json', './settings.json'] }
 * )
 * ```
 */
export function createStructuredError(message: string, code: string, context?: Record<string, unknown>): StructuredError {
  const error = <StructuredError>createError(message)
  error.code = code
  error.context = context ?? {}
  return error
}

/**
 * Create a configuration-related error.
 *
 * @param message - The human-readable error message
 * @param code - The machine-readable error code for programmatic handling
 * @param context - Additional contextual information (e.g., file path, config key)
 * @returns Structured error instance tagged with type 'config'
 *
 * @example
 * ```typescript
 * throw createConfigError(
 *   'Invalid port number',
 *   'CONFIG_INVALID_PORT',
 *   { configFile: './app.config.json', value: -1 }
 * )
 * ```
 */
export function createConfigError(message: string, code: string, context?: Record<string, unknown>): StructuredError {
  return createStructuredError(message, code, { ...context, type: 'config' })
}

/**
 * Create a filesystem-related error.
 *
 * @param message - The human-readable error message
 * @param code - The filesystem error code (e.g., ENOENT for not found, EACCES for access denied)
 * @param context - Additional contextual information (e.g., file path, operation attempted)
 * @returns Structured error instance tagged with type 'fs'
 *
 * @example
 * ```typescript
 * throw createFsError(
 *   'Configuration file not found',
 *   'ENOENT',
 *   { path: './missing.json', operation: 'read' }
 * )
 * ```
 */
export function createFsError(message: string, code: string, context?: Record<string, unknown>): StructuredError {
  return createStructuredError(message, code, { ...context, type: 'fs' })
}

/**
 * Create a parsing-related error.
 *
 * @param message - The human-readable error message
 * @param code - The machine-readable error code for programmatic handling
 * @param context - Additional contextual information (e.g., file path, line/column numbers, expected format)
 * @returns Structured error instance tagged with type 'parse'
 *
 * @example
 * ```typescript
 * throw createParseError(
 *   'Invalid JSON syntax',
 *   'JSON_PARSE_ERROR',
 *   { file: './config.json', line: 42, column: 15 }
 * )
 * ```
 */
export function createParseError(message: string, code: string, context?: Record<string, unknown>): StructuredError {
  return createStructuredError(message, code, { ...context, type: 'parse' })
}

/**
 * Create a validation-related error.
 *
 * @param message - The human-readable error message
 * @param code - The machine-readable error code for programmatic handling
 * @param context - Additional contextual information (e.g., field name, actual vs expected values)
 * @returns Structured error instance tagged with type 'validation'
 *
 * @example
 * ```typescript
 * throw createValidationError(
 *   'Email format is invalid',
 *   'INVALID_EMAIL',
 *   { field: 'email', value: 'not-an-email' }
 * )
 * ```
 */
export function createValidationError(message: string, code: string, context?: Record<string, unknown>): StructuredError {
  return createStructuredError(message, code, { ...context, type: 'validation' })
}
