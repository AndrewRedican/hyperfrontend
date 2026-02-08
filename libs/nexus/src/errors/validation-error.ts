/**
 * PURPOSE:
 * Custom error class for validation failures throughout the library.
 * Provides structured error information for better debugging.
 *
 * DEPENDENCIES:
 * - types/validation.ts (for ValidationError type)
 *
 * CLASS DEFINITION:
 * ```typescript
 * class ValidationError extends Error {
 *   constructor(message: string, public errors: ValidationError[])
 * }
 * ```
 *
 * IMPLEMENTATION STRATEGY:
 * - Extend native Error class
 * - Store array of validation errors
 * - Override toString() for formatted output
 * - Set prototype explicitly for proper instanceof checks
 * - Include stack trace
 *
 * API USAGE:
 * - Use `@hyperfrontend/string-utils` for formatting error messages
 * - Use `@hyperfrontend/list-utils` for aggregating errors
 *
 * PROPERTIES:
 * - name: 'ValidationError' (for error identification)
 * - message: string (overall error message)
 * - errors: ValidationError[] (detailed validation failures)
 * - stack: string (stack trace)
 *
 * METHODS:
 * - toJSON(): Serializable representation
 * - toString(): Formatted string representation
 *
 * EXAMPLE:
 * ```typescript
 * throw new ValidationError('Invalid contract', [
 *   { field: 'accepted', message: 'Must be array', code: 'TYPE_ERROR' }
 * ])
 * ```
 *
 * EDGE CASES:
 * - Empty errors array is valid
 * - Errors should be serializable (no circular refs)
 * - Message should be human-readable
 *
 * TESTING STRATEGY:
 * - Test error instanceof checks
 * - Test error serialization
 * - Test stack trace preservation
 * - Test with multiple validation errors
 */

import type { ValidationError as IValidationError } from '../types/validation'

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'

  constructor(
    message: string,
    public readonly errors: IValidationError[] = []
  ) {
    super(message)
    Object.setPrototypeOf(this, ValidationError.prototype)
  }

  /**
   * Converts error to JSON representation
   *
   * @returns JSON object with error details
   */
  toJSON(): { name: string; message: string; errors: IValidationError[] } {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    }
  }

  /**
   * Formats error as string with detailed errors
   *
   * @returns Formatted error string
   */
  override toString(): string {
    if (this.errors.length === 0) {
      return `${this.name}: ${this.message}`
    }
    const errorList = this.errors.map((e) => `  - ${e.path || 'unknown'}: ${e.message}`).join('\n')
    return `${this.name}: ${this.message}\n${errorList}`
  }
}
