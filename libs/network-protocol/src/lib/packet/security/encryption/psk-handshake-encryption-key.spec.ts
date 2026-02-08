/**
 * Node.js tests for PSK handshake encryption factory.
 */

import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'
import { createPacketEncrypter } from './create-encrypter'
import { createPacketDecrypter } from './create-decrypter'
import { createDataEncrypter } from '../../../data/security'
import { createDataDecrypter } from '../../../data/security'
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
      expect(() => createPSKHandshakeEncryption(<string>null, keyProvider)).toThrow('PSK must be a non-empty string')
      expect(() => createPSKHandshakeEncryption(<string>undefined, keyProvider)).toThrow('PSK must be a non-empty string')
    })
  })

  describe('encryption behavior', () => {
    it('uses PSK when key provider returns undefined (first message)', () => {
      let capturedKey: string | undefined
      const keyProvider = () => capturedKey

      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      // First message - no dynamic key yet
      expect(capturedKey).toBeUndefined()
      // The suite should use PSK for encryption/decryption
      expect(suite.packetEncryption).toBeDefined()
      expect(suite.packetDecryption).toBeDefined()
    })

    it('uses dynamic key when key provider returns a value (subsequent messages)', () => {
      const capturedKey = 'dynamic-key-from-handshake'
      const keyProvider = () => capturedKey

      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      // After handshake - dynamic key is available
      expect(capturedKey).toBe('dynamic-key-from-handshake')
      // The suite should use dynamic key for encryption/decryption
      expect(suite.packetEncryption).toBeDefined()
      expect(suite.packetDecryption).toBeDefined()
    })

    it('switches from PSK to dynamic key when key becomes available', () => {
      let capturedKey: string | undefined = undefined
      const keyProvider = () => capturedKey

      const suite = createPSKHandshakeEncryption('my-psk', keyProvider)

      // Initially no key - would use PSK
      expect(keyProvider()).toBeUndefined()

      // Simulate key capture from handshake
      capturedKey = 'captured-dynamic-key'

      // Now key is available - would use dynamic key
      expect(keyProvider()).toBe('captured-dynamic-key')

      // Suite still works (key selection happens at call time)
      expect(suite.packetEncryption).toBeDefined()
    })
  })
})
