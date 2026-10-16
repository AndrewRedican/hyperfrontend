import { describe, expect, it } from '@hyperfrontend/testing'
import { simpleHash } from './simple-hash'

describe('simpleHash function', () => {
  it('produces the same hash for the same input', () => {
    const input1 = 'Hello, world!'
    const hash1 = simpleHash(input1)
    const input2 = 'Hello, world!'
    const hash2 = simpleHash(input2)

    expect(hash1).toBe(hash2)
  })

  it('produces a 6 character hash', () => {
    const input = 'Hello, world!'
    const hash = simpleHash(input)

    expect(hash.length).toBe(6)
  })

  it('produces different hashes for different inputs', () => {
    const input1 = 'Hello, world!'
    const hash1 = simpleHash(input1)
    const input2 = 'Hello, OpenAI!'
    const hash2 = simpleHash(input2)

    expect(hash1).not.toBe(hash2)
  })
})
