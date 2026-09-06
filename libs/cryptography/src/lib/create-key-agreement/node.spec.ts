import { describe, expect, it } from '@hyperfrontend/testing'
import { createKeyAgreement } from './node'

describe('createKeyAgreement (node)', () => {
  it('exposes a 65-byte uncompressed public point', async () => {
    const agreement = await createKeyAgreement()
    expect(agreement.publicKey).toEqual(expect.objectContaining({ length: 65, 0: 4 }))
  })

  it('exposes nothing but the public key and deriveSecret', async () => {
    expect(Object.keys(await createKeyAgreement())).toEqual(['publicKey', 'deriveSecret'])
  })

  it('lets both sides derive the same secret', async () => {
    const [a, b] = await Promise.all([createKeyAgreement(), createKeyAgreement()])
    const [fromA, fromB] = await Promise.all([a.deriveSecret(b.publicKey), b.deriveSecret(a.publicKey)])
    expect(fromA).toEqual(fromB)
  })

  it('derives a 32-byte secret', async () => {
    const [a, b] = await Promise.all([createKeyAgreement(), createKeyAgreement()])
    await expect(a.deriveSecret(b.publicKey)).resolves.toHaveLength(32)
  })

  it('derives a different secret against a different peer', async () => {
    const [a, b, c] = await Promise.all([createKeyAgreement(), createKeyAgreement(), createKeyAgreement()])
    const [withB, withC] = await Promise.all([a.deriveSecret(b.publicKey), a.deriveSecret(c.publicKey)])
    expect(withB).not.toEqual(withC)
  })

  it('generates a fresh key pair per agreement', async () => {
    const [a, b] = await Promise.all([createKeyAgreement(), createKeyAgreement()])
    expect(a.publicKey).not.toEqual(b.publicKey)
  })

  it('rejects a peer key of the wrong length', async () => {
    const a = await createKeyAgreement()
    await expect(a.deriveSecret(new Uint8Array(32))).rejects.toThrow('Cannot derive a shared secret from an invalid peer public key')
  })

  it('rejects a peer key that is not a point on the curve', async () => {
    const a = await createKeyAgreement()
    const offCurve = new Uint8Array(65)
    offCurve[0] = 4
    await expect(a.deriveSecret(offCurve)).rejects.toThrow('Cannot derive a shared secret from an invalid peer public key')
  })
})
