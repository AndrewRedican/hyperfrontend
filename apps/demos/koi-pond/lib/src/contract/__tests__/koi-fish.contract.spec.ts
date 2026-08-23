import type { KoiIdentity, KoiOutline } from '../../model/types.js'
import type { KoiActionDescription } from '../koi-fish.contract.js'
import { describe, expect, it } from 'vitest'
import { KOI_CONTRACT_VERSION, koiFishContract } from '../koi-fish.contract.js'

/**
 * The payload schema one action declares.
 *
 * @param actions - One direction of the contract.
 * @param type - The action to read.
 * @returns That action's schema as a plain record.
 */
function schemaFor(actions: readonly KoiActionDescription[], type: string): Record<string, unknown> {
  return <Record<string, unknown>>actions.find((action) => action.type === type)?.schema
}

describe('KOI_CONTRACT_VERSION', () => {
  it('is the cut both sides of the wire are built against', () => {
    expect(KOI_CONTRACT_VERSION).toBe('0.8.0')
  })

  it('is the version the contract itself declares', () => {
    expect(koiFishContract.version).toBe(KOI_CONTRACT_VERSION)
  })
})

describe('identity', () => {
  it('carries an instance ordinal alongside the seed', () => {
    expect(schemaFor(koiFishContract.accepted, 'identity')['properties']).toEqual(expect.objectContaining({ instance: { type: 'number' } }))
  })

  it('requires the ordinal of every koi it opens', () => {
    expect(schemaFor(koiFishContract.accepted, 'identity')['required']).toContain('instance')
  })
})

describe('pause', () => {
  it('offers a resting hold', () => {
    expect(schemaFor(koiFishContract.accepted, 'pause')['properties']).toEqual(expect.objectContaining({ resting: { type: 'boolean' } }))
  })

  it('asks only whether the koi is held, leaving the rest to say how', () => {
    expect(schemaFor(koiFishContract.accepted, 'pause')['required']).toEqual(['paused'])
  })
})

describe('outline', () => {
  it('stays schema-less, so a predicted path costs no validation on the hot path', () => {
    expect(koiFishContract.emitted.find((action) => action.type === 'outline')?.schema).toBeUndefined()
  })
})

describe('payload types', () => {
  it('opens a koi with the ordinal of the copy it is', () => {
    const identity: KoiIdentity = { framework: 'vanilla', seed: 3, instance: 1, url: 'https://koi.test/fish-vanilla/', depth: 4 }
    expect(identity).toEqual(expect.objectContaining({ instance: 1 }))
  })

  it('refuses an identity that never says which copy it is', () => {
    // @ts-expect-error every opened koi is told its instance ordinal
    const identity: KoiIdentity = { framework: 'vanilla', seed: 3, url: 'https://koi.test/fish-vanilla/', depth: 4 }
    expect(identity).toEqual(expect.not.objectContaining({ instance: expect.anything() }))
  })

  it('reports an outline whether or not a path came with it', () => {
    const outline: KoiOutline = {
      framework: 'vanilla',
      spine: [{ x: 10, y: 10 }],
      girth: [4],
      heading: 0,
      speed: 20,
      depth: 3,
      phase: 'relaxed',
    }
    expect(outline).toEqual(expect.not.objectContaining({ path: expect.anything() }))
  })
})
