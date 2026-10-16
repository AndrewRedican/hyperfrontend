import type { Vault } from './model'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createVault } from './browser'

jest.mock('../encrypt/browser', () => ({
  encrypt: jest.fn((value) => Promise.resolve(`encrypted-${value}`)),
}))

jest.mock('../decrypt/browser', () => ({
  decrypt: jest.fn((value) => Promise.resolve(value.replace('encrypted-', ''))),
}))

describe('createVault (browser)', () => {
  const label = 'test-label'
  const value = 'test-value'
  let vault: Vault
  let password: string

  beforeEach(() => {
    vault = createVault()
    password = vault.getPassword()
  })

  it('writes and reads a value successfully', async () => {
    await vault.write(label, value)
    const readValue = await vault.read(label, password)
    expect(readValue).toBe(value)
  })

  it('write throws an error when trying to write with an empty label', async () => {
    await expect(vault.write('', 'value')).rejects.toThrow('Label is required.')
  })

  it('write throws an error when trying to write with an empty value', async () => {
    await expect(vault.write('label', '')).rejects.toThrow('Value is required.')
  })

  it('read throws an error when label is not provided', async () => {
    await vault.write(label, value)
    await expect(vault.read('', password)).rejects.toThrow('Label is required.')
  })

  it('read throws an error when password is not provided', async () => {
    await vault.write(label, value)
    await expect(vault.read(label, '')).rejects.toThrow('Password is required.')
  })
  it('returns null when reading a non-existent label', async () => {
    const result = await vault.read('nonExistentLabel', password)
    expect(result).toBeNull()
  })

  it('rejects a write after the vault is closed', async () => {
    vault.close()
    await expect(vault.write('label', 'value')).rejects.toThrow('Vault is closed.')
  })

  it('rejects a read after the vault is closed', async () => {
    vault.close()
    await expect(vault.read('label', password)).rejects.toThrow('Vault is closed.')
  })

  it('throws on a password request after the vault is closed', () => {
    vault.close()
    expect(() => vault.getPassword()).toThrow('Vault is closed.')
  })

  it('returns the password on the first request', () => {
    expect(password).toBeTruthy()
  })

  it('returns null on a second password request', () => {
    expect(vault.getPassword()).toBeNull()
  })

  describe('single use vault', () => {
    let singleUseVault: Vault

    beforeEach(() => {
      singleUseVault = createVault(true)
    })

    it('returns the stored value on the first read', async () => {
      await singleUseVault.write(label, value)
      const firstRead = await singleUseVault.read(label, password)
      expect(firstRead).toBe(value)
    })

    it('closes the vault after the first read', async () => {
      await singleUseVault.write(label, value)
      await singleUseVault.read(label, password)
      await expect(singleUseVault.read(label, password)).rejects.toThrow('Vault is closed.')
    })
  })
})
