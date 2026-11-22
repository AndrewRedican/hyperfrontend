import type { ServeHeaderRule } from './serve-types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { contentSecurityPolicy } from './content-security-policy'
import { checkEmbedders, embedders, frameAncestors } from './embedders'
import { expandHeaderPolicy } from './expand'
import { checkPermissionsPolicy, permissionsPolicy } from './permissions-policy'
import { checkServeConfig, validateServeConfig } from './serve-config'

// how: A list with a hole at the given index, as a doubled comma leaves one in a config written in TypeScript.
const withHole = <T>(entries: readonly T[], index: number): T[] => {
  const sparse = [...entries.slice(0, index), undefined as T, ...entries.slice(index)]
  delete sparse[index]
  return sparse
}

describe('a hole in a list', () => {
  it('is no entry the list holds', () => {
    expect(1 in withHole(['a', 'b'], 1)).toBe(false)
  })

  it('keeps the entries around it', () => {
    expect(Array.from(withHole(['a', 'b'], 1))).toEqual(['a', undefined, 'b'])
  })
})

describe('a hole in the embedders', () => {
  it('is reported as an entry that is no string', () => {
    expect(checkEmbedders(withHole(["'self'", 'https://host.example'], 1))).toEqual([
      { code: 'embedder-not-string', path: 'embedders[1]', message: 'embedders[1] must be a string.' },
    ])
  })

  it('is reported for a list that holds nothing else', () => {
    expect(checkEmbedders(withHole([], 0)).map((issue) => issue.message)).toEqual(['embedders[0] must be a string.'])
  })

  it('keeps the directive from being written', () => {
    expect(() => frameAncestors(withHole(['https://host.example'], 0))).toThrow('embedders[0] must be a string.')
  })

  it('keeps the preset from building a rule', () => {
    expect(() => embedders(withHole(["'self'"], 1))).toThrow('embedders[1] must be a string.')
  })

  it('is refused in a serve config', () => {
    expect(checkServeConfig({ embedders: withHole(["'self'"], 0) }).map((issue) => issue.code)).toEqual(['embedder-not-string'])
  })
})

describe('a hole in an allowlist', () => {
  it('is reported as an entry that is no string', () => {
    expect(checkPermissionsPolicy({ camera: withHole(['self', 'https://maps.example'], 1) })).toEqual([
      {
        code: 'permissions-policy-entry-not-string',
        path: 'permissionsPolicy["camera"][1]',
        message: 'permissionsPolicy["camera"][1] must be a string.',
      },
    ])
  })

  it('keeps the preset from building a rule', () => {
    expect(() => permissionsPolicy({ camera: withHole(['self'], 0) })).toThrow('permissionsPolicy["camera"][0] must be a string.')
  })
})

describe('a hole in the values of a directive', () => {
  it('keeps the preset from building a rule', () => {
    expect(() => contentSecurityPolicy({ embedders: [], directives: { 'img-src': withHole(["'self'", 'data:'], 1) } })).toThrow(
      'directives["img-src"][1] must be one value of visible ASCII with no whitespace, ";" or ",".'
    )
  })
})

describe('a hole in the header rules', () => {
  const RULE: ServeHeaderRule = { headers: { 'X-Test': 'on' } }

  it('is reported as a rule that is no object', () => {
    expect(checkServeConfig({ headers: withHole([RULE, RULE], 1) })).toEqual([
      { code: 'rule-not-object', path: 'headers[1]', message: 'headers[1] must be an object.' },
    ])
  })

  it('is reported after every problem a rule has always been refused for', () => {
    expect(checkServeConfig({ headers: withHole([RULE, 5], 0) }).map((issue) => issue.message)).toEqual([
      'headers[2] must be an object.',
      'headers[0] must be an object.',
    ])
  })

  it('is reported once beside an entry that is undefined', () => {
    expect(checkServeConfig({ headers: withHole([undefined, RULE], 1) }).map((issue) => issue.message)).toEqual([
      'headers[0] must be an object.',
      'headers[1] must be an object.',
    ])
  })

  it('keeps the rules from being judged against the embedders', () => {
    expect(checkServeConfig({ embedders: ["'self'"], headers: withHole([RULE], 0) }).map((issue) => issue.code)).toEqual([
      'rule-not-object',
    ])
  })

  it('is refused by the config validator', () => {
    expect(() => validateServeConfig({ headers: withHole([RULE], 1) }, '/p/c.ts')).toThrow('/p/c.ts: headers[1] must be an object.')
  })

  it('is refused by the expansion', () => {
    expect(() => expandHeaderPolicy({ headers: withHole([RULE], 0) })).toThrow('headers[0] must be an object.')
  })
})
