/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Callback, DepthConfig } from '@hyperfrontend/data-utils'
import { getType } from '@hyperfrontend/data-utils'
import { traverse } from '@hyperfrontend/data-utils'

/** Traversal state for message validation. */
export interface State extends Record<string, unknown> {
  /** Whether the current traversal state is valid. */
  valid: boolean
}

/**
 * Validates whether a data value meets the message condition requirements.
 * Rejects null, undefined, functions, symbols, and bigint types.
 *
 * @param data - The value to validate
 * @returns True if the value is a valid message component, false otherwise
 */
function isValidCondition(data: unknown): boolean {
  return data !== null && !['undefined', 'function', 'symbol', 'bigint'].includes(getType(data))
}

/**
 * Validates whether the provided message contains only valid, serializable data.
 * Traverses the entire message structure to ensure all values are serializable types.
 *
 * @param message - The message to validate
 * @returns True if all message data is valid and serializable, false otherwise
 */
export function isValidMessage<T = any>(message: T): boolean {
  /* istanbul ignore next - options always initialized, line reported incorrectly by coverage tool */
  const options: DepthConfig = { depth: [0, '*'] }
  const state: State = { valid: true }
  const callback: Callback = (key, value, path, state) => {
    if (!state.valid) return
    state.valid = isValidCondition(value)
  }
  traverse<unknown, State>(message, callback, options, state)
  return state.valid
}
