/**
 * Tests for dynamic obfuscation key factory
 */

import type { ObfuscatedPacket, SerializedEncryptedPacket } from '../../model'
import { createDynamicKeyObfuscationFactory } from './dynamic-obfuscation-key'

describe('createDynamicKeyObfuscationFactory', () => {
  const mockPacket: SerializedEncryptedPacket = {
    origin: 'origin-id',
    target: 'target-id',
    data: 'encrypted-data',
  }

  const mockObfuscatedPacket = new Uint8Array([1, 2, 3, 4])

  it('creates an obfuscation suite with dynamic key provider', () => {
    const mockObfuscate = jest.fn().mockResolvedValue(mockObfuscatedPacket)
    const mockDeobfuscate = jest.fn().mockResolvedValue(mockPacket)
    const keyProvider = jest.fn().mockReturnValue('dynamic-key')

    const factory = createDynamicKeyObfuscationFactory(mockObfuscate, mockDeobfuscate)
    const suite = factory(keyProvider)

    expect(suite).toHaveProperty('packetObfuscation')
    expect(suite).toHaveProperty('packetDeobfuscation')
    expect(typeof suite.packetObfuscation).toBe('function')
    expect(typeof suite.packetDeobfuscation).toBe('function')
  })

  it('obfuscates packet using dynamic key from provider', async () => {
    const mockObfuscate = jest.fn().mockResolvedValue(mockObfuscatedPacket)
    const mockDeobfuscate = jest.fn().mockResolvedValue(mockPacket)
    const keyProvider = jest.fn().mockReturnValue('test-key-123')

    const factory = createDynamicKeyObfuscationFactory(mockObfuscate, mockDeobfuscate)
    const suite = factory(keyProvider)

    await suite.packetObfuscation(mockPacket)

    expect(keyProvider).toHaveBeenCalledTimes(1)
    expect(mockObfuscate).toHaveBeenCalledWith(mockPacket, 'test-key-123')
  })

  it('deobfuscates packet using dynamic key from provider', async () => {
    const mockObfuscate = jest.fn().mockResolvedValue(mockObfuscatedPacket)
    const mockDeobfuscate = jest.fn().mockResolvedValue(mockPacket)
    const keyProvider = jest.fn().mockReturnValue('test-key-456')

    const factory = createDynamicKeyObfuscationFactory(mockObfuscate, mockDeobfuscate)
    const suite = factory(keyProvider)

    await suite.packetDeobfuscation(mockObfuscatedPacket)

    expect(keyProvider).toHaveBeenCalledTimes(1)
    expect(mockDeobfuscate).toHaveBeenCalledWith(mockObfuscatedPacket, 'test-key-456')
  })

  it('calls key provider each time obfuscation is performed', async () => {
    const mockObfuscate = jest.fn().mockResolvedValue(mockObfuscatedPacket)
    const mockDeobfuscate = jest.fn().mockResolvedValue(mockPacket)
    let counter = 0
    const keyProvider = jest.fn(() => `key-${++counter}`)

    const factory = createDynamicKeyObfuscationFactory(mockObfuscate, mockDeobfuscate)
    const suite = factory(keyProvider)

    await suite.packetObfuscation(mockPacket)
    await suite.packetObfuscation(mockPacket)
    await suite.packetObfuscation(mockPacket)

    expect(keyProvider).toHaveBeenCalledTimes(3)
    expect(mockObfuscate).toHaveBeenNthCalledWith(1, mockPacket, 'key-1')
    expect(mockObfuscate).toHaveBeenNthCalledWith(2, mockPacket, 'key-2')
    expect(mockObfuscate).toHaveBeenNthCalledWith(3, mockPacket, 'key-3')
  })

  it('returns frozen obfuscation suite', () => {
    const mockObfuscate = jest.fn().mockResolvedValue(mockObfuscatedPacket)
    const mockDeobfuscate = jest.fn().mockResolvedValue(mockPacket)
    const keyProvider = jest.fn().mockReturnValue('key')

    const factory = createDynamicKeyObfuscationFactory(mockObfuscate, mockDeobfuscate)
    const suite = factory(keyProvider)

    expect(Object.isFrozen(suite)).toBe(true)
  })
})
