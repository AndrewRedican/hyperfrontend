import type { Data } from '../../data/model'
import type {
  ObfuscatedPacket,
  PacketBase,
  UnencryptedPacket,
  UnserializedEncryptedPacket,
  SerializedEncryptedPacket,
  PacketEncryption,
  PacketDecryption,
  PacketObfuscation,
  PacketDeobfuscation,
  PacketSerialization,
  PacketDeserialization,
} from '../model'
import { createTextEncoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { unencryptedData, encryptedData, password as passw0rd } from '../../data/security/mocks'

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Mock function to encrypt a packet.
 *
 * @param _packet - The unencrypted packet
 * @param _password - The encryption password
 * @returns Promise resolving to encrypted data
 *
 * @example
 * ```typescript
 * const encrypted = await encryptPacket(unencryptedPacket, 'secret')
 * // => Uint8Array (mock encrypted data)
 * ```
 */
export const encryptPacket = async (_packet: UnencryptedPacket, _password: string): Promise<Uint8Array> => encryptedData

/**
 * Mock function to decrypt a packet.
 *
 * @param _encrypted - The encrypted data
 * @param _password - The decryption password
 * @returns Promise resolving to decrypted data
 *
 * @example
 * ```typescript
 * const decrypted = await decryptPacket(encryptedData, 'secret')
 * // => { message: 'hello' } (mock decrypted data)
 * ```
 */
export const decryptPacket = async (_encrypted: Uint8Array, _password: string): Promise<Data> => unencryptedData

/**
 * Mock function to obfuscate a packet.
 *
 * @param _packet - The packet data to obfuscate
 * @param _password - The obfuscation password
 * @returns Promise resolving to obfuscated data
 *
 * @example
 * ```typescript
 * const obfuscated = await obfuscatePacket(serializedData, 'secret')
 * // => Uint8Array([1, 2, 3, 4, 5])
 * ```
 */
export const obfuscatePacket = async (_packet: Uint8Array, _password: string): Promise<Uint8Array> => createUint8Array([1, 2, 3, 4, 5])

/**
 * Mock function to deobfuscate a packet.
 *
 * @param _obfuscated - The obfuscated data
 * @param _password - The deobfuscation password
 * @returns Promise resolving to deobfuscated data
 *
 * @example
 * ```typescript
 * const deobfuscated = await deobfuscatePacket(obfuscatedData, 'secret')
 * // => Uint8Array (mock encrypted data)
 * ```
 */
export const deobfuscatePacket = async (_obfuscated: Uint8Array, _password: string): Promise<Uint8Array> => encryptedData
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Creates a serialized encrypted packet from an unserialized one.
 *
 * @param packet - The unserialized encrypted packet
 * @returns A serialized encrypted packet
 *
 * @example
 * ```typescript
 * const serialized = createSerializedEncryptedPacket({
 *   origin: 'uuid-a',
 *   target: 'uuid-b',
 *   data: encryptedBytes,
 * })
 * // => { origin: 'uuid-a', target: 'uuid-b', data: 'base64...' }
 * ```
 */
export const createSerializedEncryptedPacket = (packet: UnserializedEncryptedPacket): SerializedEncryptedPacket => ({
  origin: packet.origin,
  target: packet.target,
  data: 'oOmL+BK+8GjokRnMdgcLuWvS1c/gCEMaB3EVXC3SRoMuGYVjMHRUEN9SLj3N5fswxvCUJ3OZNFqSDf/h1c8BsjP2p+9leJphshJb0Fkf4F1DgNmwFg1wsAEitjOcpAklPLt4pQQ4U5v/hWWLZM7KIb83T9iodcsQKK3CB1O/1SjoJfHQ+X2ZGxBQRwywVSqS34kDlZLdscQvKVwO/OppEqxW7x/lIrKd66ByqHzVCNInQyXhERKmriWoPPtjdMK0lfebQeOwNpGmOyECDg0uJ6iO6jYxdIRctzSqLLqDANNNFvw43HZuYcjXZ2k1jfK7sp0Gh8fUsGqFTwwNYJ0+Q+nnBhNVqoAnH4Y4TRoUfd7rNmX7iWKHvGac98fWnU8IWfmFoqCpkTNw2zWaSGsofS97se/THz8Yb9J9fGjo23+MeLxRFWl8UG9oCNJhj4zV+J9bPtwewQSsG+q1xNCV90losxn4sOgPi/gwAeYsSXvR/wzXMnlHpyKwmDUD8X0jPQ==',
})

/**
 * Creates a deserialized (unserialized) encrypted packet from a serialized one.
 *
 * @param packet - The serialized encrypted packet
 * @returns An unserialized encrypted packet
 *
 * @example
 * ```typescript
 * const deserialized = createDeserializedEncryptedPacket({
 *   origin: 'uuid-a',
 *   target: 'uuid-b',
 *   data: 'base64string',
 * })
 * // => { origin: 'uuid-a', target: 'uuid-b', data: Uint8Array }
 * ```
 */
export const createDeserializedEncryptedPacket = (packet: SerializedEncryptedPacket): UnserializedEncryptedPacket => ({
  origin: packet.origin,
  target: packet.target,
  data: encryptedData,
})

/** Re-exported password for testing. */
export const password = passw0rd

/**
 * Provides the encryption key for packet operations.
 *
 * @returns The password used for encryption
 *
 * @example
 * ```typescript
 * const key = keyProvider()
 * // => 'test-password' (mock password)
 * ```
 */
export const keyProvider = () => password

export const obfuscatedPacket: ObfuscatedPacket = createUint8Array([
  107, 101, 185, 146, 227, 117, 228, 196, 155, 49, 39, 113, 170, 252, 169, 100, 176, 154, 204, 119, 226, 193, 162, 164, 169, 247, 146, 248,
  208, 106, 220, 192, 2, 27, 45, 232, 139, 46, 97, 217, 209, 189, 93, 73, 139, 152, 182, 32, 199, 66, 1, 67, 176, 200, 125, 172, 203, 235,
  97, 68, 188, 244, 168, 107, 167, 78, 251, 253, 44, 22, 251, 14, 183, 177, 62, 221, 91, 54, 33, 121, 18, 144, 103, 109, 93, 63, 10, 182,
  244, 178, 14, 94, 234, 128, 32, 243, 182, 166, 167, 84, 143, 146, 238, 153, 54, 61, 7, 160, 255, 74, 40, 42, 61, 142, 105, 88, 45, 176,
  56, 53, 146, 154, 248, 202, 57, 69, 243, 226, 147, 48, 3, 48, 191, 217, 149, 220, 79, 22, 190, 223, 243, 38, 9, 214, 51, 4, 105, 145, 235,
  54, 224, 61, 109, 222, 141, 194, 121, 251, 0, 196, 124, 16, 19, 65, 91, 136, 84, 205, 93, 49, 82, 243, 104, 69, 212, 32, 85, 6, 111, 197,
  102, 240, 237, 32, 4, 15, 35, 138, 149, 236, 60, 215, 99, 112, 170, 150, 230, 130, 116, 22, 107, 46, 105, 222, 47, 41, 17, 237, 232, 201,
  66, 201, 21, 70, 61, 243, 93, 59, 226, 54, 217, 177, 9, 135, 168, 197, 253, 122, 116, 183, 58, 167, 151, 121, 92, 172, 72, 60, 221, 165,
  101, 125, 122, 177, 233, 72, 154, 45, 229, 242, 136, 172, 157, 93, 195, 43, 218, 18, 48, 144, 113, 75, 20, 98, 254, 252, 192, 240, 62,
  228, 244, 76, 160, 122, 27, 220, 92, 195, 137, 126, 132, 191, 63, 201, 11, 179, 91, 232, 227, 89, 231, 129, 181, 114, 67, 198, 62, 158,
  245, 129, 108, 238, 146, 58, 34, 49, 115, 255, 76, 126, 165, 62, 195, 251, 207, 51, 216, 233, 38, 35, 171, 118, 58, 183, 168, 188, 52, 52,
  46, 179, 60, 29, 40, 170, 201, 117, 59, 82, 75, 57, 35, 89, 24, 139, 237, 210, 186, 180, 78, 178, 70, 123, 209, 55, 43, 39, 66, 96, 5, 83,
  151, 215, 88, 79, 82, 26, 63, 181, 251, 211, 138, 79, 124, 92, 4, 187, 177, 177, 82, 248, 61, 115, 120, 88, 131, 71, 46, 232, 86, 85, 183,
  122, 134, 64, 243, 29, 214, 9, 38, 244, 196, 217, 245, 232, 3, 92, 102, 72, 103, 39, 29, 165, 169, 79, 164, 180, 231, 116, 102, 249, 179,
  54, 212, 172, 56, 23, 102, 19, 56, 193, 177, 230, 37, 108, 30, 121, 253, 105, 23, 113, 240, 234, 198, 241, 108, 100, 106, 35, 247, 37, 46,
  133, 211, 111, 178, 36, 79, 11, 104, 176, 135, 228, 253, 204, 9, 179, 49, 9, 56, 155, 24, 214, 58, 208, 8, 185, 220, 194, 173, 219, 42,
  38, 230, 209, 120, 255, 91, 140, 143, 65, 38, 250, 89, 160, 87, 146, 242, 226, 237, 246, 138, 247, 188, 118, 37, 222, 249, 66, 250, 181,
  223, 10, 120, 201, 243, 146, 178, 64, 242, 13, 27, 13, 252, 160, 238, 5, 243, 249, 235, 200, 102, 22, 43, 216, 34, 176, 51, 1, 167, 214,
  52, 189, 145, 107, 86, 133, 117, 195, 4, 61, 60, 71, 151, 244, 208, 78, 38, 83, 114, 30, 100, 2, 84, 174, 193, 121, 8, 26, 203, 64, 47,
  182, 250, 160, 74, 121, 189, 78, 51, 43, 189, 75, 40, 41, 60, 128, 123, 174, 186, 190, 136, 219, 0, 80, 68, 100, 41, 1, 80, 28, 54, 247,
  165, 239, 11, 133, 57, 149, 79, 179, 34, 152, 129, 2, 201, 32, 62, 177, 180, 18, 58, 11, 42, 22, 66, 7, 91, 216, 15, 86, 199, 254, 250,
  46, 152, 127, 162, 232, 84, 25, 0, 102, 122, 72, 69, 194, 126, 54, 220, 110, 56, 59, 198, 183, 165, 30, 181, 11, 183, 26, 17, 248, 101,
  81, 17, 181, 120, 94, 134, 19, 30, 92, 137, 166, 172, 73, 101, 92, 115, 162, 141, 57, 82, 154, 29, 62, 22, 91, 62, 62, 163, 176, 63, 205,
  135, 9, 23, 183, 144, 171, 58, 126, 133, 88, 191, 236, 79, 163, 247, 2, 135, 156, 167, 111, 166, 48, 93, 132, 98, 171, 194, 241, 206, 193,
  125, 248, 235, 182, 236, 196, 200, 253, 197, 3, 213, 236, 245, 130, 123, 120, 90, 199, 100, 130, 108, 98, 249, 200, 121, 214, 193, 253,
  191, 179, 18, 125, 178, 146, 209, 57, 189, 101, 142, 33, 101, 164, 248, 193, 93, 94, 31, 74, 46, 187, 157, 12, 254, 188, 152, 67, 121,
  140, 217, 135, 224, 153, 209, 251, 42, 140, 69, 23, 33, 227, 9, 106, 91, 57, 234, 43, 21, 241, 181, 82, 239, 45, 44, 217, 136, 76, 96,
  182, 73, 67, 174, 32, 235, 196, 4, 193, 81, 154, 165, 232, 193, 82, 26, 41, 105, 236, 235, 42, 146, 16, 112, 10, 110, 42, 194, 95, 45,
  247, 233, 52, 220, 42, 26, 61, 102, 243, 126, 137, 196, 197, 10, 187, 30, 158, 171, 228, 179, 68, 48, 130, 125, 139, 134, 7, 251, 58, 1,
  41, 94, 114, 121, 243, 239, 81, 138, 33, 104, 48, 157, 232, 29, 161, 75, 108, 170, 176, 255, 46, 132, 246, 30, 170, 30, 109, 99, 92, 112,
  172, 104, 104, 199, 180, 97, 72, 234, 51, 176, 197, 40, 150, 186, 235, 205, 85, 235, 198, 73, 158, 184, 43, 44, 245, 41, 25, 230, 230,
  126, 187, 142, 115, 120, 26, 70, 78, 42, 215, 13, 161, 114, 0, 4, 97, 202, 170, 116, 230, 197, 135, 87, 108, 178, 74, 128, 88, 77, 62,
  120, 188, 185, 222, 155, 147, 249, 25, 246, 160, 37, 83, 34, 182, 236, 252, 72, 77, 170, 92, 27, 207, 206, 109, 47, 175, 239, 108, 192,
  52, 129, 202, 85, 51, 187, 89, 250, 182, 98, 203, 63, 40, 14, 167, 131, 32, 164, 216, 196, 55, 145, 240, 201, 19, 220, 32, 163, 48, 110,
  151, 20, 75, 20, 147, 83, 185, 247, 87, 136, 189, 161, 198, 127, 248, 120, 32, 25, 247, 177, 207, 64, 40, 2, 35, 137, 53, 185, 46, 50,
  209, 216, 211, 67, 146, 66, 138, 167, 152, 117, 34, 13, 207, 248, 14, 103, 93, 52, 174, 189, 41, 111, 206, 142, 99, 244, 123, 96, 183,
  187, 64, 127, 84, 76, 92, 207, 189, 63, 14, 50, 192, 109, 163, 45, 185, 159, 8, 34, 12, 157, 214, 219, 56, 189, 22, 16, 89, 20, 168, 235,
  179, 62, 113, 8, 175, 171, 183, 212, 136, 185, 151, 51, 173, 134, 111, 52, 108, 88, 138, 29, 212, 186, 124, 209, 223, 224, 36, 117, 46,
  214, 98, 26, 53, 95, 136, 8, 143, 30, 215, 173, 34, 58, 26, 252, 176, 238, 238, 93, 190, 230, 17, 7, 210, 146, 44, 89, 209, 134, 91, 57,
  97, 174, 53, 23, 3, 221, 93, 71, 39, 148, 194, 144, 12, 105, 185, 86, 65, 87, 61, 103, 28, 21, 6, 201, 226, 252, 138, 164, 152, 248, 214,
  79, 15, 107, 50, 231, 201, 90, 239, 153, 109, 20, 232, 222, 78, 77, 47, 251, 184, 218, 114, 18, 118, 174, 99, 83, 212, 33, 136, 18, 53,
  156, 76, 218, 21, 109, 155, 104, 188, 217, 250, 127, 126, 19, 65, 101, 225, 50, 95, 3, 78, 64, 16, 151, 46, 110, 13, 180, 123, 183, 60,
  37, 125, 136, 176, 76, 28, 87, 238, 56, 7, 88, 212, 234, 243, 229, 187, 220, 128, 190, 17, 208, 181, 168, 239, 86, 195, 247, 51, 199, 203,
  104, 33, 58, 124, 43, 240, 76, 152, 161, 45, 5, 96, 37, 115, 59, 251, 41, 6, 52, 155, 19, 223, 5, 244, 88, 122, 82, 168, 169, 24, 243,
  218, 217, 234, 63, 52, 232, 170, 180, 47, 187, 48, 62, 123, 142, 2, 254, 95, 12, 164, 110, 22, 197, 135, 161, 244, 49, 5, 161, 218, 104,
  152, 98, 207, 236, 91, 90, 24, 231, 79, 117, 27, 141, 74, 17, 40, 146, 217, 39, 137, 13, 179, 202, 84, 119, 59, 231, 98, 127, 212, 98, 84,
  79, 71, 200, 204, 158, 118, 166, 247, 86, 95, 91, 236, 73, 163, 110, 49, 1, 1, 134, 106, 220, 237, 85, 212, 169, 24, 15, 120, 26, 140,
  212, 146, 117, 114, 110, 238, 9, 56, 119, 19, 48, 48, 30, 6, 187, 240, 107, 217, 27, 51, 149, 2, 168, 153, 58, 100, 110, 248, 54, 218, 80,
  64, 111, 143, 90, 35, 101, 232, 214, 218, 252, 162, 117, 101, 82, 234, 253, 34, 15, 0, 246, 175, 254, 255, 187, 34, 114, 138, 94, 231,
  204, 184, 121, 132, 104, 151, 75, 126, 222, 197, 99, 250, 240, 81, 194, 79, 134, 229, 36, 42, 212, 224, 141, 234, 225, 251, 191, 207, 39,
  60, 188, 116, 70, 32, 161, 204, 165, 114, 236, 123, 15, 16, 86, 29, 235, 85, 49, 216, 177, 122, 155, 228, 33, 94, 188, 230, 206, 100, 255,
  224, 136, 42, 130, 83, 186, 191, 83, 232, 58, 36, 8, 85, 150, 16, 221, 191, 15, 187, 234, 191, 133, 72, 137, 241, 180, 15, 164, 28, 81,
  208, 38, 56, 134, 15, 31, 243, 169, 2, 159, 248, 162, 200, 192, 232, 79, 190, 218, 231, 119, 187, 211, 219, 96, 172, 124, 182, 193, 125,
  74, 242, 165, 242, 231, 210, 83, 206, 203, 13, 134, 161, 239, 98, 146, 15, 1, 75, 17, 54, 35, 19, 162, 3, 113, 220, 90, 189, 218, 169,
  229, 175, 64, 103, 40, 59, 21, 48, 73, 30, 4, 21, 19, 145, 248, 174, 128, 110, 217, 214, 54, 108, 199, 106, 30, 0, 194, 223, 95, 30, 185,
  114, 45, 93, 57, 210, 218, 16, 177, 102, 38, 15, 183, 140, 169, 95, 181, 154, 21, 129, 106, 192, 10, 106, 51, 210, 144, 54, 15, 221, 101,
  38, 77, 204, 87, 232, 240, 194, 166, 96, 143, 211, 212, 80, 106, 5, 189, 28, 209, 234, 208, 188, 5, 54, 239, 61, 22, 2, 220, 143, 1, 63,
  109, 97, 11, 169, 15, 162, 98, 182, 162, 74, 220, 63, 56, 5, 74, 148, 54, 213, 198, 81, 205, 26, 82, 234, 139, 251, 202, 114, 109, 251,
  13, 187, 176, 203, 187, 232, 216, 142, 210, 129, 87, 139, 119, 218, 37, 158, 115, 102, 169, 45, 138, 38, 206, 72, 93, 16, 53, 74, 255, 71,
  38, 244, 124, 117, 115, 182, 202, 8, 65, 180, 235, 21, 70, 217, 154, 64, 147, 192, 16, 113, 19, 198, 169, 236, 187, 227, 118, 241, 235,
  190, 13, 141, 212, 213, 75, 6, 101, 241, 111, 77, 242, 111, 10, 186, 180, 93, 125, 37, 12, 32, 255, 31, 134, 143, 2, 63, 174, 136, 247,
  112, 21, 54, 148, 70, 102, 223, 53, 210, 47, 187, 198, 140, 127, 189, 61, 158, 242, 89, 170, 90, 93, 248, 11, 25, 31, 9, 170, 221, 19, 78,
  106, 3, 10, 191, 243, 172, 78, 170, 227, 137, 91, 154, 99, 127, 47, 61, 38, 85, 28, 115, 231, 33, 234, 134, 30, 213, 245, 121, 194, 233,
  204, 106, 201, 4, 172, 154, 111, 239, 29, 120, 85, 217, 101, 122, 30, 40, 12, 151, 169, 145, 92, 1, 240, 204, 120, 177, 181, 250, 106, 6,
  87, 36, 230, 61, 249, 219, 235, 240, 32, 162, 237, 104, 13, 162, 157, 229, 78, 116, 196, 41, 228, 28, 152, 60, 202, 39, 199, 0, 251, 193,
  145, 11, 19, 173, 15, 251, 251, 68, 215, 4, 163, 38, 205, 209, 193, 62, 83, 113, 7, 35, 201, 20, 56,
])

export const origin = '0a15fa91-e1ca-47f7-9e70-c1744156e6fc'

export const target = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'

export const packetBase: PacketBase = { origin, target }

export const unencryptedPacket: UnencryptedPacket = {
  origin,
  target,
  data: unencryptedData,
}

export const decryptedPacket = unencryptedPacket

export const unserializedEncryptedPacket: UnserializedEncryptedPacket = {
  origin,
  target,
  data: encryptedData,
}

export const serializedEncryptedPacket: SerializedEncryptedPacket = {
  origin: '0a15fa91-e1ca-47f7-9e70-c1744156e6fc',
  target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
  data: 'oOmL+BK+8GjokRnMdgcLuWvS1c/gCEMaB3EVXC3SRoMuGYVjMHRUEN9SLj3N5fswxvCUJ3OZNFqSDf/h1c8BsjP2p+9leJphshJb0Fkf4F1DgNmwFg1wsAEitjOcpAklPLt4pQQ4U5v/hWWLZM7KIb83T9iodcsQKK3CB1O/1SjoJfHQ+X2ZGxBQRwywVSqS34kDlZLdscQvKVwO/OppEqxW7x/lIrKd66ByqHzVCNInQyXhERKmriWoPPtjdMK0lfebQeOwNpGmOyECDg0uJ6iO6jYxdIRctzSqLLqDANNNFvw43HZuYcjXZ2k1jfK7sp0Gh8fUsGqFTwwNYJ0+Q+nnBhNVqoAnH4Y4TRoUfd7rNmX7iWKHvGac98fWnU8IWfmFoqCpkTNw2zWaSGsofS97se/THz8Yb9J9fGjo23+MeLxRFWl8UG9oCNJhj4zV+J9bPtwewQSsG+q1xNCV90losxn4sOgPi/gwAeYsSXvR/wzXMnlHpyKwmDUD8X0jPQ==',
}

/**
 * Mock packet encryption function.
 *
 * @param packet - The unencrypted packet to process
 * @returns Promise resolving to an unserialized encrypted packet
 *
 * @example
 * ```typescript
 * const encrypted = await packetEncryption(unencryptedPacket)
 * // => { origin, target, data: Uint8Array }
 * ```
 */
export const packetEncryption: PacketEncryption = async (packet) => ({
  origin: packet.origin,
  target: packet.target,
  data: await encryptPacket(packet, passw0rd),
})

/** Mock packet serialization function using createSerializedEncryptedPacket */
export const packetSerialization: PacketSerialization = createSerializedEncryptedPacket

/**
 * Mock packet obfuscation function.
 *
 * @param packet - The serialized encrypted packet to obfuscate
 * @returns Promise resolving to obfuscated packet data
 *
 * @example
 * ```typescript
 * const obfuscated = await packetObfuscation(serializedPacket)
 * // => Uint8Array (obfuscated bytes)
 * ```
 */
export const packetObfuscation: PacketObfuscation = async (packet) => {
  const serialized = createTextEncoder().encode(packet.data)
  return obfuscatePacket(serialized, password)
}

/**
 * Mock packet decryption function.
 *
 * @param packet - The unserialized encrypted packet to decrypt
 * @returns Promise resolving to an unencrypted packet
 *
 * @example
 * ```typescript
 * const decrypted = await packetDecryption(encryptedPacket)
 * // => { origin, target, data: { message: 'hello' } }
 * ```
 */
export const packetDecryption: PacketDecryption = async (packet) => ({
  origin: packet.origin,
  target: packet.target,
  data: await decryptPacket(packet.data, passw0rd),
})

/** Mock packet deserialization function using createDeserializedEncryptedPacket */
export const packetDeserialization: PacketDeserialization = createDeserializedEncryptedPacket

/**
 * Mock packet deobfuscation function.
 *
 * @param packet - The obfuscated packet data to deobfuscate
 * @returns Promise resolving to a serialized encrypted packet
 *
 * @example
 * ```typescript
 * const deobfuscated = await packetDeobfuscation(obfuscatedPacket)
 * // => { origin, target, data: 'base64...' }
 * ```
 */
export const packetDeobfuscation: PacketDeobfuscation = async (packet) => {
  const decryptedData = await deobfuscatePacket(packet, password)
  return createSerializedEncryptedPacket({
    origin,
    target,
    data: decryptedData,
  })
}
