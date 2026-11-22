import { describe, expect, it } from '@hyperfrontend/testing'
import { checkEmbedders, embedders, frameAncestors } from './embedders'

const SEPARATOR = 'must not contain ";" or ",": either would end the directive or start a second policy.'

const UNQUOTED = "is a keyword and must carry its single quotes: 'self' or 'none'."

const EVERY_ORIGIN = 'permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.'

describe('checkEmbedders', () => {
  it.each([
    [[]],
    [["'none'"]],
    [["'self'"]],
    [["'self'", 'https://host.example']],
    [['https://*.host.example']],
    [['https://host.example:8443']],
    [['https://host.example:65535']],
    [['http://localhost:*']],
    [['http://127.0.0.1:5173']],
    [['tauri://localhost']],
    [['https://xn--bcher-kva.example']],
  ])('accepts %j', (sources: string[]) => {
    expect(checkEmbedders(sources)).toEqual([])
  })

  it('reports a value that is no array', () => {
    expect(checkEmbedders('https://host.example')).toEqual([
      { code: 'embedders-not-array', path: 'embedders', message: '"embedders" must be an array of sources.' },
    ])
  })

  it.each([
    [5, 'embedder-not-string', 'must be a string.'],
    ['', 'embedder-empty', 'must not be empty.'],
    ['https://host.example\n', 'embedder-control-character', 'must not contain control characters.'],
    ['https://host.example\u007f', 'embedder-control-character', 'must not contain control characters.'],
    ['https://host.example; script-src *', 'embedder-separator', SEPARATOR],
    ['https://a.example,https://b.example', 'embedder-separator', SEPARATOR],
    ['https://a.example https://b.example', 'embedder-whitespace', 'must be a single source: list each source as its own entry.'],
    ['https://bücher.example', 'embedder-not-ascii', 'must be ASCII: write an internationalised host in its punycode ("xn--") form.'],
    ['https://Host.Example', 'embedder-not-lowercase', 'must be lowercase.'],
    ["'SELF'", 'embedder-not-lowercase', 'must be lowercase.'],
    ['self', 'embedder-keyword-unquoted', UNQUOTED],
    ['none', 'embedder-keyword-unquoted', UNQUOTED],
    ['"self"', 'embedder-keyword-unquoted', UNQUOTED],
    ['"none"', 'embedder-keyword-unquoted', UNQUOTED],
    ["'unsafe-inline'", 'embedder-keyword-unknown', "is not a frame-ancestors keyword: only 'self' and 'none' are."],
    ['https://"host".example', 'embedder-keyword-unknown', "is not a frame-ancestors keyword: only 'self' and 'none' are."],
    ['*', 'embedder-permits-every-origin', EVERY_ORIGIN],
    ['https:', 'embedder-permits-every-origin', EVERY_ORIGIN],
    ['https://*', 'embedder-permits-every-origin', EVERY_ORIGIN],
    ['host.example', 'embedder-scheme-missing', 'must start with a scheme and "://", as in https://host.example.'],
    [
      'https://host.example/',
      'embedder-has-path',
      'must end at the host or port: remove the path, query or fragment, a trailing "/" included.',
    ],
    ['https://host.example:0', 'embedder-port-invalid', 'has a port that is neither "*" nor an integer between 1 and 65535.'],
    [
      'https://*.app',
      'embedder-wildcard-too-broad',
      'puts "*." over a single label: a wildcard needs at least two labels after it, as in https://*.host.example.',
    ],
    [
      'https://under_score.example',
      'embedder-malformed',
      'is not a source: expected scheme://host with an optional leading "*." label and an optional port.',
    ],
  ])('reports %p as %s', (entry: unknown, code: string, text: string) => {
    expect(checkEmbedders([entry])).toEqual([{ code, path: 'embedders[0]', message: `embedders[0] ${text}` }])
  })

  it("reports 'none' beside another entry", () => {
    expect(checkEmbedders(["'self'", "'none'"])).toEqual([
      { code: 'embedder-none-not-alone', path: 'embedders[1]', message: "embedders[1] is 'none', which must be the only entry." },
    ])
  })

  it('reports every problem of a list at once', () => {
    expect(checkEmbedders(['*', "'self'", 'self', 'https://host.example/app']).map((issue) => `${issue.path}: ${issue.code}`)).toEqual([
      'embedders[0]: embedder-permits-every-origin',
      'embedders[2]: embedder-keyword-unquoted',
      'embedders[3]: embedder-has-path',
    ])
  })

  it('never repeats an entry in a message', () => {
    const secret = 'https://internal.example/a path; script-src *'
    expect(checkEmbedders([secret, `${secret}\n`, 'internal.example']).filter((issue) => issue.message.includes('internal'))).toEqual([])
  })
})

describe('frameAncestors', () => {
  it('joins sources in the order written', () => {
    expect(frameAncestors(['https://b.example', "'self'", 'https://a.example', 'https://b.example'])).toBe(
      "frame-ancestors https://b.example 'self' https://a.example https://b.example"
    )
  })

  it('writes none for an empty list', () => {
    expect(frameAncestors([])).toBe("frame-ancestors 'none'")
  })

  it('throws the problems of a refused list, one per line', () => {
    expect(() => frameAncestors(['*', 'self'])).toThrow(
      'embedders[0] permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.\n' +
        "embedders[1] is a keyword and must carry its single quotes: 'self' or 'none'."
    )
  })
})

describe('embedders', () => {
  it.each([[[]], [["'none'"]]])('adds DENY for %j', (sources: string[]) => {
    expect(embedders(sources)).toEqual({ headers: { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' } })
  })

  it('adds SAMEORIGIN for self alone', () => {
    expect(embedders(["'self'"])).toEqual({
      headers: { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' },
    })
  })

  it('adds no frame options for a list of hosts', () => {
    expect(embedders(['https://host.example:8443', 'http://localhost:*'])).toEqual({
      headers: { 'Content-Security-Policy': 'frame-ancestors https://host.example:8443 http://localhost:*' },
    })
  })

  it('adds no frame options for self beside a host', () => {
    expect(embedders(["'self'", 'https://host.example'])).toEqual({
      headers: { 'Content-Security-Policy': "frame-ancestors 'self' https://host.example" },
    })
  })

  it('writes the policy ahead of the frame options', () => {
    expect(Object.keys(embedders([]).headers)).toEqual(['Content-Security-Policy', 'X-Frame-Options'])
  })

  it('bounds the rule by the scope', () => {
    expect(embedders(["'none'"], { prefix: '/host', suffix: '.html' })).toEqual({
      prefix: '/host',
      suffix: '.html',
      headers: { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' },
    })
  })

  it('leaves an absent bound out of the rule', () => {
    expect(Object.keys(embedders(["'self'"], { suffix: '.html' }))).toEqual(['suffix', 'headers'])
  })

  it('refuses a scope whose prefix is no string', () => {
    expect(() => embedders(["'self'"], { prefix: 5 as unknown as string })).toThrow('scope.prefix must be a string.')
  })

  it('refuses a scope whose suffix is no string', () => {
    expect(() => embedders(["'self'"], { suffix: 5 as unknown as string })).toThrow('scope.suffix must be a string.')
  })

  it('throws the problems of the sources and of the scope together', () => {
    expect(() => embedders(['self'], { prefix: 5 as unknown as string, suffix: 6 as unknown as string })).toThrow(
      "embedders[0] is a keyword and must carry its single quotes: 'self' or 'none'.\nscope.prefix must be a string.\nscope.suffix must be a string."
    )
  })
})
