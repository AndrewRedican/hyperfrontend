/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Callback, Options } from '@hyperfrontend/data-utils'
import { getType } from '@hyperfrontend/data-utils'
import { traverse } from '@hyperfrontend/data-utils'

export interface State extends Record<string, unknown> {
  valid: boolean
}

function isValidCondition(data: unknown): boolean {
  return data !== null && !['undefined', 'function', 'symbol', 'bigint'].includes(getType(data))
}

export function isValidMessage<T = any>(message: T): boolean {
  /* istanbul ignore next - options always initialized, line reported incorrectly by coverage tool */
  const options: Options = { depth: [0, '*'] }
  const state: State = { valid: true }
  const callback: Callback = (key, value, path, state) => {
    if (!state.valid) return
    state.valid = isValidCondition(value)
  }
  traverse<unknown, State>(message, callback, options, state)
  return state.valid
}
