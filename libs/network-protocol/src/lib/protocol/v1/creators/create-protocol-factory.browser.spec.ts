/**
 * Browser integration tests for protocol factory.
 * Node.js version: create-protocol-factory.spec.ts (identical except for imports)
 */

import { encrypt, decrypt } from '@hyperfrontend/cryptography/browser'
import { createHash } from '@hyperfrontend/cryptography/browser'
import { uint8ArrayToBase64, base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
import { createDataFactory } from '../../../data/creators'
import { createProtocolFactory } from './create-protocol-factory'
import { createPacketEncrypter } from '../../../packet/security/encryption'
import { createPacketDecrypter } from '../../../packet/security/encryption'
import { createDataEncrypter } from '../../../data/security'
import { createDataDecrypter } from '../../../data/security'
import { createPacketObfuscator } from '../../../packet/security/obfuscation'
import { createPacketDeobfuscator } from '../../../packet/security/obfuscation'
import { createDynamicKeyEncryptionFactory } from '../../../packet/security/encryption/dynamic-encryption-key'
import { createFirstMessageHandler } from '../../../packet/security/encryption/create-first-message-handler'
import { createTimeIntervalObfuscationFactory } from '../../../packet/security/obfuscation/time-interval-obfuscation-factory'
import { getTimeBasedPassword, getTimeBasedPasswords } from '@hyperfrontend/cryptography/browser'
import { createSerializedEncryptedPacketCreator, createDeserializedEncryptedPacketCreator } from '../../../packet/creators'
import { testUUIDs, testMessages, createMockLogger } from './test-fixtures'

describe('createProtocolFactory (Browser)', () => {
  let createData: ReturnType<typeof createDataFactory>

  beforeAll(() => {
    createData = createDataFactory(createHash)
  })

  describe('protocol provider creation', () => {
    it('creates protocol provider with valid logger and refresh rate', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      const protocolProvider = createProtocol(logger, 1)

      expect(protocolProvider).toBeDefined()
      expect(typeof protocolProvider).toBe('function')
    })

    it('creates protocol provider with default refresh rate', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      const protocolProvider = createProtocol(logger)

      expect(protocolProvider).toBeDefined()
      expect(typeof protocolProvider).toBe('function')
    })
  })

  describe('protocol creation', () => {
    it('creates protocol with all required properties', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 1)

      const sendPacket = () => void 0
      const receivePacket = () => void 0

      const protocol = protocolProvider(sendPacket, receivePacket)

      expect(protocol).toBeDefined()
      expect(protocol.packetEncryption).toBeInstanceOf(Function)
      expect(protocol.packetDecryption).toBeInstanceOf(Function)
      expect(protocol.packetObfuscation).toBeInstanceOf(Function)
      expect(protocol.packetDeobfuscation).toBeInstanceOf(Function)
      expect(protocol.send).toBe(sendPacket)
      expect(protocol.receive).toBeInstanceOf(Function)
      expect(protocol.getLogger).toBeInstanceOf(Function)
      expect(Object.isFrozen(protocol)).toBe(true)
    })

    it('returns logger from getLogger', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 1)

      const sendPacket = () => void 0
      const receivePacket = () => void 0

      const protocol = protocolProvider(sendPacket, receivePacket)

      const retrievedLogger = protocol.getLogger()
      expect(retrievedLogger).toBe(logger)
    })
  })

  describe('end-to-end encryption and obfuscation', () => {
    it('encrypts and decrypts data through protocol', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 1)

      const sendPacket = () => void 0
      const receivePacket = () => void 0

      const protocol = protocolProvider(sendPacket, receivePacket)

      const data = await createData(testUUIDs.data1, 1, testMessages.simple)
      const unencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const keyPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data: { ...data, key: 'test-dynamic-key' },
      }
      protocol.receive(keyPacket)

      const encryptedPacket = await protocol.packetEncryption(unencryptedPacket)

      expect(encryptedPacket).toBeDefined()
      expect(encryptedPacket.origin).toBe(testUUIDs.origin1)
      expect(encryptedPacket.target).toBe(testUUIDs.target1)
      expect(encryptedPacket.data).toBeInstanceOf(Uint8Array)

      const decryptedPacket = await protocol.packetDecryption(encryptedPacket)

      expect(decryptedPacket).toBeDefined()
      expect(decryptedPacket.origin).toBe(testUUIDs.origin1)
      expect(decryptedPacket.target).toBe(testUUIDs.target1)
      expect(decryptedPacket.data).toEqual(data)
    })

    it('obfuscates and deobfuscates packets through protocol', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 1000) // 1 second refresh rate

      const sendPacket = () => void 0
      const receivePacket = () => void 0

      const protocol = protocolProvider(sendPacket, receivePacket)

      const data = await createData(testUUIDs.data1, 1, testMessages.simple)
      const unencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const keyPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data: { ...data, key: 'test-dynamic-key' },
      }
      protocol.receive(keyPacket)

      const encryptedPacket = await protocol.packetEncryption(unencryptedPacket)
      const serializedPacket = serializePacket(encryptedPacket)
      const obfuscatedPacket = await protocol.packetObfuscation(serializedPacket)

      expect(obfuscatedPacket).toBeInstanceOf(Uint8Array)

      const deobfuscatedPacket = await protocol.packetDeobfuscation(obfuscatedPacket)
      const deserializedPacket = deserializePacket(deobfuscatedPacket)
      const decryptedPacket = await protocol.packetDecryption(deserializedPacket)

      expect(decryptedPacket).toBeDefined()
      expect(decryptedPacket.origin).toBe(testUUIDs.origin1)
      expect(decryptedPacket.target).toBe(testUUIDs.target1)
      expect(decryptedPacket.data).toEqual(data)
    })
  })

  describe('error handling', () => {
    it('triggers error when creating protocol provider without valid logger', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)

      expect(() => createProtocol(null as never)).toThrow('Cannot create protocol provider without a valid logger')
    })

    it('triggers error when creating protocol provider without valid refresh rate', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()

      expect(() => createProtocol(logger, -1)).toThrow('Cannot create protocol provider without a valid refresh rate')
    })

    it('triggers error when creating protocol without valid send function', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 1)

      const receivePacket = () => void 0

      expect(() => protocolProvider(null as never, receivePacket)).toThrow('Cannot create protocol without a valid send function')
    })

    it('triggers error when creating protocol without valid receive function', () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const textEncoder = (text: string): Uint8Array => new TextEncoder().encode(text)
      const textDecoder = (data: Uint8Array): string => new TextDecoder().decode(data)
      const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)
      const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
      const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
        obfuscatePacket,
        deobfuscatePacket,
        getTimeBasedPassword,
        getTimeBasedPasswords
      )

      const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)
      const logger = createMockLogger()
      const protocolProvider = createProtocol(logger, 1)

      const sendPacket = () => void 0

      expect(() => protocolProvider(sendPacket, null as never)).toThrow('Cannot create protocol without a valid receive function')
    })
  })
})
