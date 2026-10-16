/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
import type { Mock } from '@hyperfrontend/testing'
import type { DepthConfig } from './models'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { setConfig } from './shared/consts'
import { createTraversal, traverse } from './traverse'

const mockedTarget = {
  A: {
    alpha: [0, 1, 2],
    beta: {
      a: '1',
      b: '2',
    },
    gamma: { valid: true },
    delta: { valid: false },
  },
  B: {
    epsilon: 42,
    zeta: 'Lorem ipsum dolor sit amet.',
  },
  C: {},
}

describe('createTraversal', () => {
  it('creates a traverse function', () => {
    const traverseFn = createTraversal(() => true)
    expect(typeof traverseFn).toBe('function')
  })
})

describe('traverse', () => {
  it('throw error when incorrect arguments passed: a callback that is not a function', () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => traverse({}, {})).toThrow('Expected callback to be a function.')
  })

  it('throw error when incorrect arguments passed: options that are not an object', () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => traverse({}, () => {}, [])).toThrow('Expected options to be an object.')
  })

  it('throw error when incorrect arguments passed: a depth that is not an array', () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => traverse({}, () => {}, { depth: {} })).toThrow('Expected options.depth to be an array.')
  })

  it('throw error when incorrect arguments passed: a start depth that is not a number', () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => traverse({}, () => {}, { depth: ['0'] })).toThrow('Expected options.depth.0 to be a number.')
  })

  it('throw error when incorrect arguments passed: a max depth that is neither a number nor a string', () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => traverse({}, () => {}, { depth: [3, {}] })).toThrow('Expected options.depth.1 to be a number or a string.')
  })

  it("throw error when incorrect arguments passed: a max depth string other than '*'", () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => traverse({}, () => {}, { depth: [3, 'x'] })).toThrow("Only valid string value in options.depth.1 is '*'.")
  })
})

describe('traverse - with config detectCircularReferences:false', () => {
  let target: unknown
  let callback: Mock<void, [key: string, value: unknown, path: string[], state: any, parent: unknown]>

  const setupCallbackSpy = () => (callback = jest.fn((key, value, path, state, parent) => {}))

  beforeEach(() => (setConfig({ detectCircularReferences: false }), (target = { ...mockedTarget }), setupCallbackSpy()))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('will invoke callback function for each data point', () => {
    traverse(target, callback)
    expect(callback.mock.calls).toEqual([
      ['', mockedTarget, [], {}, void 0],
      ['A', mockedTarget.A, ['A'], {}, mockedTarget],
      ['alpha', mockedTarget.A.alpha, ['A', 'alpha'], {}, mockedTarget.A],
      ['0', mockedTarget.A.alpha[0], ['A', 'alpha', '0'], {}, mockedTarget.A.alpha],
      ['1', mockedTarget.A.alpha[1], ['A', 'alpha', '1'], {}, mockedTarget.A.alpha],
      ['2', mockedTarget.A.alpha[2], ['A', 'alpha', '2'], {}, mockedTarget.A.alpha],
      ['beta', mockedTarget.A.beta, ['A', 'beta'], {}, mockedTarget.A],
      ['a', mockedTarget.A.beta.a, ['A', 'beta', 'a'], {}, mockedTarget.A.beta],
      ['b', mockedTarget.A.beta.b, ['A', 'beta', 'b'], {}, mockedTarget.A.beta],
      ['gamma', mockedTarget.A.gamma, ['A', 'gamma'], {}, mockedTarget.A],
      ['valid', mockedTarget.A.gamma.valid, ['A', 'gamma', 'valid'], {}, mockedTarget.A.gamma],
      ['delta', mockedTarget.A.delta, ['A', 'delta'], {}, mockedTarget.A],
      ['valid', mockedTarget.A.delta.valid, ['A', 'delta', 'valid'], {}, mockedTarget.A.delta],
      ['B', mockedTarget.B, ['B'], {}, mockedTarget],
      ['epsilon', mockedTarget.B.epsilon, ['B', 'epsilon'], {}, mockedTarget.B],
      ['zeta', mockedTarget.B.zeta, ['B', 'zeta'], {}, mockedTarget.B],
      ['C', mockedTarget.C, ['C'], {}, mockedTarget],
    ])
  })

  it.each([
    [undefined, 17],
    [{ depth: [] }, 17],
    [{ depth: [0] }, 17],
    [{ depth: [0, '*'] }, 17],
    [{ depth: [0, 0] }, 1],
    [{ depth: [1, 1] }, 3],
    [{ depth: [2, 2] }, 6],
    [{ depth: [2, 3] }, 13],
    [{ depth: [4, 4] }, 0],
  ])('will visit data points within a specific depth range given the options %p', (options: DepthConfig | undefined, expected: number) => {
    traverse(target, callback, options)
    expect(callback).toHaveBeenCalledTimes(expected)
  })

  it('accepts an initial state value that persists on every iteration and returns said state', () => {
    callback = jest.fn((key, value, path, state, parent) => (state.count += 1))
    expect(traverse(target, callback, { depth: [] }, { count: 0 })).toEqual({
      count: 17,
    })
  })
})

