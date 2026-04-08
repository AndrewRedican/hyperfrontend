/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QueueCreatorArguments, QueueCreatorValidity } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidLogger } from '@hyperfrontend/logging'

/**
 * Validates the arguments provided to the queue creator.
 * Checks that all required fields (label, operation, logger, callbacks) are valid.
 *
 * @param args - The queue creator arguments to validate
 * @returns A QueueCreatorValidity object indicating which fields are valid
 *
 * @example
 * ```typescript
 * const validity = isValidQueueCreaterArguments({
 *   label: 'processor',
 *   operation: async () => {},
 *   logger,
 *   onSuccess: () => {},
 *   onFail: () => {},
 * })
 * // => { label: true, operation: true, logger: true, onSuccess: true, onFail: true }
 * ```
 */
export function isValidQueueCreaterArguments<T = any>(args: QueueCreatorArguments<T>): QueueCreatorValidity {
  const validity: QueueCreatorValidity = {
    label: getType(args.label) === 'string' && args.label.length > 0,
    operation: getType(args.operation) === 'function',
    logger: isValidLogger(args.logger),
    onSuccess: getType(args.onSuccess) === 'function',
    onFail: getType(args.onFail) === 'function',
  }
  return validity
}
