import type { IAction } from '../../types/action'
import type { ValidationResult } from '../../types/validation'
import { createValidator } from './create-validator'
import actionSchema from '../definitions/action.json'

/* istanbul ignore next -- validator initialization happens at module load */
const validateActionData = createValidator(actionSchema)

/**
 * Validates an action object against the action schema.
 *
 * @param action - The action to validate
 * @returns Validation result with any errors
 */
export function validateAction(action: IAction): ValidationResult {
  return validateActionData(action)
}
