import type { RoutedUnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidTopicId } from '../../topic/validations'
import { isValidObfuscatedPacket } from '../../packet/validations'

export function isValidRoutedObfuscatedPacket(routedPacket: unknown) {
  const rtp = routedPacket as RoutedUnencryptedPacket
  return (
    getType(rtp) === 'object' && 'topicId' in rtp && 'packet' in rtp && isValidTopicId(rtp.topicId) && isValidObfuscatedPacket(rtp.packet)
  )
}
