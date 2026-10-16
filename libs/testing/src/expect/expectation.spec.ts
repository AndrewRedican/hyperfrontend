import { AssertionError } from 'node:assert'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { expect } from './expect'
import { requireAssertionCount, resetAssertionCount, verifyAssertionCount } from './expectation'

/**
 * A test body as the counter sees it: the count it declares and the assertions it runs.
 */
type CountedBody = {
  /** How the test reads in the report. */
  title: string
  /** Declares a count, if any, and runs assertions, the way a test body would. */
  run: () => void
  /** Whether verification should accept the body once it has run. */
  passes: boolean
}

/**
 * Bodies the counter judges, each run on a freshly reset counter the way `it` brackets a test.
 */
const BODIES: CountedBody[] = [
  { title: 'passes when no count was declared', run: () => undefined, passes: true },
  {
    title: 'passes when the declared count was reached',
    run: () => {
      requireAssertionCount(2)
      expect(1).toBe(1)
      expect(2).toBe(2)
    },
    passes: true,
  },
  {
    title: 'fails when fewer assertions ran than declared',
    run: () => {
      requireAssertionCount(2)
      expect(1).toBe(1)
    },
    passes: false,
  },
  {
    title: 'fails when more assertions ran than declared',
    run: () => {
      requireAssertionCount(1)
      expect(1).toBe(1)
      expect(2).toBe(2)
    },
    passes: false,
  },
  {
    title: 'passes hasAssertions when at least one assertion ran',
    run: () => {
      expect.hasAssertions()
      expect(1).toBe(1)
    },
    passes: true,
  },
  { title: 'fails hasAssertions when none ran', run: () => expect.hasAssertions(), passes: false },
  {
    title: 'records a declared count through expect.assertions',
    run: () => {
      expect.assertions(1)
      expect(1).toBe(1)
    },
    passes: true,
  },
]

describe('the assertion counter', () => {
  for (const countedBody of BODIES) {
    if (countedBody.passes) {
      it(countedBody.title, () => {
        resetAssertionCount()
        countedBody.run()
        assert.doesNotThrow(() => verifyAssertionCount())
      })
    } else {
      it(countedBody.title, () => {
        resetAssertionCount()
        countedBody.run()
        assert.throws(() => verifyAssertionCount(), AssertionError)
      })
    }
  }

  it('clears a previous declaration on reset', () => {
    requireAssertionCount(5)
    resetAssertionCount()
    assert.doesNotThrow(() => verifyAssertionCount())
  })
})
