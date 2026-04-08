import { setPrototypeOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Custom error class for connection-related failures.
 *
 * @example
 * ```typescript
 * throw new ConnectionError('Connection timeout', 'ch-123', 'https://example.com')
 * ```
 */
export class ConnectionError extends Error {
  override readonly name = 'ConnectionError'

  constructor(
    message: string,
    public readonly channelId?: string,
    public readonly origin?: string
  ) {
    super(message)
    setPrototypeOf(this, ConnectionError.prototype)
  }

  /**
   * Converts error to JSON representation
   *
   * @returns JSON object with error details
   */
  toJSON(): {
    /** Error name */
    name: string
    /** Error message */
    message: string
    /** Channel ID if available */
    channelId?: string
    /** Origin if available */
    origin?: string
  } {
    return {
      name: this.name,
      message: this.message,
      ...(this.channelId && { channelId: this.channelId }),
      ...(this.origin && { origin: this.origin }),
    }
  }
}
