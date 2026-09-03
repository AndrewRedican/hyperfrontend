import type { Vault } from './model'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createVault } from './node'

jest.mock('../encrypt/node', () => ({
  encrypt: jest.fn((value) => Promise.resolve(`encrypted-${value}`)),
}))

jest.mock('../decrypt/node', () => ({
  decrypt: jest.fn((value) => Promise.resolve(value.replace('encrypted-', ''))),
}))

describe('createVault (node)', () => {
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

  it('throws an error if trying to access the vault after it is closed', async () => {
    vault.close()
    await expect(vault.write('label', 'value')).rejects.toThrow('Vault is closed.')
    await expect(vault.read('label', password)).rejects.toThrow('Vault is closed.')
    expect(() => vault.getPassword()).toThrow('Vault is closed.')
  })

  it('retrieves the password only once', () => {
    expect(password).toBeTruthy()
    expect(vault.getPassword()).toBeNull()
  })

  describe('single use vault', () => {
    let singleUseVault: Vault

    beforeEach(() => {
      singleUseVault = createVault(true)
    })

    it('allows reading a value only once', async () => {
      await singleUseVault.write(label, value)
      const firstRead = await singleUseVault.read(label, password)
      expect(firstRead).toBe(value)
      await expect(singleUseVault.read(label, password)).rejects.toThrow('Vault is closed.')
    })
  })
})
