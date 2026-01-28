import type { Protocol } from '../../../channel/model'
import type { ValidProtocolResult } from './is-valid-protocol.model'
import { getType } from '@hyperfrontend/data-utils'

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
  const prt = protocol as Protocol
  const isValidFunction = (key: keyof ValidProtocolResult) => {
    result[key] = key in prt && getType(prt[key]) === 'function'
    return result[key]
  }
  const keys = Object.keys(result) as (keyof ValidProtocolResult)[]
  for (let i = 0; i < keys.length; i += 1) {
    if (!isValidFunction(keys[i])) return result
  }
  return result
}
