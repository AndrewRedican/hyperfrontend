import type { Protocol } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { keys, entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Result object mapping each protocol property to its validation status.
 */
type ValidProtocolResult = Record<keyof Protocol, boolean | undefined>

/**
 * Validates whether a protocol object contains all required function properties.
 *
 * @param protocol - The protocol object to validate
 * @returns An object mapping each protocol property to its validation status (true if valid, false if invalid, undefined if not yet checked)
 */
function isValidProtocol(protocol: unknown): ValidProtocolResult {
  const result: ValidProtocolResult = {
    packetEncryption: void 0,
    packetDecryption: void 0,
    packetObfuscation: void 0,
    packetDeobfuscation: void 0,
    send: void 0,
    receive: void 0,
    getLogger: void 0,
  }
  const prt = <Protocol>protocol
  const isValidFunction = (key: keyof ValidProtocolResult) => {
    result[key] = key in prt && getType(prt[key]) === 'function'
    return result[key]
  }
  const keysList = <(keyof ValidProtocolResult)[]>keys(result)
  for (let i = 0; i < keysList.length; i += 1) {
    if (!isValidFunction(keysList[i])) return result
  }
  return result
}

/**
 * Identifies the first invalid property in a protocol object.
 *
 * @param protocol - The protocol object to validate
 * @returns The name of the first invalid protocol property, or an empty string if all properties are valid
 *
 * @example Detecting invalid protocol properties
 * ```typescript
 * getFirstInvalidProtocolProperty({ send: () => {}, receive: null })
 * // => 'receive'
 *
 * getFirstInvalidProtocolProperty(validProtocol)
 * // => ''
 * ```
 */
export function getFirstInvalidProtocolProperty(protocol: unknown): keyof ValidProtocolResult | '' {
  const validations = isValidProtocol(protocol)
  const firstInvalidProperty = entries(validations).find(([, isValid]) => isValid === false)
  return firstInvalidProperty ? <keyof ValidProtocolResult>firstInvalidProperty[0] : ''
}
