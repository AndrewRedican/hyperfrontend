import type { Protocol } from '../../channel/model'
import type { ValidProtocolResult } from './is-valid-protocol.model'
import { getType } from '@hyperfrontend/data-utils'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Validates whether a protocol object contains all required function properties,
 * stopping at the first that is missing or not a function.
 *
 * @param protocol - The protocol object to validate
 * @returns An object mapping each protocol property to its validation status (true if valid, false if invalid, undefined if not yet checked)
 *
 * @example Validating a protocol object
 * ```typescript
 * const result = isValidProtocol(myProtocol)
 * // => { seal: true, open: true, hello: true, isHello: true, acceptHello: true, send: true, receive: true, getLogger: true }
 *
 * const invalid = isValidProtocol({})
 * // => { seal: false, open: undefined, ... }
 * ```
 */
export function isValidProtocol(protocol: unknown): ValidProtocolResult {
  const result: ValidProtocolResult = {
    seal: void 0,
    open: void 0,
    hello: void 0,
    isHello: void 0,
    acceptHello: void 0,
    send: void 0,
    receive: void 0,
    getLogger: void 0,
  }
  const prt = protocol as Protocol
  const isValidFunction = (key: keyof ValidProtocolResult) => {
    result[key] = key in prt && getType(prt[key]) === 'function'
    return result[key]
  }
  const keysList = keys(result) as (keyof ValidProtocolResult)[]
  for (let i = 0; i < keysList.length; i += 1) {
    if (!isValidFunction(keysList[i])) return result
  }
  return result
}
