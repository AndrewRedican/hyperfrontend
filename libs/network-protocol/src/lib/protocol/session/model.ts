/** One side of an ephemeral key agreement, as the cryptography package provides it */
export interface KeyAgreementLike {
  /** This side's public key, the 65-byte uncompressed P-256 point */
  readonly publicKey: Uint8Array
  /**
   * Derives the shared secret from the peer's public key.
   *
   * @param peerPublicKey - The peer's 65-byte uncompressed point
   * @returns The 32-byte shared secret
   */
  deriveSecret(peerPublicKey: Uint8Array): Promise<Uint8Array>
}

/** Iteration count and output length for one password stretch */
export interface StretchOptions {
  /** PBKDF2 iteration count */
  readonly iterations?: number
  /** Output length in bits */
  readonly length?: number
}

/** The platform primitives a session protocol is composed from */
export interface SessionCrypto {
  /** Cryptographically secure random bytes */
  readonly getRandomValues: (byteLength: number) => Uint8Array
  /** Mints an ephemeral key agreement */
  readonly createKeyAgreement: () => Promise<KeyAgreementLike>
  /** PBKDF2 password stretching into raw bits */
  readonly stretchPassword: (password: string, salt: Uint8Array, options?: StretchOptions) => Promise<Uint8Array>
  /** HKDF expansion into a usage-restricted AES-GCM key */
  readonly expandKey: (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, usages: readonly KeyUsage[]) => Promise<CryptoKey>
  /** AES-GCM seal under a key, nonce, and additional data */
  readonly seal: (key: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array, plaintext: Uint8Array) => Promise<Uint8Array>
  /** AES-GCM open under a key, nonce, and additional data */
  readonly open: (key: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array, sealed: Uint8Array) => Promise<Uint8Array>
  /** UTF-8 text to bytes */
  readonly utf8Encode: (text: string) => Uint8Array
  /** UTF-8 bytes to text */
  readonly utf8Decode: (bytes: Uint8Array) => string
}

/** What distinguishes one session protocol from another */
export interface SessionProtocolDefinition {
  /** The negotiated identifier, `'v3'` or `'v4'` */
  readonly id: string
  /** The version byte every frame starts with */
  readonly version: number
  /** The shared secret mixed into the key schedule, when the protocol has one */
  readonly sharedKey?: string
}

/** The two directional keys of one session */
export interface SessionKeys {
  /** Seals frames this side sends; may only encrypt */
  readonly send: CryptoKey
  /** Opens frames this side receives; may only decrypt */
  readonly receive: CryptoKey
}

/** This side's minted material: the private agreement and the nonce it advertises */
export interface LocalMaterial {
  /** The ephemeral agreement whose public key the hello advertises */
  readonly agreement: KeyAgreementLike
  /** The nonce the hello advertises */
  readonly nonce: Uint8Array
}

/** The peer's material as read off its hello frame */
export interface PeerMaterial {
  /** The peer's 32-byte nonce */
  readonly nonce: Uint8Array
  /** The peer's 65-byte public key */
  readonly publicKey: Uint8Array
}
