/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QueueCreatorArguments, QueueCreatorValidity } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidLogger } from '@hyperfrontend/logging'

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
