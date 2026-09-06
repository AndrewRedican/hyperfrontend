import type { Protocol } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Per-property validity of a protocol object */
type ValidProtocolResult = {
  [Property in keyof Protocol]: boolean | void
}

/**
 * Validates whether a protocol object contains all required function properties.
 *
 * @param protocol - The protocol object to validate
 * @returns An object mapping each protocol property to its validation status (true if valid, false if invalid, undefined if not yet checked)
 */
function isValidProtocol(protocol: unknown): ValidProtocolResult {
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

/**
 * Identifies the first invalid property in a protocol object.
 *
 * @param protocol - The protocol object to inspect
 * @returns The name of the first property that is not a function, or an empty string when every property is valid
 *
 * @example Reporting a protocol missing its opener
 * ```typescript
 * getFirstInvalidProtocolProperty({ seal, send, receive, getLogger })
 * // => 'open'
 * ```
 */
export function getFirstInvalidProtocolProperty(protocol: unknown): string {
  const validity = isValidProtocol(protocol)
  const invalid = (keys(validity) as (keyof ValidProtocolResult)[]).find((key) => validity[key] === false)
  return invalid ?? ''
}
