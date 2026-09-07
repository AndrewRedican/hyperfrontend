import type { PeerMaterial } from './model'
import { MAX_SAFE_INTEGER } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createDataView, createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/** Frame type byte of a sealed packet */
export const FRAME_TYPE_DATA = 0

/** Frame type byte of a hello: this side's public material in the clear */
export const FRAME_TYPE_HELLO = 1

/** Bytes of header in front of every sealed frame: version, type, and an eight-byte counter */
export const HEADER_LENGTH = 10

/** Bytes of nonce AES-GCM takes: four zero bytes and the eight-byte counter */
export const NONCE_LENGTH = 12

/** Bytes of authentication tag AES-GCM appends */
export const TAG_LENGTH = 16

/** The shortest sealed frame that can carry a packet: header, tag, and at least one ciphertext byte */
export const MIN_FRAME_LENGTH = HEADER_LENGTH + TAG_LENGTH + 1

/** Bytes of nonce each side contributes to the session salt */
export const HELLO_NONCE_LENGTH = 32

/** Bytes of an uncompressed P-256 public key */
export const PUBLIC_KEY_LENGTH = 65

/** Length of a hello frame: version, type, nonce, and public key */
export const HELLO_LENGTH = 2 + HELLO_NONCE_LENGTH + PUBLIC_KEY_LENGTH

/** The largest counter a frame can carry exactly; a session that reaches it cannot seal again */
export const MAX_COUNTER = MAX_SAFE_INTEGER

// magic: 2^32, the boundary between the high and low halves of the 64-bit counter field.
const HALF = 4294967296

// magic: The tag byte an uncompressed elliptic-curve point starts with.
const UNCOMPRESSED_POINT_TAG = 4

/** A decoded sealed-frame header */
export interface FrameHeader {
  /** The protocol version byte */
  readonly version: number
  /** The sender's counter for this frame */
  readonly counter: number
}

/** A decoded hello frame */
export interface HelloFrame extends PeerMaterial {
  /** The protocol version byte */
  readonly version: number
}

/**
 * Encodes a sealed-frame header: the version byte, the data type byte, and the counter as
 * an unsigned 64-bit big-endian integer.
 *
 * @param version - The protocol's version byte
 * @param counter - The sender's counter for this frame, a positive safe integer
 * @returns The ten header bytes
 *
 * @example Building the header of the first sealed frame of a v4 session
 * ```typescript
 * encodeHeader(4, 1)
 * // => Uint8Array [4, 0, 0, 0, 0, 0, 0, 0, 0, 1]
 * ```
 */
export function encodeHeader(version: number, counter: number): Uint8Array {
  const header = createUint8Array(HEADER_LENGTH)
  header[0] = version
  header[1] = FRAME_TYPE_DATA
  const view = createDataView(header.buffer)
  view.setUint32(2, (counter / HALF) >>> 0)
  view.setUint32(6, counter >>> 0)
  return header
}

/**
 * Decodes a sealed-frame header.
 *
 * @param frame - The whole frame, at least a header long
 * @returns The version byte and the counter
 *
 * @example Reading the counter off an incoming frame
 * ```typescript
 * decodeHeader(frame).counter
 * // => 7
 * ```
 */
export function decodeHeader(frame: Uint8Array): FrameHeader {
  const view = createDataView(frame.buffer, frame.byteOffset, HEADER_LENGTH)
  return { version: frame[0], counter: view.getUint32(2) * HALF + view.getUint32(6) }
}

/**
 * Builds the AES-GCM nonce for a sealed frame: four zero bytes followed by the counter's
 * eight header bytes. Under a session's per-direction keys a counter is used once, so the
 * nonce is unique by construction.
 *
 * @param header - The ten header bytes of the frame
 * @returns The twelve nonce bytes
 *
 * @example Deriving the nonce a frame was sealed with
 * ```typescript
 * nonceFor(header)
 * // => Uint8Array [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7]
 * ```
 */
export function nonceFor(header: Uint8Array): Uint8Array {
  const nonce = createUint8Array(NONCE_LENGTH)
  nonce.set(header.subarray(2, HEADER_LENGTH), NONCE_LENGTH - (HEADER_LENGTH - 2))
  return nonce
}

/**
 * Concatenates the header and the sealed bytes into one frame that owns its buffer, so a
 * transport may transfer the buffer without detaching anything the sender still holds.
 *
 * @param header - The ten header bytes of the frame
 * @param sealed - The ciphertext followed by its tag
 * @returns The complete frame
 *
 * @example Assembling a frame
 * ```typescript
 * const frame = assembleFrame(header, await seal(key, nonceFor(header), header, plaintext))
 * ```
 */
export function assembleFrame(header: Uint8Array, sealed: Uint8Array): Uint8Array {
  const frame = createUint8Array(header.length + sealed.length)
  frame.set(header, 0)
  frame.set(sealed, header.length)
  return frame
}

/**
 * Tells whether bytes are a hello frame: long enough, and typed as one.
 *
 * @param frame - Bytes received from the peer
 * @returns True for a hello frame of any version
 *
 * @example Routing an incoming frame
 * ```typescript
 * isHelloFrame(frame) ? acceptHello(frame) : channel.receive(frame)
 * ```
 */
export function isHelloFrame(frame: Uint8Array): boolean {
  return frame.length === HELLO_LENGTH && frame[1] === FRAME_TYPE_HELLO
}

/**
 * Encodes a hello frame: the version byte, the hello type byte, the nonce, and the public key.
 *
 * @param version - The protocol's version byte
 * @param nonce - This side's 32-byte nonce
 * @param publicKey - This side's 65-byte public key
 * @returns The 99 hello bytes
 *
 * @example Building this side's hello
 * ```typescript
 * const hello = encodeHello(3, material.nonce, material.agreement.publicKey)
 * ```
 */
export function encodeHello(version: number, nonce: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const frame = createUint8Array(HELLO_LENGTH)
  frame[0] = version
  frame[1] = FRAME_TYPE_HELLO
  frame.set(nonce, 2)
  frame.set(publicKey, 2 + HELLO_NONCE_LENGTH)
  return frame
}

/**
 * Decodes a hello frame, checking its shape: the length, the type byte, and that the public
 * key is tagged as an uncompressed point. Whether the point lies on the curve is decided by
 * the key agreement when the keys are derived.
 *
 * @param frame - The bytes to decode
 * @returns The version and the peer's material, or null when the bytes are not a hello
 *
 * @example Reading the peer's material
 * ```typescript
 * const hello = decodeHello(frame)
 * if (hello) accept(hello)
 * ```
 */
export function decodeHello(frame: Uint8Array): HelloFrame | null {
  if (!isHelloFrame(frame) || frame[2 + HELLO_NONCE_LENGTH] !== UNCOMPRESSED_POINT_TAG) {
    return null
  }
  return freeze({
    version: frame[0],
    nonce: frame.slice(2, 2 + HELLO_NONCE_LENGTH),
    publicKey: frame.slice(2 + HELLO_NONCE_LENGTH, HELLO_LENGTH),
  })
}
