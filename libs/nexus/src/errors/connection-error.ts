/**
 * Custom error class for connection-related failures
 */
export class ConnectionError extends Error {
  override readonly name = 'ConnectionError'

  constructor(
    message: string,
    public readonly channelId?: string,
    public readonly origin?: string
  ) {
    super(message)
    Object.setPrototypeOf(this, ConnectionError.prototype)
  }

  /**
   * Converts error to JSON representation
   *
   * @returns JSON object with error details
   */
  toJSON(): { name: string; message: string; channelId?: string; origin?: string } {
    return {
      name: this.name,
      message: this.message,
      ...(this.channelId && { channelId: this.channelId }),
      ...(this.origin && { origin: this.origin }),
    }
  }
}
