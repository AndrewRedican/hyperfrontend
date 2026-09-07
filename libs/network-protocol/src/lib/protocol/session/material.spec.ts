import { describe, expect, it } from '@hyperfrontend/testing'
import { mintLocalMaterial } from './material'
import { nodeCrypto } from './test-fixtures'

describe('mintLocalMaterial', () => {
  it('mints a 32-byte nonce and an agreement with a 65-byte public key', async () => {
    const material = await mintLocalMaterial(nodeCrypto)
    expect({ nonce: material.nonce.length, publicKey: material.agreement.publicKey.length }).toEqual({ nonce: 32, publicKey: 65 })
  })

  it('mints fresh material on every call', async () => {
    const [first, second] = [await mintLocalMaterial(nodeCrypto), await mintLocalMaterial(nodeCrypto)]
    expect(first.nonce).not.toEqual(second.nonce)
  })
})
