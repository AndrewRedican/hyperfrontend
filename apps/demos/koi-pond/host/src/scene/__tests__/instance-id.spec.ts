import { describe, expect, it } from 'vitest'
import { instanceFramework, instanceOrdinal, koiInstanceId } from '../instance-id'

describe('the instance id', () => {
  it('joins a framework and an ordinal into one map-ready key', () => {
    expect(koiInstanceId('react', 2)).toBe('react:2')
  })

  it('reads the framework back out', () => {
    expect(instanceFramework(koiInstanceId('angular', 11))).toBe('angular')
  })

  it('reads the ordinal back out, double digits included', () => {
    expect(instanceOrdinal(koiInstanceId('angular', 11))).toBe(11)
  })
})
