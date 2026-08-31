import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'
import { createDataDecrypter } from '../../../data/security/create-decrypter'
import { createDataEncrypter } from '../../../data/security/create-encrypter'
import { createPacketDecrypter } from './create-decrypter'
import { createPacketEncrypter } from './create-encrypter'
import { createPSKHandshakeEncryptionFactory } from './psk-handshake-encryption-key'

describe('createPSKHandshakeEncryptionFactory (Node.js)', () => {
  let createPSKHandshakeEncryption: ReturnType<typeof createPSKHandshakeEncryptionFactory>

  beforeAll(() => {
    const encryptData = createDataEncrypter(encrypt)
    const decryptData = createDataDecrypter(decrypt)
    const encryptPacket = createPacketEncrypter(encryptData)
    const decryptPacket = createPacketDecrypter(decryptData)

    createPSKHandshakeEncryption = createPSKHandshakeEncryptionFactory(encryptPacket, decryptPacket)
  })

  describe('factory creation', () => {
    it('creates encryption suite with valid PSK and key provider', () => {
      const keyProvider = () => undefined
      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      expect(suite).toBeDefined()
      expect(suite.packetEncryption).toBeInstanceOf(Function)
      expect(suite.packetDecryption).toBeInstanceOf(Function)
      expect(Object.isFrozen(suite)).toBe(true)
    })

    it('throws error for empty PSK', () => {
      const keyProvider = () => undefined
      expect(() => createPSKHandshakeEncryption('', keyProvider)).toThrow('PSK must be a non-empty string')
    })

    it('throws error for non-string PSK', () => {
      const keyProvider = () => undefined
      expect(() => createPSKHandshakeEncryption(null as string, keyProvider)).toThrow('PSK must be a non-empty string')
      expect(() => createPSKHandshakeEncryption(undefined as string, keyProvider)).toThrow('PSK must be a non-empty string')
    })
  })

  describe('encryption behavior', () => {
    it('uses PSK when key provider returns undefined (first message)', () => {
      let capturedKey: string | undefined
      const keyProvider = () => capturedKey

      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      expect(capturedKey).toBeUndefined()
      expect(suite.packetEncryption).toBeDefined()
      expect(suite.packetDecryption).toBeDefined()
    })

    it('uses dynamic key when key provider returns a value (subsequent messages)', () => {
      const capturedKey = 'dynamic-key-from-handshake'
      const keyProvider = () => capturedKey

      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      expect(capturedKey).toBe('dynamic-key-from-handshake')
      expect(suite.packetEncryption).toBeDefined()
      expect(suite.packetDecryption).toBeDefined()
    })

    it('switches from PSK to dynamic key when key becomes available', () => {
      let capturedKey: string | undefined = undefined
      const keyProvider = () => capturedKey

      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      expect(keyProvider()).toBeUndefined()

      capturedKey = 'captured-dynamic-key'

      expect(keyProvider()).toBe('captured-dynamic-key')

      expect(suite.packetEncryption).toBeDefined()
    })
  })
})
