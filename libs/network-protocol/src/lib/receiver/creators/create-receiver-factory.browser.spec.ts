/**
 * Browser tests for receiver factory.
 * Node version: create-receiver-factory.spec.ts (identical except for imports)
 */

import type { UnencryptedPacket } from '../../packet'
import { createHash, encrypt, decrypt } from '@hyperfrontend/cryptography/browser'
import { uint8ArrayToBase64, base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
import { sleep } from '@hyperfrontend/time-utils'
import { createDataFactory } from '../../data/creators'
import { createDataEncrypter, createDataDecrypter } from '../../data/security'
import { createPacketEncrypter, createPacketDecrypter } from '../../packet/security/encryption'
import { createPacketObfuscator, createPacketDeobfuscator } from '../../packet/security/obfuscation'
import { createSerializedEncryptedPacketCreator, createDeserializedEncryptedPacketCreator } from '../../packet/creators'
import { createReceiverFactory } from './create-receiver-factory'
import { testUUIDs, testLabels, testMessages, createMockLogger } from './test-fixtures'

describe('createReceiverFactory (Browser)', () => {
  let createData: ReturnType<typeof createDataFactory>

  beforeAll(() => {
    createData = createDataFactory(createHash)
  })

  describe('receiver creation', () => {
    it('creates receiver with all required properties', () => {
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivePacket = () => void 0
      const logger = createMockLogger()

      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDeobfuscation = async (packet: any) => deobfuscatePacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async (packet: any) => decryptPacket(packet, 'password')

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      expect(receiver).toBeDefined()
      expect(receiver.receive).toBeInstanceOf(Function)
      expect(receiver.stop).toBeInstanceOf(Function)
      expect(receiver.resume).toBeInstanceOf(Function)
      expect(receiver.deobfuscationQueue).toBeDefined()
      expect(receiver.deserializationQueue).toBeDefined()
      expect(receiver.decryptionQueue).toBeDefined()
      expect(Object.isFrozen(receiver)).toBe(true)
    })

    it('creates receiver with functional queue size properties', () => {
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivePacket = () => void 0
      const logger = createMockLogger()
      const packetDeobfuscation = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: 'encrypted' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: <any>{} })

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      expect(typeof receiver.deobfuscationQueue.size).toBe('number')
      expect(typeof receiver.deserializationQueue.size).toBe('number')
      expect(typeof receiver.decryptionQueue.size).toBe('number')
    })
  })

  describe('receiving messages', () => {
    it('receives message through complete pipeline', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivedPackets: UnencryptedPacket[] = []
      const receivePacket = (packet: UnencryptedPacket) => receivedPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDeobfuscation = async (packet: any) => deobfuscatePacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async (packet: any) => decryptPacket(packet, 'password')

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      const data = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)
      const unencryptedPacket = { origin: testUUIDs.origin1, target: testUUIDs.target1, data }
      const encryptedPacket = await encryptPacket(unencryptedPacket, 'password')
      const serializedPacket = serializePacket(encryptedPacket)
      const obfuscatedPacket = await obfuscatePacket(serializedPacket, 'password')

      receiver.receive(obfuscatedPacket)

      await sleep(300 + 50)

      expect(receivedPackets.length).toBeGreaterThan(0)
      expect(receivedPackets[0].origin).toBe(testUUIDs.origin1)
      expect(receivedPackets[0].target).toBe(testUUIDs.target1)
    })

    it('receives multiple messages', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivedPackets: UnencryptedPacket[] = []
      const receivePacket = (packet: UnencryptedPacket) => receivedPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDeobfuscation = async (packet: any) => deobfuscatePacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async (packet: any) => decryptPacket(packet, 'password')

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      const data1 = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)
      const data2 = await createData('550e8400-e29b-41d4-a716-446655440005', 2, testMessages.nested)

      const packet1 = { origin: testUUIDs.origin1, target: testUUIDs.target1, data: data1 }
      const packet2 = { origin: testUUIDs.origin2, target: testUUIDs.target2, data: data2 }

      const encrypted1 = await encryptPacket(packet1, 'password')
      const encrypted2 = await encryptPacket(packet2, 'password')

      const serialized1 = serializePacket(encrypted1)
      const serialized2 = serializePacket(encrypted2)

      const obfuscated1 = await obfuscatePacket(serialized1, 'password')
      const obfuscated2 = await obfuscatePacket(serialized2, 'password')

      receiver.receive(obfuscated1)
      receiver.receive(obfuscated2)

      await sleep(700)

      expect(receivedPackets.length).toBe(2)
    })
  })

  describe('queue management', () => {
    it('stops all queues when stop is called', async () => {
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivedPackets: UnencryptedPacket[] = []
      const receivePacket = (packet: UnencryptedPacket) => receivedPackets.push(packet)
      const logger = createMockLogger()

      const packetDeobfuscation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return { origin: testUUIDs.origin1, target: testUUIDs.target1, data: 'encrypted' }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: <any>{} })

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      receiver.receive(new Uint8Array([1, 2, 3]))
      receiver.stop()

      await new Promise((resolve) => setTimeout(resolve, 50))

      const initialCount = receivedPackets.length
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedPackets.length).toBe(initialCount)
    })

    it('resumes processing after stop', async () => {
      const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivedPackets: UnencryptedPacket[] = []
      const receivePacket = (packet: UnencryptedPacket) => receivedPackets.push(packet)
      const logger = createMockLogger()

      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDeobfuscation = async (packet: any) => deobfuscatePacket(packet, 'password')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async (packet: any) => decryptPacket(packet, 'password')

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      const data = await createData('550e8400-e29b-41d4-a716-446655440005', 1, testMessages.simple)
      const packet = { origin: testUUIDs.origin1, target: testUUIDs.target1, data }
      const encrypted = await encryptPacket(packet, 'password')
      const serialized = serializePacket(encrypted)
      const obfuscated = await obfuscatePacket(serialized, 'password')

      receiver.receive(obfuscated)
      receiver.stop()
      receiver.resume()

      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(receivedPackets.length).toBeGreaterThan(0)
    })
  })

  describe('frozen object validation', () => {
    it('returns frozen receiver object', () => {
      const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const createReceiver = createReceiverFactory(deserializePacket)

      const receivePacket = () => void 0
      const logger = createMockLogger()
      const packetDeobfuscation = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: 'encrypted' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packetDecryption = async () => ({ origin: testUUIDs.origin1, target: testUUIDs.target1, data: <any>{} })

      const receiver = createReceiver(testLabels.receiver1, receivePacket, logger, packetDeobfuscation, packetDecryption)

      expect(Object.isFrozen(receiver)).toBe(true)
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(<any>receiver).receive = () => void 0
      }).toThrow()
    })
  })
})
