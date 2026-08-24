import { describe, expect, it } from 'vitest'
import { instanceFramework, instanceOrdinal, koiInstanceId, nextOrdinal } from '../instance-id'

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

describe('the next free ordinal', () => {
  it('starts a framework at its canonical fish', () => {
    expect(nextOrdinal(['react:0', 'vue:0'], 'lit')).toBe(0)
  })

  it('counts past the ordinals a framework holds', () => {
    expect(nextOrdinal(['react:0', 'react:1'], 'react')).toBe(2)
  })

  it('re-deals a freed gap before growing the tail', () => {
    expect(nextOrdinal(['react:0', 'react:2'], 'react')).toBe(1)
  })

  it('ignores the ordinals other frameworks hold', () => {
    expect(nextOrdinal(['vue:0', 'vue:1'], 'react')).toBe(0)
  })
})
