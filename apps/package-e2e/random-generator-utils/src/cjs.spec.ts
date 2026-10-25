/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/random-generator-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/random-generator-utils CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/random-generator-utils')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        uuidV4: 'function',
        isUuidV4: 'function',
        randomUniform: 'function',
        randomGaussian: 'function',
        randomPseudo: 'function',
        randomExponential: 'function',
        randomPowerLaw: 'function',
        createRandomGenerator: 'function',
      })
    )
  })

  it('generates a UUIDv4 that isUuidV4 accepts', () => {
    const accepted = consumer.run(
      async () => {
        const { isUuidV4, uuidV4 } = require('@hyperfrontend/random-generator-utils')
        return isUuidV4(uuidV4())
      },
      { kind: 'require' }
    )
    expect(accepted).toBe(true)
  })

  it('rejects a malformed string through isUuidV4', () => {
    const accepted = consumer.run(
      async () => {
        const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')
        return isUuidV4('not-a-uuid')
      },
      { kind: 'require' }
    )
    expect(accepted).toBe(false)
  })

  it('accepts a well-formed UUIDv4 through isUuidV4', () => {
    const accepted = consumer.run(
      async () => {
        const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')
        return isUuidV4('550e8400-e29b-41d4-a716-446655440000')
      },
      { kind: 'require' }
    )
    expect(accepted).toBe(true)
  })

  it('draws uniform values inside the half-open range', () => {
    const withinBounds = consumer.run(
      async () => {
        const { randomUniform } = require('@hyperfrontend/random-generator-utils')
        const draws = Array.from({ length: 50 }, () => randomUniform(0, 10))
        return draws.every((value) => value >= 0 && value < 10)
      },
      { kind: 'require' }
    )
    expect(withinBounds).toBe(true)
  })

  it('replays one seed exactly through createRandomGenerator', () => {
    const draws = consumer.run(
      async () => {
        const { createRandomGenerator } = require('@hyperfrontend/random-generator-utils')
        const first = createRandomGenerator(42)
        const second = createRandomGenerator(42)
        const firstDraws = [first.next(), first.gaussian(0, 10), first.uuidV4()]
        const secondDraws = [second.next(), second.gaussian(0, 10), second.uuidV4()]
        return JSON.stringify(firstDraws) === JSON.stringify(secondDraws)
      },
      { kind: 'require' }
    )
    expect(draws).toBe(true)
  })
})
