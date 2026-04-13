import type { Protocol } from '../../channel/model'
import type { ValidProtocolResult } from './is-valid-protocol.model'
import { getType } from '@hyperfrontend/data-utils'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Validates whether the provided value is a valid protocol object.
 * Checks that all required protocol methods (encryption, obfuscation, send, receive) are present.
 *
 * @param protocol - The value to validate as a protocol
 * @returns A ValidProtocolResult object containing validation details for each protocol component
 *
 * @example Validating a protocol object
 * ```typescript
 * const result = isValidProtocol(myProtocol)
 * // => { packetEncryption: true, packetDecryption: true, ... }
 *
 * const invalid = isValidProtocol({})
 * // => { packetEncryption: false, packetDecryption: undefined, ... }
 * ```
 */
export function isValidProtocol(protocol: unknown): ValidProtocolResult {
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
