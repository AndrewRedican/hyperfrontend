/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../../data/model'
import type { RoutedUnencryptedPacket } from '../model'
import { isValidTopicId } from '../../topic/validations'
import { createUnencryptedPacket } from '../../packet/creators'

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
