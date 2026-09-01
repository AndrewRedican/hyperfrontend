import { describe, expect, it } from '@hyperfrontend/testing'
import { data } from '../../data/creators/mocks'
import { origin, target } from '../../packet/creators/mocks'
import { topicId } from '../../topic/creators/mocks'
import { isValidRoutedUnencryptedPacket } from '../validations/is-valid-routed-unencrypted-packet'
import { createRoutedUnencryptedPacket } from './create-routed-unencrypted-packet'

describe('createRoutedUnencryptedPacket', () => {
  it('throws an error when a valid topic is not provided', () => {
    expect(() => createRoutedUnencryptedPacket('', origin, target, data)).toThrow(
      'Cannot create a routed unencrypted packet without a valid topic'
    )
  })

  it('creates a routed unencrypted packet', () => {
    const result = createRoutedUnencryptedPacket(topicId, origin, target, data)
    expect(isValidRoutedUnencryptedPacket(result)).toBe(true)
  })
})
