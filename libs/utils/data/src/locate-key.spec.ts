import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { locateKey } from './locate-key'
import { setConfig } from './shared/consts'

describe('locateKey', () => {
  let target: unknown

  beforeEach(() => {
    target = {
      'hello-world': false,
      b: {
        helicopter: 42,
      },
      HELICOPTER: 2,
      c: ['helix', 'hell'],
      helium: {},
      verthel: 2022,
    }
  })

  it('throws an error for incorrect pattern types', () => {
    expect(() => locateKey(target, null)).toThrow('Expected pattern to be either a string of a regular expression.')
  })

  it.each([
    ['h', []],
    ['h*', []],
    ['helix', []],
    ['helicopter', [['b', 'helicopter']]],
  ])('returns locations where key name matches %p exactly', (name: string, expected: string[][]) => {
    expect(locateKey(target, name, { depth: [0, '*'] })).toEqual(expected)
  })

  it('does not support glob patterns, it uses native regular expressions instead', () => {
    expect(locateKey(target, 'h*', { depth: [0, '*'] })).toEqual([])
  })

  it('returns locations where key name matches a pattern', () => {
    expect(locateKey(target, /^hel/i, { depth: [0, '*'] })).toEqual([['hello-world'], ['HELICOPTER'], ['helium'], ['b', 'helicopter']])
  })

  it('does not support regular expression string, it uses native regular expressions instead', () => {
    expect(locateKey(target, 'h.*', { depth: [0, '*'] })).toEqual([])
  })
})

describe('locateKey - with config detectCircularReferences:true', () => {
  // lint-disable-next-line typescript/no-explicit-any
  let target: any

  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  beforeEach(() => {
    target = {
      'hello-world': false,
      b: {
        helicopter: 42,
      },
      HELICOPTER: 2,
      c: ['helix', 'hell'],
      helium: {},
      verthel: 2022,
    }
    target.HELICOPTER = target
    target.b.helicopter = target.verthel
  })

  it.each([
    ['h', []],
    ['h*', []],
    ['helix', []],
    ['helicopter', [['b', 'helicopter']]],
  ])('returns locations where key name matches %p exactly', (name: string, expected: string[][]) => {
    expect(locateKey(target, name, { depth: [0, '*'] })).toEqual(expected)
  })

  it('does not support glob patterns, it uses native regular expressions instead', () => {
    expect(locateKey(target, 'h*', { depth: [0, '*'] })).toEqual([])
  })

  it('returns locations where key name matches a pattern', () => {
    expect(locateKey(target, /^hel/i, { depth: [0, '*'] })).toEqual([['hello-world'], ['HELICOPTER'], ['helium'], ['b', 'helicopter']])
  })

  it('does not support regular expression string, it uses native regular expressions instead', () => {
    expect(locateKey(target, 'h.*', { depth: [0, '*'] })).toEqual([])
  })
})
