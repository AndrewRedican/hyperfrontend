import type { IChannelContract } from '../types/contract'
import { setPrototypeOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Custom error class for contract-related failures
 *
 * @example
 * ```typescript
 * throw new ContractError('Invalid action type', { emitted: [], accepted: [] })
 * ```
 */
export class ContractError extends Error {
  override readonly name = 'ContractError'

  constructor(
    message: string,
    public readonly contract?: IChannelContract
  ) {
    super(message)
    setPrototypeOf(this, ContractError.prototype)
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
    /** Contract if available */
    contract?: IChannelContract
  } {
    return {
      name: this.name,
      message: this.message,
      ...(this.contract && { contract: this.contract }),
    }
  }
}
