/* eslint-disable workspace/lib-require-jsdoc-example */
import type { Schema } from '@hyperfrontend/json-utils'
import type { IAction } from '../../types/action'
import type { ValidationResult } from '../../types/validation'
import actionSchema from '../definitions/action.json'
import { createValidator } from './create-validator'

// why: validator initialization happens at module load
const validateActionData = createValidator(actionSchema as Schema)

/**
 * Validates an action object against the action schema.
 *
 * @param action - The action to validate
 * @returns Validation result with any errors
 */
export function validateAction(action: IAction): ValidationResult {
  return validateActionData(action)
}
