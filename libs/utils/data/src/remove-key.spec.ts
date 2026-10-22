/* lint-disable typescript/no-explicit-any */
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { removeKey } from './remove-key'
import { setConfig } from './shared/consts'

describe('removeKey', () => {
  let target: any

  const prepareTarget = (): void => {
    target = [
      {
        id: 1,
        first_name: 'Anabal',
        last_name: 'Armer',
        email: 'aarmer0@wired.com',
        gender: 'Bigender',
        ip_address: '166.211.210.117',
      },
      {
        id: 2,
        first_name: 'Blair',
        last_name: 'Tithecote',
        email: 'btithecote1@huffingtonpost.com',
        gender: 'Male',
        ip_address: '121.144.216.170',
      },
    ]
  }

  beforeEach(() => prepareTarget())

  it('throws an error for incorrect pattern types', () => {
    expect(() => removeKey(target, null)).toThrow('Expected pattern to be either a string of a regular expression.')
  })

  it.each([
    ['ip', []],
    ['166.211.210.117', []],
    [
      'ip_address',
      [
        ['0', 'ip_address'],
        ['1', 'ip_address'],
      ],
    ],
  ])('returns locations where key name matches %p exactly', (name: string, expected: string[][]) => {
    expect(removeKey(target, name)).toEqual(expected)
  })

  it('removes the keys whose name matches exactly', () => {
    removeKey(target, 'ip_address')
    expect(target.filter((item: object) => 'ip_address' in item)).toEqual([])
  })

  it('does not support glob patterns, it uses native regular expressions instead', () => {
    expect(removeKey(target, 'ip*')).toEqual([])
  })

  it('returns locations where key name matches a pattern', () => {
    expect(removeKey(target, /_name|0/i)).toEqual([['0'], ['0', 'first_name'], ['0', 'last_name']])
  })

  it('removes the keys whose name matches a pattern', () => {
    removeKey(target, /_name|0/i)
    expect(['first_name', 'last_name'].filter((key) => key in target[0])).toEqual([])
  })

  it('does not support regular expression string, it uses native regular expressions instead', () => {
    expect(removeKey(target, 'ip.*')).toEqual([])
  })
})

describe('removeKey - on an array', () => {
  it('removes every matching index', () => {
    const target = [1, 2, 3]
    removeKey(target, /./)
    expect(target).toEqual([])
  })

  it('reports every removed index in ascending order', () => {
    expect(removeKey([1, 2, 3], /./)).toEqual([['0'], ['1'], ['2']])
  })

  it('leaves the items whose index does not match', () => {
    const target = ['a', 'b', 'c']
    removeKey(target, '1')
    expect(target).toEqual(['a', 'c'])
  })
})

describe('removeKey - with config detectCircularReferences:true', () => {
  let target: any

  const prepareTarget = (): void => {
    target = [
      {
        id: 1,
        first_name: 'Anabal',
        last_name: 'Armer',
        email: 'aarmer0@wired.com',
        gender: 'Bigender',
        ip_address: '166.211.210.117',
      },
      {
        id: 2,
        first_name: 'Blair',
        last_name: 'Tithecote',
        email: 'btithecote1@huffingtonpost.com',
        gender: 'Male',
        ip_address: '121.144.216.170',
      },
    ]
    target[0].gender = target[1].email
    target[1].gender = target[0].email
  }

  beforeEach(() => {
    setConfig({ detectCircularReferences: true })
    prepareTarget()
  })

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('throws an error for incorrect pattern types', () => {
    expect(() => removeKey(target, null)).toThrow('Expected pattern to be either a string of a regular expression.')
  })

  it.each([
    ['ip', []],
    ['166.211.210.117', []],
    [
      'ip_address',
      [
        ['0', 'ip_address'],
        ['1', 'ip_address'],
      ],
    ],
  ])('returns locations where key name matches %p exactly', (name: string, expected: string[][]) => {
    expect(removeKey(target, name)).toEqual(expected)
  })

  it('removes the keys whose name matches exactly', () => {
    removeKey(target, 'ip_address')
    expect(target.filter((item: object) => 'ip_address' in item)).toEqual([])
  })

  it('does not support glob patterns, it uses native regular expressions instead', () => {
    expect(removeKey(target, 'ip*')).toEqual([])
  })

  it('returns locations where key name matches a pattern', () => {
    expect(removeKey(target, /_name|0/i)).toEqual([['0'], ['0', 'first_name'], ['0', 'last_name']])
  })

  it('removes the keys whose name matches a pattern', () => {
    removeKey(target, /_name|0/i)
    expect(['first_name', 'last_name'].filter((key) => key in target[0])).toEqual([])
  })

  it('does not support regular expression string, it uses native regular expressions instead', () => {
    expect(removeKey(target, 'ip.*')).toEqual([])
  })
})
