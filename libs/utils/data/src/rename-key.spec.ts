/* lint-disable typescript/no-explicit-any */
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { renameKey } from './rename-key'
import { setConfig } from './shared/consts'

describe('renameKey', () => {
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
    // @ts-expect-error TS-2554 - deliberately passing incorrect data types
    expect(() => renameKey(target, null)).toThrow('Expected pattern to be either a string of a regular expression.')
  })

  it('throws an error for incorrect name types', () => {
    expect(() => renameKey(target, '', null)).toThrow('Expected name to be a string.')
  })

  it.each([
    ['ip', 'ip2', []],
    ['166.211.210.117', 'xxx.xxx.xxx.xxx', []],
    [
      'ip_address',
      'ipAddress',
      [
        ['0', 'ipAddress'],
        ['1', 'ipAddress'],
      ],
    ],
  ])('returns locations where key name matches %p exactly', (pattern: string, name: string, expected: string[][]) => {
    expect(renameKey(target, pattern, name)).toEqual(expected)
  })

  it('renames the keys whose name matches exactly', () => {
    renameKey(target, 'ip_address', 'ipAddress')
    expect(target.map((item: object) => ({ ipAddress: 'ipAddress' in item, ip_address: 'ip_address' in item }))).toEqual([
      { ipAddress: true, ip_address: false },
      { ipAddress: true, ip_address: false },
    ])
  })

  it('does not support glob patterns, it uses native regular expressions instead', () => {
    expect(renameKey(target, 'ip*', 'ip2')).toEqual([])
  })

  it('returns locations where key name matches a pattern', () => {
    expect(renameKey(target, /_name/i, 'Name')).toEqual([
      ['0', 'firstName'],
      ['0', 'lastName'],
      ['1', 'firstName'],
      ['1', 'lastName'],
    ])
  })

  it('renames the keys whose name matches a pattern', () => {
    renameKey(target, /_name/i, 'Name')
    expect(
      target.map((item: object) => ({
        firstName: 'firstName' in item,
        lastName: 'lastName' in item,
        first_name: 'first_name' in item,
        last_name: 'last_name' in item,
      }))
    ).toEqual([
      { firstName: true, lastName: true, first_name: false, last_name: false },
      { firstName: true, lastName: true, first_name: false, last_name: false },
    ])
  })

  it('does not support regular expression string, it uses native regular expressions instead', () => {
    expect(renameKey(target, 'ip.*', 'ip2')).toEqual([])
  })
})

describe('renameKey - with config detectCircularReferences:true', () => {
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
    // @ts-expect-error TS-2554 - deliberately passing incorrect data types
    expect(() => renameKey(target, null)).toThrow('Expected pattern to be either a string of a regular expression.')
  })

  it('throws an error for incorrect name types', () => {
    expect(() => renameKey(target, '', null)).toThrow('Expected name to be a string.')
  })

  it.each([
    ['ip', 'ip2', []],
    ['166.211.210.117', 'xxx.xxx.xxx.xxx', []],
    [
      'ip_address',
      'ipAddress',
      [
        ['0', 'ipAddress'],
        ['1', 'ipAddress'],
      ],
    ],
  ])('returns locations where key name matches %p exactly', (pattern: string, name: string, expected: string[][]) => {
    expect(renameKey(target, pattern, name)).toEqual(expected)
  })

  it('renames the keys whose name matches exactly', () => {
    renameKey(target, 'ip_address', 'ipAddress')
    expect(target.map((item: object) => ({ ipAddress: 'ipAddress' in item, ip_address: 'ip_address' in item }))).toEqual([
      { ipAddress: true, ip_address: false },
      { ipAddress: true, ip_address: false },
    ])
  })

  it('does not support glob patterns, it uses native regular expressions instead', () => {
    expect(renameKey(target, 'ip*', 'ip2')).toEqual([])
  })

  it('returns locations where key name matches a pattern', () => {
    expect(renameKey(target, /_name/i, 'Name')).toEqual([
      ['0', 'firstName'],
      ['0', 'lastName'],
      ['1', 'firstName'],
      ['1', 'lastName'],
    ])
  })

  it('renames the keys whose name matches a pattern', () => {
    renameKey(target, /_name/i, 'Name')
    expect(
      target.map((item: object) => ({
        firstName: 'firstName' in item,
        lastName: 'lastName' in item,
        first_name: 'first_name' in item,
        last_name: 'last_name' in item,
      }))
    ).toEqual([
      { firstName: true, lastName: true, first_name: false, last_name: false },
      { firstName: true, lastName: true, first_name: false, last_name: false },
    ])
  })

  it('does not support regular expression string, it uses native regular expressions instead', () => {
    expect(renameKey(target, 'ip.*', 'ip2')).toEqual([])
  })
})
