/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../../data/model'
import type { RoutedUnencryptedPacket } from '../model'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'
import { createUnencryptedPacket } from '../../packet/creators/create-unencrypted-packet'

/**
 * Creates a routed unencrypted packet with the specified topic, origin, target, and data.
 * The packet is created using the unencrypted packet creator and frozen.
 *
 * @param topicId - The topic identifier for routing the packet
 * @param origin - The origin URL of the packet sender
 * @param target - The target URL of the packet recipient
 * @param data - The data payload to include in the packet
 * @returns A frozen RoutedUnencryptedPacket
 * @throws {Error} When topic ID validation fails
 */
export function createRoutedUnencryptedPacket<T = any>(
  topicId: string,
  origin: string,
  target: string,
  data: Data<T>
): RoutedUnencryptedPacket {
  if (!isValidTopicId(topicId)) {
    throw new Error('Cannot create a routed unencrypted packet without a valid topic')
  }
  const routedPacket: RoutedUnencryptedPacket<T> = {
    topicId,
    packet: createUnencryptedPacket<T>(origin, target, data),
  }
  return Object.freeze(routedPacket)
}
