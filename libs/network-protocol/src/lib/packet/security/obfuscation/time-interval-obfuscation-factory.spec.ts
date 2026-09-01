import type { SerializedEncryptedPacket } from '../../model'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTimeIntervalObfuscationFactory } from './time-interval-obfuscation-factory'

describe('createTimeIntervalObfuscationFactory', () => {
  const mockPacket: SerializedEncryptedPacket = {
    origin: '12345678-1234-4234-8234-123456789012',
    target: '87654321-4321-4321-8321-210987654321',
    data: 'encrypted-data',
  }

  const mockObfuscatedPacket = new Uint8Array([1, 2, 3, 4])

  const mockObfuscate = jest.fn().mockResolvedValue(mockObfuscatedPacket)
  const mockDeobfuscate = jest.fn().mockResolvedValue(mockPacket)
  const mockGetTimeBasedPassword = jest.fn().mockResolvedValue('time-password')
  const mockGetTimeBasedPasswords = jest.fn(() => ({
    current: jest.fn().mockResolvedValue('current-password'),
    previous: jest.fn().mockResolvedValue('previous-password'),
    next: jest.fn().mockResolvedValue('next-password'),
  }))

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('factory creation', () => {
    it('creates a factory function', () => {
      const factory = createTimeIntervalObfuscationFactory(
        mockObfuscate,
        mockDeobfuscate,
        mockGetTimeBasedPassword,
        mockGetTimeBasedPasswords
      )

      expect(typeof factory).toBe('function')
    })

    it('throws an error for invalid refresh rate (0)', () => {
      const factory = createTimeIntervalObfuscationFactory(
        mockObfuscate,
        mockDeobfuscate,
        mockGetTimeBasedPassword,
        mockGetTimeBasedPasswords
      )

      expect(() => factory(0)).toThrow('A valid refresh rate must be provided.')
    })

    it('throws an error for invalid refresh rate (negative)', () => {
      const factory = createTimeIntervalObfuscationFactory(
        mockObfuscate,
        mockDeobfuscate,
        mockGetTimeBasedPassword,
        mockGetTimeBasedPasswords
      )

      expect(() => factory(-1)).toThrow('A valid refresh rate must be provided.')
    })

    it('uses default refresh rate of 1 when not provided', () => {
      const factory = createTimeIntervalObfuscationFactory(
        mockObfuscate,
        mockDeobfuscate,
        mockGetTimeBasedPassword,
        mockGetTimeBasedPasswords
      )

      expect(() => factory()).not.toThrow()
    })

    it('returns a frozen obfuscation suite', () => {
      const factory = createTimeIntervalObfuscationFactory(
        mockObfuscate,
        mockDeobfuscate,
        mockGetTimeBasedPassword,
        mockGetTimeBasedPasswords
      )

      const suite = factory(1)

      expect(Object.isFrozen(suite)).toBe(true)
    })
  })

  describe('packetObfuscation', () => {
    it('obfuscates a packet with time-based password', async () => {
      const factory = createTimeIntervalObfuscationFactory(
        mockObfuscate,
        mockDeobfuscate,
        mockGetTimeBasedPassword,
        mockGetTimeBasedPasswords
      )
      const suite = factory(60)

      const result = await suite.packetObfuscation(mockPacket)

      expect(mockGetTimeBasedPassword).toHaveBeenCalledWith(expect.any(Date), 60, 0)
      expect(mockObfuscate).toHaveBeenCalledWith(mockPacket, 'time-password')
      expect(result).toBe(mockObfuscatedPacket)
    })
  })

  describe('packetDeobfuscation', () => {
    it('deobfuscates a packet with current password', async () => {
      const currentPasswordFn = jest.fn().mockResolvedValue('current-password')
      const mockGetPasswords = jest.fn(() => ({
        current: currentPasswordFn,
        previous: jest.fn().mockResolvedValue('previous-password'),
        next: jest.fn().mockResolvedValue('next-password'),
      }))
      const mockDeobfuscateFn = jest.fn().mockResolvedValue(mockPacket)

      const factory = createTimeIntervalObfuscationFactory(mockObfuscate, mockDeobfuscateFn, mockGetTimeBasedPassword, mockGetPasswords)
      const suite = factory(60)

      const result = await suite.packetDeobfuscation(mockObfuscatedPacket)

      expect(currentPasswordFn).toHaveBeenCalled()
      expect(mockDeobfuscateFn).toHaveBeenCalledWith(mockObfuscatedPacket, 'current-password')
      expect(result).toBe(mockPacket)
    })

    it('tries previous password when current fails', async () => {
      const currentPasswordFn = jest.fn().mockResolvedValue('current-password')
      const previousPasswordFn = jest.fn().mockResolvedValue('previous-password')
      const nextPasswordFn = jest.fn().mockResolvedValue('next-password')

      const mockGetPasswords = jest.fn(() => ({
        current: currentPasswordFn,
        previous: previousPasswordFn,
        next: nextPasswordFn,
      }))

      const mockDeobfuscateFn = jest.fn().mockRejectedValueOnce(new Error('Wrong password')).mockResolvedValueOnce(mockPacket)

      const factory = createTimeIntervalObfuscationFactory(mockObfuscate, mockDeobfuscateFn, mockGetTimeBasedPassword, mockGetPasswords)
      const suite = factory(60)

      const result = await suite.packetDeobfuscation(mockObfuscatedPacket)

      expect(currentPasswordFn).toHaveBeenCalled()
      expect(previousPasswordFn).toHaveBeenCalled()
      expect(mockDeobfuscateFn).toHaveBeenCalledTimes(2)
      expect(result).toBe(mockPacket)
    })

    it('tries next password when current and previous fail', async () => {
      const currentPasswordFn = jest.fn().mockResolvedValue('current-password')
      const previousPasswordFn = jest.fn().mockResolvedValue('previous-password')
      const nextPasswordFn = jest.fn().mockResolvedValue('next-password')

      const mockGetPasswords = jest.fn(() => ({
        current: currentPasswordFn,
        previous: previousPasswordFn,
        next: nextPasswordFn,
      }))

      const mockDeobfuscateFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Wrong password'))
        .mockRejectedValueOnce(new Error('Wrong password'))
        .mockResolvedValueOnce(mockPacket)

      const factory = createTimeIntervalObfuscationFactory(mockObfuscate, mockDeobfuscateFn, mockGetTimeBasedPassword, mockGetPasswords)
      const suite = factory(60)

      const result = await suite.packetDeobfuscation(mockObfuscatedPacket)

      expect(currentPasswordFn).toHaveBeenCalled()
      expect(previousPasswordFn).toHaveBeenCalled()
      expect(nextPasswordFn).toHaveBeenCalled()
      expect(mockDeobfuscateFn).toHaveBeenCalledTimes(3)
      expect(result).toBe(mockPacket)
    })

    it('throws an error when all passwords fail', async () => {
      const currentPasswordFn = jest.fn().mockResolvedValue('current-password')
      const previousPasswordFn = jest.fn().mockResolvedValue('previous-password')
      const nextPasswordFn = jest.fn().mockResolvedValue('next-password')

      const mockGetPasswords = jest.fn(() => ({
        current: currentPasswordFn,
        previous: previousPasswordFn,
        next: nextPasswordFn,
      }))

      const mockDeobfuscateFn = jest.fn().mockRejectedValue(new Error('Wrong password'))

      const factory = createTimeIntervalObfuscationFactory(mockObfuscate, mockDeobfuscateFn, mockGetTimeBasedPassword, mockGetPasswords)
      const suite = factory(60)

      await expect(suite.packetDeobfuscation(mockObfuscatedPacket)).rejects.toThrow('Could not deobfuscate data')
    })

    it('tries next password when deobfuscation returns invalid packet', async () => {
      const invalidPacket = { invalid: 'data' }
      const currentPasswordFn = jest.fn().mockResolvedValue('current-password')
      const previousPasswordFn = jest.fn().mockResolvedValue('previous-password')
      const nextPasswordFn = jest.fn().mockResolvedValue('next-password')

      const mockGetPasswords = jest.fn(() => ({
        current: currentPasswordFn,
        previous: previousPasswordFn,
        next: nextPasswordFn,
      }))

      const mockDeobfuscateFn = jest
        .fn()
        .mockResolvedValueOnce(invalidPacket as unknown)
        .mockResolvedValueOnce(mockPacket)

      const factory = createTimeIntervalObfuscationFactory(mockObfuscate, mockDeobfuscateFn, mockGetTimeBasedPassword, mockGetPasswords)
      const suite = factory(60)

      const result = await suite.packetDeobfuscation(mockObfuscatedPacket)

      expect(mockDeobfuscateFn).toHaveBeenCalledTimes(2)
      expect(result).toBe(mockPacket)
    })
  })
})
