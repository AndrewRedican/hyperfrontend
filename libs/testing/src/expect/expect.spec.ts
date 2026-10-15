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
}

/**
 * Asserts that a matcher accepted its subject.
 *
 * @param run - The matcher invocation.
 */
function assertAccepts(run: () => void): void {
  assert.doesNotThrow(run)
}

/**
 * Asserts that a matcher rejected its subject with an assertion error.
 *
 * @param run - The matcher invocation.
 */
function assertRejects(run: () => void): void {
  assert.throws(run, AssertionError)
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
  for (const matcherCase of CASES) {
    it(`${matcherCase.passes ? 'accepts' : 'rejects'} ${matcherCase.title}`, () => {
      if (matcherCase.passes) assertAccepts(matcherCase.run)
      else assertRejects(matcherCase.run)
    })
  }
})

describe('expect negation', () => {
  it('accepts a failing matcher', () => {
    assertAccepts(() => expect(1).not.toBe(2))
  })

  it('rejects a passing matcher', () => {
    assertRejects(() => expect(1).not.toBe(1))
  })

  it('inverts toThrow for a function that does not throw', () => {
    assertAccepts(() => expect(() => undefined).not.toThrow())
  })

  it('inverts toThrow for a function that does throw', () => {
    assertRejects(() =>
      expect(() => {
        throw new Error('boom')
      }).not.toThrow()
    )
  })
})

describe('expect on mocks', () => {
  it('accepts toHaveBeenCalled after a call', () => {
    const mock = createMockFn()
    mock()
    assertAccepts(() => expect(mock).toHaveBeenCalled())
  })

  it('rejects toHaveBeenCalled before any call', () => {
    assertRejects(() => expect(createMockFn()).toHaveBeenCalled())
  })

  it('accepts toHaveBeenCalledTimes for the exact count', () => {
    const mock = createMockFn()
    mock()
    mock()
    assertAccepts(() => expect(mock).toHaveBeenCalledTimes(2))
  })

  it('rejects toHaveBeenCalledTimes for a differing count', () => {
    assertRejects(() => expect(createMockFn()).toHaveBeenCalledTimes(1))
  })

  it('accepts toHaveBeenCalledWith for a matching call', () => {
    const mock = createMockFn()
    mock('a', 1)
    assertAccepts(() => expect(mock).toHaveBeenCalledWith('a', 1))
  })

  it('rejects toHaveBeenCalledWith for differing arguments', () => {
    const mock = createMockFn()
    mock('a')
    assertRejects(() => expect(mock).toHaveBeenCalledWith('b'))
  })

  it('accepts toHaveBeenLastCalledWith for the final call', () => {
    const mock = createMockFn()
    mock('first')
    mock('second')
    assertAccepts(() => expect(mock).toHaveBeenLastCalledWith('second'))
  })

  it('rejects toHaveBeenLastCalledWith for an earlier call', () => {
    const mock = createMockFn()
    mock('first')
    mock('second')
    assertRejects(() => expect(mock).toHaveBeenLastCalledWith('first'))
  })

  it('accepts toHaveBeenNthCalledWith counting from one', () => {
    const mock = createMockFn()
    mock('first')
    mock('second')
    assertAccepts(() => expect(mock).toHaveBeenNthCalledWith(1, 'first'))
  })

  it('rejects toHaveBeenNthCalledWith beyond the call count', () => {
    assertRejects(() => expect(createMockFn()).toHaveBeenNthCalledWith(3, 'x'))
  })

  it('refuses a call matcher applied to a plain function', () => {
    assert.throws(() => expect(() => undefined).toHaveBeenCalled(), TypeError)
  })

  it('matches a call recorded with an asymmetric matcher', () => {
    const mock = createMockFn()
    mock({ id: 1, extra: true })
    assertAccepts(() => expect(mock).toHaveBeenCalledWith(expect.objectContaining({ id: 1 })))
  })
})

describe('expect on non-functions', () => {
  it('refuses toThrow applied to a value', () => {
    assertRejects(() => expect(5).toThrow())
  })

  it('refuses a negated toThrow applied to a value', () => {
    assertRejects(() => expect(5).not.toThrow())
  })
})

