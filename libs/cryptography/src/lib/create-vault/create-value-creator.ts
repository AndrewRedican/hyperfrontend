/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Vault } from './model'

export function createValueCreator(
  getRandomValues: (byteLength: number) => Uint8Array,
  encrypt: (message: string, password: string) => Promise<Uint8Array>,
  decrypt: (encrypted: Uint8Array, password: string) => Promise<string>
): (singleUse?: boolean) => Vault {
  return function createVault(singleUse = false): Vault {
    let password = Array.from(getRandomValues(16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    let isPasswordAccessed = false
    let isVaultClosed = false

    let storage = new Map<string, Uint8Array>()

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

    function close(): void {
      storage.clear()
      ;(storage as any) = null
      ;(password as any) = null
      isVaultClosed = true
    }

    const vault = Object.create(null, {
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

    return vault
  }
}
