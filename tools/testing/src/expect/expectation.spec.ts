import { AssertionError } from 'node:assert'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { expect } from './expect'
import { requireAssertionCount, resetAssertionCount, verifyAssertionCount } from './expectation'

describe('the assertion counter', () => {
  it('passes when no count was declared', () => {
    resetAssertionCount()
    assert.doesNotThrow(() => verifyAssertionCount())
  })

  it('passes when the declared count was reached', () => {
    resetAssertionCount()
    requireAssertionCount(2)
    expect(1).toBe(1)
    expect(2).toBe(2)
    assert.doesNotThrow(() => verifyAssertionCount())
  })

  it('fails when fewer assertions ran than declared', () => {
    resetAssertionCount()
    requireAssertionCount(2)
    expect(1).toBe(1)
    assert.throws(() => verifyAssertionCount(), AssertionError)
  })

  it('fails when more assertions ran than declared', () => {
    resetAssertionCount()
    requireAssertionCount(1)
    expect(1).toBe(1)
    expect(2).toBe(2)
    assert.throws(() => verifyAssertionCount(), AssertionError)
  })

  it('passes hasAssertions when at least one assertion ran', () => {
    resetAssertionCount()
    expect.hasAssertions()
    expect(1).toBe(1)
    assert.doesNotThrow(() => verifyAssertionCount())
  })

  it('fails hasAssertions when none ran', () => {
    resetAssertionCount()
    expect.hasAssertions()
    assert.throws(() => verifyAssertionCount(), AssertionError)
  })

  it('records a declared count through expect.assertions', () => {
    resetAssertionCount()
    expect.assertions(1)
    expect(1).toBe(1)
    assert.doesNotThrow(() => verifyAssertionCount())
  })

  it('clears a previous declaration on reset', () => {
    requireAssertionCount(5)
    resetAssertionCount()
    assert.doesNotThrow(() => verifyAssertionCount())
  })
})
