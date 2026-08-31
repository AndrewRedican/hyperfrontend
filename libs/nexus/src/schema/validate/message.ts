/* eslint-disable workspace/lib-require-jsdoc-example */
import type { Schema } from '@hyperfrontend/json-utils'
import type { IMessage } from '../../types/message'
import type { ValidationResult } from '../../types/validation'
import messageSchema from '../definitions/message.json'
import { createValidator } from './create-validator'

/* istanbul ignore next -- validator initialization happens at module load */
const validateMessageData = createValidator(messageSchema as Schema)

/**
 * Validates a user message against the message schema.
 *
 * @param message - The message to validate
 * @returns Validation result with any errors
 */
export function validateMessage(message: IMessage): ValidationResult {
  return validateMessageData(message)
}
