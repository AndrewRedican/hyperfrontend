import type { PacketBase } from '../model'
import { isValidOrigin } from '../validations/is-valid-origin'
import { isValidTarget } from '../validations/is-valid-target'
import { withoutValidErrorMessage } from '../utils/without-valid-err-msg'

/**
 * Creates the base structure for a network packet with origin and target.
 * Validates origin and target URLs before creating the frozen packet base.
 *
 * @param origin - The origin URL of the packet sender
 * @param target - The target URL of the packet recipient
 * @returns A frozen PacketBase object with validated origin and target
 * @throws {Error} When origin or target validation fails
 */
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