describe('expect promise modes', () => {
  it('accepts resolves for a fulfilled promise', async () => {
    await expect(Promise.resolve(1)).resolves.toBe(1)
  })

  it('rejects resolves when the value differs', async () => {
    await assert.rejects(() => expect(Promise.resolve(1)).resolves.toBe(2), AssertionError)
  })

  it('accepts rejects for a rejected promise', async () => {
    await expect(Promise.reject(new Error('boom'))).rejects.toThrow('boom')
  })

  it('rejects rejects when the promise fulfils', async () => {
    await assert.rejects(() => expect(Promise.resolve(1)).rejects.toThrow(), AssertionError)
  })

  it('inverts a negated resolves matcher', async () => {
    await expect(Promise.resolve(1)).resolves.not.toBe(2)
  })

  it('reads the rejection reason for a value matcher', async () => {
    await expect(Promise.reject(new Error('boom'))).rejects.toBeInstanceOf(Error)
  })

  it('matches the rejection reason with toThrow', async () => {
    await expect(Promise.reject(new TypeError('boom'))).rejects.toThrow(TypeError)
  })

  it('rejects a resolved value that toThrow cannot match', async () => {
    await assert.rejects(() => expect(Promise.resolve(new Error('other'))).resolves.toThrow('boom'), AssertionError)
  })

  it('inverts a negated rejects matcher', async () => {
    await expect(Promise.reject(new Error('boom'))).rejects.not.toThrow('other')
  })
})

describe('asymmetric matchers', () => {
  it('matches any value of a primitive constructor', () => {
    assertAccepts(() => expect({ a: 'x' }).toEqual({ a: expect.any(String) }))
  })

  it('rejects a value of the wrong constructor', () => {
    assertRejects(() => expect({ a: 1 }).toEqual({ a: expect.any(String) }))
  })

  it('matches any value of a class', () => {
    assertAccepts(() => expect(new TypeError('x')).toEqual(expect.any(TypeError)))
  })

  it('matches anything that is not nullish', () => {
    assertAccepts(() => expect({ a: 0 }).toEqual({ a: expect.anything() }))
  })

  it('rejects null for anything', () => {
    assertRejects(() => expect({ a: null }).toEqual({ a: expect.anything() }))
  })

  it('matches an object carrying the sample keys', () => {
    assertAccepts(() => expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 })))
  })

  it('rejects an object missing a sample key', () => {
    assertRejects(() => expect({ b: 2 }).toEqual(expect.objectContaining({ a: 1 })))
  })

  it('matches an array containing the sample members', () => {
    assertAccepts(() => expect([1, 2, 3]).toEqual(expect.arrayContaining([3, 1])))
  })

  it('rejects an array missing a sample member', () => {
    assertRejects(() => expect([1]).toEqual(expect.arrayContaining([2])))
  })

  it('matches a string containing the sample', () => {
    assertAccepts(() => expect('abcdef').toEqual(expect.stringContaining('cde')))
  })

  it('rejects a string missing the sample', () => {
    assertRejects(() => expect('abc').toEqual(expect.stringContaining('z')))
  })

  it('matches a string against a pattern', () => {
    assertAccepts(() => expect('abc').toEqual(expect.stringMatching(/^a/)))
  })

  it('rejects a string failing the pattern', () => {
    assertRejects(() => expect('abc').toEqual(expect.stringMatching(/^z/)))
  })

  it('matches a number close to the sample', () => {
    assertAccepts(() => expect(0.1 + 0.2).toEqual(expect.closeTo(0.3)))
  })

  it('rejects a number outside the precision', () => {
    assertRejects(() => expect(0.1).toEqual(expect.closeTo(0.9)))
  })

  it('inverts objectContaining', () => {
    assertAccepts(() => expect({ b: 2 }).toEqual(expect.not.objectContaining({ a: 1 })))
  })

  it('inverts arrayContaining', () => {
    assertAccepts(() => expect([1]).toEqual(expect.not.arrayContaining([2])))
  })

  it('inverts stringContaining', () => {
    assertAccepts(() => expect('abc').toEqual(expect.not.stringContaining('z')))
  })

  it('inverts stringMatching', () => {
    assertAccepts(() => expect('abc').toEqual(expect.not.stringMatching(/^z/)))
  })
})
