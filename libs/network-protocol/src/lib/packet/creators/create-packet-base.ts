import type { PacketBase } from '../model'
import { isValidOrigin, isValidTarget } from '../validations'
import { withoutValidErrorMessage } from '../utils'

export function createPacketBase(origin: string, target: string): PacketBase {
  if (!isValidOrigin(origin)) {
    throw new Error(withoutValidErrorMessage('origin'))
  }
  if (!isValidTarget(target)) {
    throw new Error(withoutValidErrorMessage('target'))
  }
  const packetBase: PacketBase = { origin, target }
  return Object.freeze(packetBase)
}
