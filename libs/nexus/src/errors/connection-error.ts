import { setPrototypeOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * JSON representation of a {@link ConnectionError}.
 */
export type ConnectionErrorJSON = {
  /** Error name */
  name: string
  /** Error message */
  message: string
  /** Channel ID if available */
  channelId?: string
  /** Origin if available */
  origin?: string
}

/**
 * Custom error class for connection-related failures.
 *
 * @example Throwing connection error
 * ```typescript
 * throw new ConnectionError('Connection timeout', 'ch-123', 'https://example.com')
 * ```
 */
export class ConnectionError extends Error {
  override readonly name = 'ConnectionError'

  /** Identifier of the channel the failure happened on. */
  readonly channelId?: string

  /** Origin the channel was talking to. */
  readonly origin?: string

  constructor(message: string, channelId?: string, origin?: string) {
    super(message)
    this.channelId = channelId
    this.origin = origin
    setPrototypeOf(this, ConnectionError.prototype)
  }

  /**
   * Converts error to JSON representation
   *
   * @returns JSON object with error details
   */
  toJSON(): ConnectionErrorJSON {
    return {
      name: this.name,
      message: this.message,
      ...(this.channelId && { channelId: this.channelId }),
      ...(this.origin && { origin: this.origin }),
    }
  }
}
