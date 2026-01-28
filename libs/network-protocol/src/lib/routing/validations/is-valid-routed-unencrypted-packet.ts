import type { RoutedUnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidTopicId } from '../../topic/validations'
import { isValidUnencryptedPacket } from '../../packet/validations'

export function isValidRoutedUnencryptedPacket(routedPacket: unknown) {
  const rtp = routedPacket as RoutedUnencryptedPacket
  return (
    getType(rtp) === 'object' && 'topicId' in rtp && 'packet' in rtp && isValidTopicId(rtp.topicId) && isValidUnencryptedPacket(rtp.packet)
  )
}
