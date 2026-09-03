import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getValue } from './get-value'

describe('getValue', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let target: any

  beforeEach(() => {
    target = { a: { b: { c: ['foo', 'bar'] } } }
  })

  it('returns the value of the path when it exists', () => {
    expect(getValue(target, ['a'])).toEqual({ b: { c: ['foo', 'bar'] } })
    expect(getValue(target, ['a', 'b'])).toEqual({ c: ['foo', 'bar'] })
    expect(getValue(target, ['a', 'b', 'c'])).toEqual(['foo', 'bar'])
    expect(getValue(target, ['a', 'b', 'c', '0'])).toEqual('foo')
  })

  it('returns same value when path is empty list', () => {
    // @ts-expect-error Testing invalid input
    expect(getValue(target, [])).toEqual(target)
  })

  it('throw error when path is not an array', () => {
    // @ts-expect-error Testing invalid input
    expect(() => getValue(target)).toThrow('Expected path to be a non-empty array of strings.')

    expect(() => getValue(target, null)).toThrow('Expected path to be a non-empty array of strings.')

    // @ts-expect-error Testing invalid input
    expect(() => getValue(target, 'a.b.c')).toThrow('Expected path to be a non-empty array of strings.')

    // @ts-expect-error Testing invalid input
    expect(() => getValue(target, {})).toThrow('Expected path to be a non-empty array of strings.')
  })

  it('throws error when path contains non-string element', () => {
    // @ts-expect-error Testing invalid input
    expect(() => getValue(target, ['a', 123])).toThrow('Expected path[1] to be a string, got number.')
  })

  it('returns onMissingKey default when key is missing', () => {
    expect(getValue(target, ['a', 'b', 'd'], { onMissingKey: 'default-value' })).toEqual('default-value')
    expect(getValue(target, ['a', 'x', 'y'], { onMissingKey: null })).toEqual(null)
  })

  it('returns onMissingKey default when traversing non-iterable value', () => {
    const simpleTarget = { a: 'string-value' }
    expect(getValue(simpleTarget, ['a', 'b'], { onMissingKey: 'default' })).toEqual('default')
  })

  it('returns onError default when an error occurs during traversal', () => {
    const errorTarget = { a: { b: null } }
    expect(getValue(errorTarget, ['a', 'b', 'c'], { onError: 'error-default' })).toEqual('error-default')
  })

  it('throws error when no onError default is provided', () => {
    const errorTarget = { a: { b: null } }
    expect(() => getValue(errorTarget, ['a', 'b', 'c'])).toThrow()
  })
})
