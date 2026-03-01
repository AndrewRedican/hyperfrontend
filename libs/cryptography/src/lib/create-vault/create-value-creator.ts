/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Vault } from './model'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { create, freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a vault factory function that produces encrypted storage instances.
 * Vaults provide secure, password-protected storage for sensitive data with optional single-use mode.
 *
 * @param getRandomValues - Function to generate cryptographically secure random values for passwords
 * @param encrypt - Function to encrypt data with a password
 * @param decrypt - Function to decrypt data with a password
 * @returns A function that creates new vault instances
 */
export function createValueCreator(
  getRandomValues: (byteLength: number) => Uint8Array,
  encrypt: (message: string, password: string) => Promise<Uint8Array>,
  decrypt: (encrypted: Uint8Array, password: string) => Promise<string>
): (singleUse?: boolean) => Readonly<Vault> {
  return function createVault(singleUse = false): Readonly<Vault> {
    let password = from(getRandomValues(16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    let isPasswordAccessed = false
    let isVaultClosed = false

    let storage = new Map<string, Uint8Array>()

    /**
     * Writes an encrypted value to the vault with the specified label.
     *
     * @param label - The label/key to store the value under
     * @param value - The plaintext value to encrypt and store
     * @returns A promise that resolves when the value is stored
     * @throws {Error} When vault is closed, label is empty, or value is empty
     */
    async function write(label: string, value: string): Promise<void> {
      if (isVaultClosed) {
        throw new Error('Vault is closed.')
      }
      if (!label) {
        throw new Error('Label is required.')
      }
      if (!value) {
        throw new Error('Value is required.')
      }
      const encryptedValue = await encrypt(value, password)
      storage.set(label, encryptedValue)
    }

    /**
     * Reads and decrypts a value from the vault using the provided label and password.
     * In single-use mode, reading a value will close the vault.
     *
     * @param label - The label/key of the value to retrieve
     * @param password - The password to decrypt the value
     * @returns A promise that resolves to the decrypted value, or null if label not found
     * @throws {Error} When vault is closed, label is empty, or password is empty
     */
    async function read(label: string, password: string): Promise<string | null> {
      if (isVaultClosed) {
        throw new Error('Vault is closed.')
      }
      if (!label) {
        throw new Error('Label is required.')
      }
      if (!password) {
        throw new Error('Password is required.')
      }
      const encryptedValue = storage.get(label)
      if (!encryptedValue) {
        return null
      }
      const result = await decrypt(encryptedValue, password)
      if (singleUse) {
        close()
      }
      return result
    }

    /**
     * Retrieves the vault's password. Can only be called once per vault instance.
     * Subsequent calls will return null for security.
     *
     * @returns The vault password on first call, null on subsequent calls
     * @throws {Error} When vault is closed
     */
    function getPassword(): string | null {
      if (isVaultClosed) {
        throw new Error('Vault is closed.')
      }
      if (isPasswordAccessed) {
        return null
      }
      isPasswordAccessed = true
      return password
    }

    /**
     * Closes the vault and securely clears all stored data and the password from memory.
     * Once closed, the vault cannot be reopened or accessed.
     */
    function close(): void {
      storage.clear()
      ;(<any>storage) = null
      ;(<any>password) = null
      isVaultClosed = true
    }

    const vault = create(null, {
      write: {
        value: write,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      read: {
        value: read,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      getPassword: {
        value: getPassword,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      close: {
        value: close,
        enumerable: false,
        writable: false,
        configurable: false,
      },
    })

    // Freeze to prevent addition of new properties
    return freeze(vault)
  }
}