describe('traverse - with config detectCircularReferences:true', () => {
  let target: unknown
  let callback: Mock<void, [key: string, value: unknown, path: string[], state: any, parent: unknown]>

  const setupCallbackSpy = () => (callback = jest.fn((key, value, path, state, parent) => {}))

  beforeEach(() => (setConfig({ detectCircularReferences: true }), (target = { ...mockedTarget }), setupCallbackSpy()))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('will invoke callback function for each data point', () => {
    traverse(target, callback)
    expect(callback.mock.calls).toEqual([
      ['', mockedTarget, [], {}, void 0],
      ['A', mockedTarget.A, ['A'], {}, mockedTarget],
      ['alpha', mockedTarget.A.alpha, ['A', 'alpha'], {}, mockedTarget.A],
      ['0', mockedTarget.A.alpha[0], ['A', 'alpha', '0'], {}, mockedTarget.A.alpha],
      ['1', mockedTarget.A.alpha[1], ['A', 'alpha', '1'], {}, mockedTarget.A.alpha],
      ['2', mockedTarget.A.alpha[2], ['A', 'alpha', '2'], {}, mockedTarget.A.alpha],
      ['beta', mockedTarget.A.beta, ['A', 'beta'], {}, mockedTarget.A],
      ['a', mockedTarget.A.beta.a, ['A', 'beta', 'a'], {}, mockedTarget.A.beta],
      ['b', mockedTarget.A.beta.b, ['A', 'beta', 'b'], {}, mockedTarget.A.beta],
      ['gamma', mockedTarget.A.gamma, ['A', 'gamma'], {}, mockedTarget.A],
      ['valid', mockedTarget.A.gamma.valid, ['A', 'gamma', 'valid'], {}, mockedTarget.A.gamma],
      ['delta', mockedTarget.A.delta, ['A', 'delta'], {}, mockedTarget.A],
      ['valid', mockedTarget.A.delta.valid, ['A', 'delta', 'valid'], {}, mockedTarget.A.delta],
      ['B', mockedTarget.B, ['B'], {}, mockedTarget],
      ['epsilon', mockedTarget.B.epsilon, ['B', 'epsilon'], {}, mockedTarget.B],
      ['zeta', mockedTarget.B.zeta, ['B', 'zeta'], {}, mockedTarget.B],
      ['C', mockedTarget.C, ['C'], {}, mockedTarget],
    ])
  })

  it.each([
    [undefined, 17],
    [{ depth: [] }, 17],
    [{ depth: [0] }, 17],
    [{ depth: [0, '*'] }, 17],
    [{ depth: [0, 0] }, 1],
    [{ depth: [1, 1] }, 3],
    [{ depth: [2, 2] }, 6],
    [{ depth: [2, 3] }, 13],
    [{ depth: [4, 4] }, 0],
  ])('will visit data points within a specific depth range given the options %p', (options: DepthConfig | undefined, expected: number) => {
    traverse(target, callback, options)
    expect(callback).toHaveBeenCalledTimes(expected)
  })

  it('correctly skips over circular references', () => {
    const target = { a: { b: { c: {} } } }
    target.a.b.c = target.a.b
    traverse(target, callback)
    expect(callback).toHaveBeenCalledTimes(3)
  })
})

describe('traverse - with references shared between branches', () => {
  let callback: Mock<void, [key: string, value: unknown, path: string[], state: any, parent: unknown]>

  const shared = { v: 1 }

  beforeEach(() => (callback = jest.fn((key, value, path, state, parent) => {})))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('visits a shared reference once for every branch that holds it', () => {
    setConfig({ detectCircularReferences: true })
    traverse({ a: shared, b: shared }, callback)
    expect(callback).toHaveBeenCalledTimes(5)
  })

  it('visits the same data points as a traversal with detection off', () => {
    traverse({ a: shared, b: shared }, callback)
    const withDetectionOff = callback.mock.calls.length
    setConfig({ detectCircularReferences: true })
    callback = jest.fn((key, value, path, state, parent) => {})
    traverse({ a: shared, b: shared }, callback)
    expect(callback).toHaveBeenCalledTimes(withDetectionOff)
  })

  it('reaches the second branch of a shared reference', () => {
    setConfig({ detectCircularReferences: true })
    traverse({ a: shared, b: shared }, callback)
    expect(callback).toHaveBeenCalledWith('v', 1, ['b', 'v'], {}, shared)
  })

  it('traverses a frozen value', () => {
    setConfig({ detectCircularReferences: true })
    traverse(Object.freeze({ a: Object.freeze({ b: 1 }) }), callback)
    expect(callback).toHaveBeenCalledTimes(3)
  })
})
