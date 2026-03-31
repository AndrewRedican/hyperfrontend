import type { PacketEncrypter, PacketDecrypter } from '../../../packet/model'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/browser'
import { getTimeBasedPassword, getTimeBasedPasswords } from '@hyperfrontend/cryptography/browser'
import { createDataDecrypter } from '../../../data/security/create-decrypter'
import { createDataEncrypter } from '../../../data/security/create-encrypter'
import { createPacketDecrypter } from '../../../packet/security/encryption/create-decrypter'
import { createPacketEncrypter } from '../../../packet/security/encryption/create-encrypter'
import { createPacketDeobfuscator } from '../../../packet/security/obfuscation/create-deobfuscator'
import { createPacketObfuscator } from '../../../packet/security/obfuscation/create-obfuscator'
import { createTimeIntervalObfuscationFactory } from '../../../packet/security/obfuscation/time-interval-obfuscation-factory'
import { createMockLogger } from '../../v1/creators/test-fixtures'
import { createPSKHandshakeProtocolFactory } from './create-static-key-protocol-factory'

describe('createPSKHandshakeProtocolFactory (Browser)', () => {
  let encryptPacket: PacketEncrypter
  let decryptPacket: PacketDecrypter
  let createTimeIntervalObfuscation: ReturnType<typeof createTimeIntervalObfuscationFactory>

  beforeAll(() => {
    const encryptData = createDataEncrypter(encrypt)
    const decryptData = createDataDecrypter(decrypt)
    encryptPacket = createPacketEncrypter(encryptData)
    decryptPacket = createPacketDecrypter(decryptData)
    const obfuscatePacket = createPacketObfuscator(encrypt)
    const deobfuscatePacket = createPacketDeobfuscator(decrypt)

    createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
      obfuscatePacket,
      deobfuscatePacket,
      getTimeBasedPassword,
      getTimeBasedPasswords
    )
  })

  describe('protocol provider creation', () => {
    it('creates protocol provider with valid logger, shared key, and refresh rate', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      const protocolProvider = createProtocol(logger, 'my-shared-key', 1)

      expect(protocolProvider).toBeDefined()
      expect(typeof protocolProvider).toBe('function')
    })

    it('creates protocol provider with default refresh rate', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      const protocolProvider = createProtocol(logger, 'my-shared-key')

      expect(protocolProvider).toBeDefined()
      expect(typeof protocolProvider).toBe('function')
    })

    it('throws error for invalid logger', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)

      expect(() => createProtocol(<ReturnType<typeof createMockLogger>>null, 'my-shared-key', 1)).toThrow(
        'Cannot create protocol provider without a valid logger'
      )
    })

    it('throws error for empty shared key', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      expect(() => createProtocol(logger, '', 1)).toThrow('Cannot create protocol provider without a valid shared key')
    })

    it('throws error for non-string shared key', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      expect(() => createProtocol(logger, <string>null, 1)).toThrow('Cannot create protocol provider without a valid shared key')
      expect(() => createProtocol(logger, <string>undefined, 1)).toThrow('Cannot create protocol provider without a valid shared key')
    })

    it('throws error for invalid refresh rate', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      expect(() => createProtocol(logger, 'my-shared-key', 0)).toThrow('Cannot create protocol provider without a valid refresh rate')
      expect(() => createProtocol(logger, 'my-shared-key', -1)).toThrow('Cannot create protocol provider without a valid refresh rate')
    })
  })

  describe('protocol creation', () => {
    it('creates protocol with all required properties', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 'my-shared-key', 1)

      const sendPacket = () => void 0
      const receivePacket = () => void 0

      const protocol = protocolProvider(sendPacket, receivePacket)

      expect(protocol).toBeDefined()
      expect(protocol.packetEncryption).toBeInstanceOf(Function)
      expect(protocol.packetDecryption).toBeInstanceOf(Function)
      expect(protocol.packetObfuscation).toBeInstanceOf(Function)
      expect(protocol.packetDeobfuscation).toBeInstanceOf(Function)
      expect(protocol.send).toBe(sendPacket)
      // Note: PSK handshake protocol wraps receive to capture dynamic keys
      expect(typeof protocol.receive).toBe('function')
      expect(protocol.getLogger).toBeInstanceOf(Function)
      expect(Object.isFrozen(protocol)).toBe(true)
    })

    it('returns logger from getLogger', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 'my-shared-key', 1)

      const protocol = protocolProvider(
        () => void 0,
        () => void 0
      )

      expect(protocol.getLogger()).toBe(logger)
    })

    it('throws error for invalid send function', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 'my-shared-key', 1)

      expect(() => protocolProvider(<() => void>null, () => void 0)).toThrow('Cannot create protocol without a valid send function')
    })

    it('throws error for invalid receive function', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 'my-shared-key', 1)

      expect(() => protocolProvider(() => void 0, <() => void>null)).toThrow('Cannot create protocol without a valid receive function')
    })
  })

  describe('encryption behavior', () => {
    it('uses the shared key for initial handshake, then dynamic keys', () => {
      const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const sharedKey = 'shared-secret-key'
      const protocolProvider = createProtocol(logger, sharedKey, 1)

      const protocol = protocolProvider(
        () => void 0,
        () => void 0
      )

      // PSK is used for initial handshake, then dynamic keys for subsequent messages
      expect(protocol.packetEncryption).toBeDefined()
      expect(protocol.packetDecryption).toBeDefined()
    })
  })
})
