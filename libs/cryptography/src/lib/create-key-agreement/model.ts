/**
 * One side of an ephemeral elliptic-curve Diffie-Hellman agreement (P-256).
 *
 * The private key never leaves the object: it is a non-extractable `CryptoKey` held in a
 * closure and is garbage-collected with the agreement. Create one agreement per session.
 */
export interface KeyAgreement {
  /** This side's public key as the 65-byte uncompressed P-256 point, to be sent to the peer */
  readonly publicKey: Uint8Array
  /**
   * Derives the 32-byte shared secret from the peer's public key.
   *
   * @param peerPublicKey - The peer's 65-byte uncompressed P-256 point
   * @returns The shared secret both sides compute
   * @throws {Error} When the peer key is not a valid P-256 point
   */
  deriveSecret(peerPublicKey: Uint8Array): Promise<Uint8Array>
}
