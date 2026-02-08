import { simpleHash } from './simple-hash'

describe('simpleHash function', () => {
  it('produces a consistent 6 character hash', () => {
    const input1 = 'Hello, world!'
    const hash1 = simpleHash(input1)
    const input2 = 'Hello, world!'
    const hash2 = simpleHash(input2)

    expect(hash1).toBe(hash2)
    expect(hash1.length).toBe(6)
  })

  it('produces different hashes for different inputs', () => {
    const input1 = 'Hello, world!'
    const hash1 = simpleHash(input1)
    const input2 = 'Hello, OpenAI!'
    const hash2 = simpleHash(input2)

    expect(hash1).not.toBe(hash2)
  })
})
