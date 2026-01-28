/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../../data/model'
import type { UnencryptedPacket } from '../model'
import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { createPacketBase } from './create-packet-base'
import { withoutValidErrorMessage } from '../utils'

export function createUnencryptedPacket<T = any>(origin: string, target: string, data: Data<T>): UnencryptedPacket<T> {
  const base = createPacketBase(origin, target)
  if (!isValidUnencryptedData(data)) {
    throw new Error(withoutValidErrorMessage('data'))
  }
  const packet: UnencryptedPacket = { ...base, data }
  return Object.freeze(packet)
}
