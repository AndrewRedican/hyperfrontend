import type { IChannelContract } from '../../types/contract'
import type { ValidationResult } from '../../types/validation'
import { createValidator } from './create-validator'
import contractSchema from '../definitions/contract.json'

const validateContractData = createValidator(contractSchema)

/**
 * Validates a channel contract against the contract schema.
 *
 * @param contract - The contract to validate
 * @returns Validation result with any errors
 */
export function validateContract(contract: IChannelContract): ValidationResult {
  return validateContractData(contract)
}
