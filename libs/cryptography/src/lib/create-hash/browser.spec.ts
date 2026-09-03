/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from '@hyperfrontend/testing'
import { createHash } from './browser'

describe('createHash (browser)', () => {
  const testData = 'Hello, world!'
  const expectedNodeHash = '315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3'

  it('generates correct hash', async () => {
    const hash = await createHash(testData, 'SHA-256')
    expect(hash).toBe(expectedNodeHash)
  })

  it('throws error for unsupported algorithm', async () => {
    await expect(createHash(testData, 'unsupported-algorithm' as any)).rejects.toThrow('Error creating hash')
  })
})
