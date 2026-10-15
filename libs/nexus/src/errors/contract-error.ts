import type { IChannelContract } from '../types/contract'
import { setPrototypeOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * JSON representation of a {@link ContractError}.
 */
export type ContractErrorJSON = {
  /** Error name */
  name: string
  /** Error message */
  message: string
  /** Contract if available */
  contract?: IChannelContract
}

/**
 * Custom error class for contract-related failures
 *
 * @example Throwing contract error
 * ```typescript
 * throw new ContractError('Invalid action type', { emitted: [], accepted: [] })
 * ```
 */
export class ContractError extends Error {
  /** Fixed discriminator, so a handler can tell this error apart by name where `instanceof` is unreliable. */
  override readonly name = 'ContractError'

  /** Contract the failure was measured against. */
  readonly contract?: IChannelContract

  /**
   * Builds the error with the contract it was measured against.
   *
   * @param message - What went wrong, in words
   * @param contract - The contract the failing action was checked against, when one applies
   */
  constructor(message: string, contract?: IChannelContract) {
    super(message)
    this.contract = contract
    setPrototypeOf(this, ContractError.prototype)
  }

  /**
   * Converts error to JSON representation
   *
   * @returns JSON object with error details
   */
  toJSON(): ContractErrorJSON {
    return {
      name: this.name,
      message: this.message,
      ...(this.contract && { contract: this.contract }),
    }
  }
}
