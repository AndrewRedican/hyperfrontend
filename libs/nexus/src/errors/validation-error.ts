import type { ValidationError as IValidationError } from '../types/validation'
import { setPrototypeOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * JSON representation of a {@link ValidationError}.
 */
export type ValidationErrorJSON = {
  /** Error name */
  name: string
  /** Error message */
  message: string
  /** Validation errors */
  errors: IValidationError[]
}

/**
 * Custom error class for validation failures
 *
 * @example Throwing validation error
 * ```typescript
 * throw new ValidationError('Schema mismatch', [{ path: 'data.id', message: 'Required' }])
 * ```
 */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'

  constructor(
    message: string,
    public readonly errors: IValidationError[] = []
  ) {
    super(message)
    setPrototypeOf(this, ValidationError.prototype)
  }

  /**
   * Converts error to JSON representation
   *
   * @returns JSON object with error details
   */
  toJSON(): ValidationErrorJSON {
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
