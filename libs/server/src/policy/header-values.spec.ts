import { validateHeaderValue } from 'node:http'
import { describe, expect, it } from '@hyperfrontend/testing'
import { expandHeaderPolicy } from './expand'
import { checkServeConfig, validateHeaderRule, validateServeConfig } from './serve-config'

const CONTROL = 'must not contain control characters.'

const WIDE = 'must not contain a character above U+00FF: a header value is sent one byte per character.'

// how: Asks the validator about one header value and keeps the codes it reports.
const codesFor = (value: string): readonly string[] =>
  checkServeConfig({ headers: [{ headers: { 'X-Value': value } }] }).map((issue) => issue.code)

// how: Asks Node itself whether it would send a value, the way setHeader does on a response.
const nodeSends = (value: string): boolean => {
  try {
    validateHeaderValue('X-Value', value)
    return true
  } catch {
    return false
  }
}

// note: Every code unit up to U+02FF, and one of each kind beyond: a wide letter, a surrogate half, the byte order mark and the last code unit.
const CODE_UNITS: readonly number[] = [...Array.from({ length: 0x300 }, (_, unit) => unit), 0x4e2d, 0xd83d, 0xfeff, 0xffff]

describe('a header value Node refuses to send', () => {
  it('is refused for exactly the characters Node refuses', () => {
    const disagreements = CODE_UNITS.filter(
      (unit) => nodeSends(`a${String.fromCharCode(unit)}b`) !== (codesFor(`a${String.fromCharCode(unit)}b`).length === 0)
    )
    expect(disagreements).toEqual([])
  })

  it.each([
    ['a vertical tab', 'a\u000bb'],
    ['a form feed', 'a\u000cb'],
    ['an escape', 'a\u001bb'],
    ['a delete', 'a\u007fb'],
    ['a backspace', 'a\u0008b'],
  ])('reports %s as a control character', (_label: string, value: string) => {
    expect(checkServeConfig({ headers: [{ headers: { 'X-Value': value } }] })).toEqual([
      {
        code: 'header-value-control-character',
        path: 'headers[0].headers["X-Value"]',
        message: `headers[0].headers["X-Value"] ${CONTROL}`,
      },
    ])
  })

  it.each([
    ['a letter above U+00FF', 'caf\u0113'],
    ['a typographic quote', 'max-age=0; note=\u201cdraft\u201d'],
    ['an emoji', 'ok \ud83d\ude00'],
    ['a byte order mark', '\ufeffno-cache'],
  ])('reports %s under a code of its own', (_label: string, value: string) => {
    expect(checkServeConfig({ headers: [{ headers: { 'X-Value': value } }] })).toEqual([
      { code: 'header-value-not-latin1', path: 'headers[0].headers["X-Value"]', message: `headers[0].headers["X-Value"] ${WIDE}` },
    ])
  })

  it.each([
    ['a tab', 'a\tb'],
    ['a Latin-1 letter', 'caf\u00e9'],
    ['a no-break space', 'a\u00a0b'],
    ['the empty value', ''],
  ])('accepts %s', (_label: string, value: string) => {
    expect(codesFor(value)).toEqual([])
  })

  it('reports a value holding both kinds once, as a control character', () => {
    expect(codesFor('\u000b\u4e2d')).toEqual(['header-value-control-character'])
  })

  it('reports a value with a line break once, as it always was', () => {
    expect(codesFor('a\nb\u4e2d')).toEqual(['header-value-control-character'])
  })

  it('reports nothing more for a header whose name is refused', () => {
    expect(checkServeConfig({ headers: [{ headers: { 'X Bad': 'a\u4e2d' } }] }).map((issue) => issue.code)).toEqual(['header-name-invalid'])
  })

  it('reports it after every problem a rule has always been refused for', () => {
    expect(
      checkServeConfig({ headers: [{ headers: { 'X-Wide': '\u4e2d', 'X-Number': 5 } }, { prefix: 5, headers: {} }] }).map(
        (issue) => `${issue.code} at ${issue.path}`
      )
    ).toEqual([
      'header-value-not-string at headers[0].headers["X-Number"]',
      'rule-prefix-invalid at headers[1].prefix',
      'header-value-not-latin1 at headers[0].headers["X-Wide"]',
    ])
  })

  it('reports it ahead of the embedders', () => {
    expect(checkServeConfig({ embedders: ['*'], headers: [{ headers: { 'X-Wide': '\u4e2d' } }] }).map((issue) => issue.code)).toEqual([
      'header-value-not-latin1',
      'embedder-permits-every-origin',
    ])
  })

  it('keeps the rules from being judged against the embedders', () => {
    expect(
      checkServeConfig({ embedders: ["'self'"], headers: [{ headers: { 'Content-Security-Policy': "default-src 'self' \u4e2d" } }] }).map(
        (issue) => issue.code
      )
    ).toEqual(['header-value-not-latin1'])
  })

  it('is refused by the config validator with the source path', () => {
    expect(() => validateServeConfig({ headers: [{ headers: { 'X-Value': 'a\u4e2d' } }] }, '/p/c.json')).toThrow(
      `/p/c.json: headers[0].headers["X-Value"] ${WIDE}`
    )
  })

  it('is refused by the rule validator', () => {
    expect(() => validateHeaderRule({ headers: { 'X-Value': 'a\u000bb' } }, 2, '/p/c.json')).toThrow(
      `/p/c.json: headers[2].headers["X-Value"] ${CONTROL}`
    )
  })

  it('is reported by the rule validator after the problems a rule has always had and ahead of its unknown fields', () => {
    const thrown = (): string => {
      try {
        validateHeaderRule({ prefx: '/a', headers: { 'X-Wide': '\u4e2d', 'X-Number': 5 } }, 0, '/p')
        return ''
      } catch (error) {
        return (error as Error).message
      }
    }
    expect(thrown().split(/\r?\n/)).toEqual([
      '/p: headers[0].headers["X-Number"] must be a string.',
      `/p: headers[0].headers["X-Wide"] ${WIDE}`,
      '/p: headers[0] has an unknown field "prefx": a rule takes prefix, suffix and headers.',
    ])
  })

  it('is refused by the expansion', () => {
    expect(() => expandHeaderPolicy({ headers: [{ headers: { 'X-Value': 'a\u4e2d' } }] })).toThrow(`headers[0].headers["X-Value"] ${WIDE}`)
  })
})

describe('a header name echoed in a problem', () => {
  it('is written as a quoted string, so a line break in it cannot start a second line', () => {
    expect(
      checkServeConfig({ headers: [{ headers: { 'a\n/etc/other.json: "root" must be a non-empty string.': 'on' } }] }).map(
        (issue) => issue.message
      )
    ).toEqual(['headers[0].headers["a\\n/etc/other.json: \\"root\\" must be a non-empty string."] is not a valid header name.'])
  })

  it('reads as it always did for a name that needs no escaping', () => {
    expect(checkServeConfig({ headers: [{ headers: { 'X Bad Name': 'on' } }] }).map((issue) => issue.message)).toEqual([
      'headers[0].headers["X Bad Name"] is not a valid header name.',
    ])
  })

  it('keeps a refused config on one line per problem', () => {
    const thrown = (): string => {
      try {
        validateServeConfig({ headers: [{ headers: { 'a\nb': 'on' } }] }, '/p/c.json')
        return ''
      } catch (error) {
        return (error as Error).message
      }
    }
    expect(thrown().split(/\r?\n/)).toEqual(['/p/c.json: headers[0].headers["a\\nb"] is not a valid header name.'])
  })
})
