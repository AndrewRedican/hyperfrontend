import { describe, expect, it } from '@hyperfrontend/testing'
import { getRandomValues } from '../get-random-values/node'
import { stretchPassword } from './node'

describe('stretchPassword (node)', () => {
  const salt = getRandomValues(64)

  it('derives 32 bytes by default', async () => {
    await expect(stretchPassword('a-password-of-length', salt)).resolves.toHaveLength(32)
  })

  it('derives the same material for the same password and salt', async () => {
    const [first, second] = await Promise.all([
      stretchPassword('same', salt, { iterations: 10 }),
      stretchPassword('same', salt, { iterations: 10 }),
    ])
    expect(first).toEqual(second)
  })

  it('derives different material for a different salt', async () => {
    const [first, second] = await Promise.all([
      stretchPassword('same', salt, { iterations: 10 }),
      stretchPassword('same', getRandomValues(64), { iterations: 10 }),
    ])
    expect(first).not.toEqual(second)
  })

  it('honours the requested length', async () => {
    await expect(stretchPassword('pw', salt, { iterations: 10, length: 512 })).resolves.toHaveLength(64)
  })

  it('rejects an empty password', async () => {
    await expect(stretchPassword('', salt)).rejects.toThrow('Cannot stretch an empty password')
  })

  it('rejects a missing salt', async () => {
    await expect(stretchPassword('pw', new Uint8Array())).rejects.toThrow('Cannot stretch a password without a salt')
  })

  it('rejects a non-positive iteration count', async () => {
    await expect(stretchPassword('pw', salt, { iterations: 0 })).rejects.toThrow(
      'Password stretching iterations must be a positive integer'
    )
  })

  it('rejects a length that is not a multiple of 8 bits', async () => {
    await expect(stretchPassword('pw', salt, { iterations: 10, length: 12 })).rejects.toThrow(
      'Password stretching length must be a positive multiple of 8 bits'
    )
  })
})
