import { AssertionError } from 'node:assert'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMockFn } from '../mock/mock-fn'
import { expect } from './expect'

/**
 * One matcher invocation and the verdict it should reach.
 */
type MatcherCase = {
  /** How the case reads in the report. */
  title: string
  /** Applies the matcher to a subject. */
  run: () => void
  /** Whether the matcher should accept the subject. */
  passes: boolean
  /** The error a rejection raises when it is not an assertion error, as when a matcher refuses a subject it cannot judge. */
  error?: new (...args: never[]) => Error
}

/**
 * One promise-mode matcher invocation and the verdict it should reach.
 */
type PromiseCase = {
  /** How the test reads in the report. */
  title: string
  /** Applies the matcher to a promise, settling once the matcher has judged it. */
  run: () => Promise<void>
  /** Whether the matcher should accept the promise. */
  passes: boolean
}

/**
 * Declares one test per case, each pinning the verdict its case should reach.
 *
 * `node:assert` judges every verdict, never the `expect` under test: an accepted case must
 * not throw, and a rejected one must throw an assertion error, or the error the case names.
 *
 * @param cases - The cases, in report order.
 * @param titleOf - Renders a case as its test title.
 */
function declareCases(
  cases: readonly MatcherCase[],
  titleOf: (matcherCase: MatcherCase) => string = (matcherCase) => matcherCase.title
): void {
  for (const matcherCase of cases) {
    const { run, error = AssertionError } = matcherCase
    if (matcherCase.passes) {
      it(titleOf(matcherCase), () => {
        assert.doesNotThrow(run)
      })
    } else {
      it(titleOf(matcherCase), () => {
        assert.throws(run, error)
      })
    }
  }
}

/**
 * Declares one test per promise-mode case, each pinning the verdict its case should reach.
 *
 * `node:assert` judges every verdict: an accepted case must settle without rejecting, and a
 * rejected one must reject with an assertion error.
 *
 * @param cases - The cases, in report order.
 */
function declarePromiseCases(cases: readonly PromiseCase[]): void {
  for (const promiseCase of cases) {
    const { title, run } = promiseCase
    if (promiseCase.passes) {
      it(title, async () => {
        await assert.doesNotReject(run)
      })
    } else {
      it(title, async () => {
        await assert.rejects(run, AssertionError)
      })
    }
  }
}

