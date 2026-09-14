import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getDepth } from './get-depth'
import { setConfig } from './shared/consts'

describe('getDepth', () => {
  let target: unknown

  it('return the max depth of the data structure of a value', () => {
    target = {
      a: { b: { c: 42 } },
      b: 80,
      z: [100, 200, 500, [[]]],
    }
    const [maxDepth, locations] = getDepth(target)
    expect(maxDepth).toEqual(3)
    expect(locations).toEqual([
      ['a', 'b', 'c'],
      ['z', '3', '0'],
    ])
  })
})

describe('getDepth - with config detectCircularReferences:true', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let target: any

  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('return the max depth of the data structure of a value', () => {
    target = {
      a: { b: { c: 42 } },
      b: 80,
      z: [100, 200, 500, [[]]],
    }
    target.b = target
    target.z[3][0][0] = target.z[3]
    const [maxDepth, locations] = getDepth(target)
    expect(maxDepth).toEqual(3)
    expect(locations).toEqual([
      ['a', 'b', 'c'],
      ['z', '3', '0'],
    ])
  })
})

describe('getDepth - with references shared between branches', () => {
  const shared = { v: 1 }

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('measures a shared reference on every branch that holds it', () => {
    setConfig({ detectCircularReferences: true })
    expect(getDepth({ a: shared, b: shared })).toEqual([
      2,
      [
        ['a', 'v'],
        ['b', 'v'],
      ],
    ])
  })

  it('measures the same depth as a measurement with detection off', () => {
    const withDetectionOff = getDepth({ a: shared, b: shared })
    setConfig({ detectCircularReferences: true })
    expect(getDepth({ a: shared, b: shared })).toEqual(withDetectionOff)
  })

  it('measures a frozen value', () => {
    setConfig({ detectCircularReferences: true })
    expect(getDepth(Object.freeze({ a: Object.freeze({ b: 1 }) }))).toEqual([2, [['a', 'b']]])
  })
})
