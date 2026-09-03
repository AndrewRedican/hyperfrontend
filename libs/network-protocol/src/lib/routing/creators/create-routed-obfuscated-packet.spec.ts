/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from '@hyperfrontend/testing'
import { obfuscatedPacket } from '../../packet/creators/mocks'
import { topicId } from '../../topic/creators/mocks'
import { isValidRoutedObfuscatedPacket } from '../validations/is-valid-routed-obfuscated-packet'
import { createRoutedObfuscatedPacket } from './create-routed-obfuscated-packet'

describe('createRoutedObfuscatedPacket', () => {
  it('throws error when topicId is not valid', () => {
    expect(() => createRoutedObfuscatedPacket('', obfuscatedPacket)).toThrow(
      'Cannot create a routed obfuscated packet without a valid topic'
    )
  })

  it('throws error when obfuscated packet is not valid', () => {
    expect(() => createRoutedObfuscatedPacket(topicId, {} as any)).toThrow(
      'Cannot create a routed obfuscated packet without a valid obfuscated packet'
    )
  })

  it('creates a routed obfuscated packet', () => {
    const result = createRoutedObfuscatedPacket(topicId, obfuscatedPacket)
    expect(isValidRoutedObfuscatedPacket(result)).toBe(true)
  })
})