const CASES: MatcherCase[] = [
  { title: 'toBe on the same reference', run: () => expect(1).toBe(1), passes: true },
  { title: 'toBe on different values', run: () => expect(1).toBe(2), passes: false },
  { title: 'toEqual on structurally equal objects', run: () => expect({ a: 1 }).toEqual({ a: 1 }), passes: true },
  { title: 'toEqual on differing objects', run: () => expect({ a: 1 }).toEqual({ a: 2 }), passes: false },
  { title: 'toStrictEqual on identical shapes', run: () => expect({ a: 1 }).toStrictEqual({ a: 1 }), passes: true },
  { title: 'toStrictEqual on an undefined-valued key', run: () => expect({ a: 1, b: undefined }).toStrictEqual({ a: 1 }), passes: false },
  { title: 'toBeDefined on a value', run: () => expect(0).toBeDefined(), passes: true },
  { title: 'toBeDefined on undefined', run: () => expect(undefined).toBeDefined(), passes: false },
  { title: 'toBeUndefined on undefined', run: () => expect(undefined).toBeUndefined(), passes: true },
  { title: 'toBeUndefined on null', run: () => expect(null).toBeUndefined(), passes: false },
  { title: 'toBeNull on null', run: () => expect(null).toBeNull(), passes: true },
  { title: 'toBeNull on undefined', run: () => expect(undefined).toBeNull(), passes: false },
  { title: 'toBeNaN on NaN', run: () => expect(NaN).toBeNaN(), passes: true },
  { title: 'toBeNaN on a number', run: () => expect(1).toBeNaN(), passes: false },
  { title: 'toBeTruthy on a non-empty string', run: () => expect('a').toBeTruthy(), passes: true },
  { title: 'toBeTruthy on an empty string', run: () => expect('').toBeTruthy(), passes: false },
  { title: 'toBeFalsy on zero', run: () => expect(0).toBeFalsy(), passes: true },
  { title: 'toBeFalsy on one', run: () => expect(1).toBeFalsy(), passes: false },
  { title: 'toBeInstanceOf on a matching class', run: () => expect(new TypeError('x')).toBeInstanceOf(TypeError), passes: true },
  { title: 'toBeInstanceOf on an unrelated class', run: () => expect(new TypeError('x')).toBeInstanceOf(RangeError), passes: false },
  { title: 'toBeGreaterThan when greater', run: () => expect(2).toBeGreaterThan(1), passes: true },
  { title: 'toBeGreaterThan when equal', run: () => expect(1).toBeGreaterThan(1), passes: false },
  { title: 'toBeGreaterThanOrEqual when equal', run: () => expect(1).toBeGreaterThanOrEqual(1), passes: true },
  { title: 'toBeGreaterThanOrEqual when smaller', run: () => expect(0).toBeGreaterThanOrEqual(1), passes: false },
  { title: 'toBeLessThan when smaller', run: () => expect(0).toBeLessThan(1), passes: true },
  { title: 'toBeLessThan when equal', run: () => expect(1).toBeLessThan(1), passes: false },
  { title: 'toBeLessThanOrEqual when equal', run: () => expect(1).toBeLessThanOrEqual(1), passes: true },
  { title: 'toBeLessThanOrEqual when greater', run: () => expect(2).toBeLessThanOrEqual(1), passes: false },
  { title: 'toBeCloseTo within the default precision', run: () => expect(0.1 + 0.2).toBeCloseTo(0.3), passes: true },
  { title: 'toBeCloseTo outside the requested precision', run: () => expect(0.1).toBeCloseTo(0.2, 5), passes: false },
  { title: 'toHaveLength on a matching array', run: () => expect([1, 2]).toHaveLength(2), passes: true },
  { title: 'toHaveLength on a differing array', run: () => expect([1]).toHaveLength(2), passes: false },
  { title: 'toHaveLength on null', run: () => expect(null).toHaveLength(0), passes: false },
  { title: 'toContain on a substring', run: () => expect('abc').toContain('b'), passes: true },
  { title: 'toContain on an absent substring', run: () => expect('abc').toContain('z'), passes: false },
  { title: 'toContain on a Set member', run: () => expect(new Set([1])).toContain(1), passes: true },
  { title: 'toContain on an array member', run: () => expect([1, 2]).toContain(2), passes: true },
  { title: 'toContain comparing by identity', run: () => expect([{ a: 1 }]).toContain({ a: 1 }), passes: false },
  { title: 'toContainEqual comparing structurally', run: () => expect([{ a: 1 }]).toContainEqual({ a: 1 }), passes: true },
  { title: 'toContainEqual on an absent element', run: () => expect([{ a: 1 }]).toContainEqual({ a: 2 }), passes: false },
  { title: 'toMatch on a pattern', run: () => expect('abc').toMatch(/b/), passes: true },
  { title: 'toMatch on a failing pattern', run: () => expect('abc').toMatch(/z/), passes: false },
  { title: 'toMatch on a substring', run: () => expect('abc').toMatch('bc'), passes: true },
  { title: 'toMatchObject on a superset', run: () => expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }), passes: true },
  { title: 'toMatchObject on a mismatch', run: () => expect({ a: 1 }).toMatchObject({ a: 2 }), passes: false },
  { title: 'toHaveProperty on a nested path', run: () => expect({ a: { b: 1 } }).toHaveProperty('a.b'), passes: true },
  { title: 'toHaveProperty on an absent path', run: () => expect({ a: {} }).toHaveProperty('a.b'), passes: false },
  { title: 'toHaveProperty with a matching value', run: () => expect({ a: { b: 1 } }).toHaveProperty('a.b', 1), passes: true },
  { title: 'toHaveProperty with a differing value', run: () => expect({ a: { b: 1 } }).toHaveProperty('a.b', 2), passes: false },
  { title: 'toHaveProperty on an array path', run: () => expect({ a: { b: 1 } }).toHaveProperty(['a', 'b'], 1), passes: true },
  { title: 'toHaveProperty walking through null', run: () => expect({ a: null }).toHaveProperty('a.b'), passes: false },
  {
    title: 'toThrow when the function throws',
    run: () =>
      expect(() => {
        throw new Error('boom')
      }).toThrow(),
    passes: true,
  },
  { title: 'toThrow when the function returns', run: () => expect(() => undefined).toThrow(), passes: false },
  {
    title: 'toThrow matching a message substring',
    run: () =>
      expect(() => {
        throw new Error('boom hard')
      }).toThrow('boom'),
    passes: true,
  },
  {
    title: 'toThrow on a non-matching message',
    run: () =>
      expect(() => {
        throw new Error('boom')
      }).toThrow('other'),
    passes: false,
  },
  {
    title: 'toThrow matching a pattern',
    run: () =>
      expect(() => {
        throw new Error('boom')
      }).toThrow(/oo/),
    passes: true,
  },
  {
    title: 'toThrow matching an error class',
    run: () =>
      expect(() => {
        throw new TypeError('x')
      }).toThrow(TypeError),
    passes: true,
  },
  {
    title: 'toThrow on the wrong error class',
    run: () =>
      expect(() => {
        throw new TypeError('x')
      }).toThrow(RangeError),
    passes: false,
  },
  {
    title: 'toThrow matching an error instance by message',
    run: () =>
      expect(() => {
        throw new Error('same')
      }).toThrow(new Error('same')),
    passes: true,
  },
  {
    title: 'toThrowError as an alias of toThrow',
    run: () =>
      expect(() => {
        throw new Error('boom')
      }).toThrowError('boom'),
    passes: true,
  },
  {
    title: 'toThrow matching a thrown object by shape',
    run: () =>
      expect(() => {
        throw { code: 'E1', detail: 'x' }
      }).toThrow({ code: 'E1' }),
    passes: true,
  },
  {
    title: 'toThrow on a thrown object of the wrong shape',
    run: () =>
      expect(() => {
        throw { code: 'E1' }
      }).toThrow({ code: 'E2' }),
    passes: false,
  },
]

