/**
 * Secure vault for storing encrypted key-value pairs.
 */
export interface Vault {
  /** Writes an encrypted value with the given label */
  readonly write: (label: string, value: string) => Promise<void>
  /** Reads and decrypts a value by label, requiring the password */
  readonly read: (label: string, password: string) => Promise<string | null>
  /** Retrieves the current vault password, or null if not set */
  readonly getPassword: () => string | null
  /** Closes the vault and clears sensitive data from memory */
  readonly close: () => void
}
