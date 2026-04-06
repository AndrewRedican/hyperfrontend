/** Configuration for encryption algorithm settings. */
export interface EncryptionConfig {
  /** Encryption algorithm name (AES-GCM, AES-CBC, or AES-CTR). */
  name: 'AES-GCM' | 'AES-CBC' | 'AES-CTR'
}