describe('expect matchers', () => {
  declareCases(CASES, (matcherCase) => `${matcherCase.passes ? 'accepts' : 'rejects'} ${matcherCase.title}`)
})

const NEGATION_CASES: MatcherCase[] = [
  { title: 'accepts a failing matcher', run: () => expect(1).not.toBe(2), passes: true },
  { title: 'rejects a passing matcher', run: () => expect(1).not.toBe(1), passes: false },
  { title: 'inverts toThrow for a function that does not throw', run: () => expect(() => undefined).not.toThrow(), passes: true },
  {
    title: 'inverts toThrow for a function that does throw',
    run: () =>
      expect(() => {
        throw new Error('boom')
      }).not.toThrow(),
    passes: false,
  },
]

describe('expect negation', () => {
  declareCases(NEGATION_CASES)
})

const MOCK_CASES: MatcherCase[] = [
  {
    title: 'accepts toHaveBeenCalled after a call',
    run: () => {
      const mock = createMockFn()
      mock()
      expect(mock).toHaveBeenCalled()
    },
    passes: true,
  },
  { title: 'rejects toHaveBeenCalled before any call', run: () => expect(createMockFn()).toHaveBeenCalled(), passes: false },
  {
    title: 'accepts toHaveBeenCalledTimes for the exact count',
    run: () => {
      const mock = createMockFn()
      mock()
      mock()
      expect(mock).toHaveBeenCalledTimes(2)
    },
    passes: true,
  },
  {
    title: 'rejects toHaveBeenCalledTimes for a differing count',
    run: () => expect(createMockFn()).toHaveBeenCalledTimes(1),
    passes: false,
  },
  {
    title: 'accepts toHaveBeenCalledWith for a matching call',
    run: () => {
      const mock = createMockFn()
      mock('a', 1)
      expect(mock).toHaveBeenCalledWith('a', 1)
    },
    passes: true,
  },
  {
    title: 'rejects toHaveBeenCalledWith for differing arguments',
    run: () => {
      const mock = createMockFn()
      mock('a')
      expect(mock).toHaveBeenCalledWith('b')
    },
    passes: false,
  },
  {
    title: 'accepts toHaveBeenLastCalledWith for the final call',
    run: () => {
      const mock = createMockFn()
      mock('first')
      mock('second')
      expect(mock).toHaveBeenLastCalledWith('second')
    },
    passes: true,
  },
  {
    title: 'rejects toHaveBeenLastCalledWith for an earlier call',
    run: () => {
      const mock = createMockFn()
      mock('first')
      mock('second')
      expect(mock).toHaveBeenLastCalledWith('first')
    },
    passes: false,
  },
  {
    title: 'accepts toHaveBeenNthCalledWith counting from one',
    run: () => {
      const mock = createMockFn()
      mock('first')
      mock('second')
      expect(mock).toHaveBeenNthCalledWith(1, 'first')
    },
    passes: true,
  },
  {
    title: 'rejects toHaveBeenNthCalledWith beyond the call count',
    run: () => expect(createMockFn()).toHaveBeenNthCalledWith(3, 'x'),
    passes: false,
  },
  {
    title: 'refuses a call matcher applied to a plain function',
    run: () => expect(() => undefined).toHaveBeenCalled(),
    passes: false,
    error: TypeError,
  },
  {
    title: 'matches a call recorded with an asymmetric matcher',
    run: () => {
      const mock = createMockFn()
      mock({ id: 1, extra: true })
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    },
    passes: true,
  },
]

describe('expect on mocks', () => {
  declareCases(MOCK_CASES)
})

