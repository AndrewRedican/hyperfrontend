import { before as beforeAll } from 'node:test'
import { createHash, encrypt } from '@hyperfrontend/cryptography/node'
import { uint8ArrayToBase64 } from '@hyperfrontend/string-utils/node'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDataFactory } from '../../data/creators/create-data-factory'
import { createDataEncrypter } from '../../data/security/create-encrypter'
import { createSerializedEncryptedPacketCreator } from '../../packet/creators/create-serialized-encrypted-packet-creator'
import { createPacketEncrypter } from '../../packet/security/encryption/create-encrypter'
import { createPacketObfuscator } from '../../packet/security/obfuscation/create-obfuscator'
import { createSenderFactory } from './create-sender-factory'
import { testUUIDs, testLabels, testMessages, createMockLogger } from './test-fixtures'

describe('createSenderFactory (Node.js)', () => {
  let createData: ReturnType<typeof createDataFactory>

  beforeAll(() => {
    createData = createDataFactory(createHash)
  })

  describe('sender creation', () => {
    it('creates sender with all required properties', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sentPackets: Uint8Array[] = []
      const sendPacket = (packet: Uint8Array) => sentPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetEncryption = async (packet: any) => encryptPacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetObfuscation = async (packet: any) => obfuscatePacket(packet, 'password')

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      expect(sender).toBeDefined()
      expect(sender.send).toBeInstanceOf(Function)
      expect(sender.stop).toBeInstanceOf(Function)
      expect(sender.resume).toBeInstanceOf(Function)
      expect(sender.encryptionQueue).toBeDefined()
      expect(sender.serializationQueue).toBeDefined()
      expect(sender.obfuscationQueue).toBeDefined()
      expect(Object.isFrozen(sender)).toBe(true)
    })

    it('creates sender with functional queue size properties', () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sendPacket = () => void 0
      const logger = createMockLogger()
      const packetEncryption = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: new Uint8Array() })
      const packetObfuscation = async () => new Uint8Array()

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      expect(typeof sender.encryptionQueue.size).toBe('number')
      expect(typeof sender.serializationQueue.size).toBe('number')
      expect(typeof sender.obfuscationQueue.size).toBe('number')
    })
  })

  describe('sending messages', () => {
    it('sends message through complete pipeline', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sentPackets: Uint8Array[] = []
      const sendPacket = (packet: Uint8Array) => sentPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetEncryption = async (packet: any) => encryptPacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetObfuscation = async (packet: any) => obfuscatePacket(packet, 'password')

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      const data = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)
      sender.send(testUUIDs.origin1, testUUIDs.target1, data)

      await new Promise((resolve) => setTimeout(resolve, 250))

      expect(sentPackets.length).toBeGreaterThan(0)
      expect(sentPackets[0]).toBeInstanceOf(Uint8Array)
    })

    it('sends multiple messages', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sentPackets: Uint8Array[] = []
      const sendPacket = (packet: Uint8Array) => sentPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetEncryption = async (packet: any) => encryptPacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetObfuscation = async (packet: any) => obfuscatePacket(packet, 'password')

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      const data1 = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)
      const data2 = await createData('550e8400-e29b-41d4-a716-446655440005', 2, testMessages.nested)

      sender.send(testUUIDs.origin1, testUUIDs.target1, data1)
      sender.send(testUUIDs.origin2, testUUIDs.target2, data2)

      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(sentPackets.length).toBe(2)
    })
  })

  describe('queue management', () => {
    it('stops all queues when stop is called', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sentPackets: Uint8Array[] = []
      const sendPacket = (packet: Uint8Array) => sentPackets.push(packet)
      const logger = createMockLogger()

      const packetEncryption = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return { origin: testUUIDs.origin1, target: testUUIDs.target1, data: new Uint8Array() }
      }
      const packetObfuscation = async () => new Uint8Array()

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      const data = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)
      sender.send(testUUIDs.origin1, testUUIDs.target1, data)
      sender.stop()

      await new Promise((resolve) => setTimeout(resolve, 50))

      const initialCount = sentPackets.length
      await new Promise((resolve) => setTimeout(resolve, 250))

      expect(sentPackets.length).toBe(initialCount)
    })

    it('resumes processing after stop', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sentPackets: Uint8Array[] = []
      const sendPacket = (packet: Uint8Array) => sentPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetEncryption = async (packet: any) => encryptPacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetObfuscation = async (packet: any) => obfuscatePacket(packet, 'password')

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      const data = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)

      sender.send(testUUIDs.origin1, testUUIDs.target1, data)
      sender.stop()
      sender.resume()

      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(sentPackets.length).toBeGreaterThan(0)
    })
  })

  describe('frozen object validation', () => {
    it('returns frozen sender object', () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const createSender = createSenderFactory(serializePacket)

      const sendPacket = () => void 0
      const logger = createMockLogger()
      const packetEncryption = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: new Uint8Array() })
      const packetObfuscation = async () => new Uint8Array()

      const sender = createSender(testLabels.sender1, sendPacket, logger, packetEncryption, packetObfuscation)

      expect(Object.isFrozen(sender)).toBe(true)
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(sender as any).send = () => void 0
      }).toThrow()
    })
  })
})