const NON_FUNCTION_CASES: MatcherCase[] = [
  { title: 'refuses toThrow applied to a value', run: () => expect(5).toThrow(), passes: false },
  { title: 'refuses a negated toThrow applied to a value', run: () => expect(5).not.toThrow(), passes: false },
]

describe('expect on non-functions', () => {
  declareCases(NON_FUNCTION_CASES)
})

const PROMISE_CASES: PromiseCase[] = [
  { title: 'accepts resolves for a fulfilled promise', run: () => expect(Promise.resolve(1)).resolves.toBe(1), passes: true },
  { title: 'rejects resolves when the value differs', run: () => expect(Promise.resolve(1)).resolves.toBe(2), passes: false },
  {
    title: 'accepts rejects for a rejected promise',
    run: () => expect(Promise.reject(new Error('boom'))).rejects.toThrow('boom'),
    passes: true,
  },
  { title: 'rejects rejects when the promise fulfils', run: () => expect(Promise.resolve(1)).rejects.toThrow(), passes: false },
  { title: 'inverts a negated resolves matcher', run: () => expect(Promise.resolve(1)).resolves.not.toBe(2), passes: true },
  {
    title: 'reads the rejection reason for a value matcher',
    run: () => expect(Promise.reject(new Error('boom'))).rejects.toBeInstanceOf(Error),
    passes: true,
  },
  {
    title: 'matches the rejection reason with toThrow',
    run: () => expect(Promise.reject(new TypeError('boom'))).rejects.toThrow(TypeError),
    passes: true,
  },
  {
    title: 'rejects a resolved value that toThrow cannot match',
    run: () => expect(Promise.resolve(new Error('other'))).resolves.toThrow('boom'),
    passes: false,
  },
  {
    title: 'inverts a negated rejects matcher',
    run: () => expect(Promise.reject(new Error('boom'))).rejects.not.toThrow('other'),
    passes: true,
  },
]

describe('expect promise modes', () => {
  declarePromiseCases(PROMISE_CASES)
})

const ASYMMETRIC_CASES: MatcherCase[] = [
  { title: 'matches any value of a primitive constructor', run: () => expect({ a: 'x' }).toEqual({ a: expect.any(String) }), passes: true },
  { title: 'rejects a value of the wrong constructor', run: () => expect({ a: 1 }).toEqual({ a: expect.any(String) }), passes: false },
  { title: 'matches any value of a class', run: () => expect(new TypeError('x')).toEqual(expect.any(TypeError)), passes: true },
  { title: 'matches anything that is not nullish', run: () => expect({ a: 0 }).toEqual({ a: expect.anything() }), passes: true },
  { title: 'rejects null for anything', run: () => expect({ a: null }).toEqual({ a: expect.anything() }), passes: false },
  {
    title: 'matches an object carrying the sample keys',
    run: () => expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 })),
    passes: true,
  },
  {
    title: 'rejects an object missing a sample key',
    run: () => expect({ b: 2 }).toEqual(expect.objectContaining({ a: 1 })),
    passes: false,
  },
  {
    title: 'matches an array containing the sample members',
    run: () => expect([1, 2, 3]).toEqual(expect.arrayContaining([3, 1])),
    passes: true,
  },
  { title: 'rejects an array missing a sample member', run: () => expect([1]).toEqual(expect.arrayContaining([2])), passes: false },
  { title: 'matches a string containing the sample', run: () => expect('abcdef').toEqual(expect.stringContaining('cde')), passes: true },
  { title: 'rejects a string missing the sample', run: () => expect('abc').toEqual(expect.stringContaining('z')), passes: false },
  { title: 'matches a string against a pattern', run: () => expect('abc').toEqual(expect.stringMatching(/^a/)), passes: true },
  { title: 'rejects a string failing the pattern', run: () => expect('abc').toEqual(expect.stringMatching(/^z/)), passes: false },
  { title: 'matches a number close to the sample', run: () => expect(0.1 + 0.2).toEqual(expect.closeTo(0.3)), passes: true },
  { title: 'rejects a number outside the precision', run: () => expect(0.1).toEqual(expect.closeTo(0.9)), passes: false },
  { title: 'inverts objectContaining', run: () => expect({ b: 2 }).toEqual(expect.not.objectContaining({ a: 1 })), passes: true },
  { title: 'inverts arrayContaining', run: () => expect([1]).toEqual(expect.not.arrayContaining([2])), passes: true },
  { title: 'inverts stringContaining', run: () => expect('abc').toEqual(expect.not.stringContaining('z')), passes: true },
  { title: 'inverts stringMatching', run: () => expect('abc').toEqual(expect.not.stringMatching(/^z/)), passes: true },
]

describe('asymmetric matchers', () => {
  declareCases(ASYMMETRIC_CASES)
})
