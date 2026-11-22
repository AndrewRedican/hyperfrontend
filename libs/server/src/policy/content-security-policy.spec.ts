import { describe, expect, it } from '@hyperfrontend/testing'
import { contentSecurityPolicy, frameAncestorsOf } from './content-security-policy'

describe('contentSecurityPolicy', () => {
  it('writes the default directives ahead of the declared embedders', () => {
    expect(contentSecurityPolicy({ embedders: ["'self'", 'https://host.example'] })).toEqual({
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://host.example",
      },
    })
  })

  it('keeps the position of a default an authored directive overrides', () => {
    expect(
      contentSecurityPolicy({ embedders: ['https://host.example'], directives: { 'object-src': ["'self'"], 'default-src': ["'none'"] } })
        .headers['Content-Security-Policy']
    ).toBe("default-src 'none'; script-src 'self'; object-src 'self'; base-uri 'self'; frame-ancestors https://host.example")
  })

  it('places a new directive after the defaults and ahead of frame-ancestors', () => {
    expect(
      contentSecurityPolicy({ embedders: ['https://host.example'], directives: { 'img-src': ["'self'", 'data:'], 'font-src': ["'self'"] } })
        .headers['Content-Security-Policy']
    ).toBe(
      "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors https://host.example"
    )
  })

  it('writes the bare name for an empty list', () => {
    expect(
      contentSecurityPolicy({ embedders: ['https://host.example'], directives: { 'upgrade-insecure-requests': [] } }).headers[
        'Content-Security-Policy'
      ]
    ).toBe(
      "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests; frame-ancestors https://host.example"
    )
  })

  it('adds DENY and the scope for an empty embedders list', () => {
    expect(
      contentSecurityPolicy(
        {
          embedders: [],
          directives: { 'script-src': ["'self'", "'wasm-unsafe-eval'"], 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': [] },
        },
        { suffix: '.html' }
      )
    ).toEqual({
      suffix: '.html',
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'; img-src 'self' data:; upgrade-insecure-requests; frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
      },
    })
  })

  it('adds SAMEORIGIN for self alone', () => {
    expect(contentSecurityPolicy({ embedders: ["'self'"] }).headers['X-Frame-Options']).toBe('SAMEORIGIN')
  })

  it('adds no frame options for a list of hosts', () => {
    expect(Object.keys(contentSecurityPolicy({ embedders: ['https://host.example'] }).headers)).toEqual(['Content-Security-Policy'])
  })

  it('throws the four directive problems at once, after those of the embedders', () => {
    expect(() =>
      contentSecurityPolicy({
        embedders: ['*'],
        directives: {
          'Script-Src': ["'self'"],
          'frame-ancestors': ['*'],
          'font-src': 'x' as unknown as string[],
          'img-src': ["'self'", 'a b', 'x;y', 'x,y', 5 as unknown as string, ''],
        },
      })
    ).toThrow(
      [
        'embedders[0] permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.',
        'directives["Script-Src"] is not a directive name: use lowercase letters, digits and hyphens.',
        'directives["frame-ancestors"] is set through "embedders", not here.',
        'directives["font-src"] must be an array of values.',
        'directives["img-src"][1] must be one value of visible ASCII with no whitespace, ";" or ",".',
        'directives["img-src"][2] must be one value of visible ASCII with no whitespace, ";" or ",".',
        'directives["img-src"][3] must be one value of visible ASCII with no whitespace, ";" or ",".',
        'directives["img-src"][4] must be one value of visible ASCII with no whitespace, ";" or ",".',
        'directives["img-src"][5] must be one value of visible ASCII with no whitespace, ";" or ",".',
      ].join('\n')
    )
  })

  it('refuses options that declare no embedders', () => {
    expect(() => contentSecurityPolicy({} as unknown as { embedders: string[] })).toThrow('"embedders" must be an array of sources.')
  })

  it('refuses a scope whose prefix is no string', () => {
    expect(() => contentSecurityPolicy({ embedders: [] }, { prefix: 5 as unknown as string })).toThrow('scope.prefix must be a string.')
  })
})

describe('frameAncestorsOf', () => {
  it('reads the sources of the directive among others', () => {
    expect(frameAncestorsOf("default-src 'self'; frame-ancestors 'self' https://a.example")).toEqual([["'self'", 'https://a.example']])
  })

  it('reads a directive name written in another case', () => {
    expect(frameAncestorsOf('FRAME-ANCESTORS *')).toEqual([['*']])
  })

  it('keeps the first of a duplicated directive', () => {
    expect(frameAncestorsOf("frame-ancestors 'self'; frame-ancestors *")).toEqual([["'self'"]])
  })

  it('reads one list per comma-separated policy', () => {
    expect(frameAncestorsOf("frame-ancestors 'none', frame-ancestors *")).toEqual([["'none'"], ['*']])
  })

  it('skips a comma-separated policy that names no such directive', () => {
    expect(frameAncestorsOf("default-src 'self', frame-ancestors 'self'")).toEqual([["'self'"]])
  })

  it('reads no list from a policy without the directive', () => {
    expect(frameAncestorsOf("default-src 'self'")).toEqual([])
  })

  it('reads no list from an empty value', () => {
    expect(frameAncestorsOf('')).toEqual([])
  })

  it('reads an empty list from a directive without sources', () => {
    expect(frameAncestorsOf('frame-ancestors')).toEqual([[]])
  })

  it('splits the sources on any run of whitespace', () => {
    expect(frameAncestorsOf("  frame-ancestors\t'self'   https://a.example ;")).toEqual([["'self'", 'https://a.example']])
  })

  it.each([
    ['a no-break space after its sources', "frame-ancestors 'self'\u00a0"],
    ['a no-break space ahead of its name', "default-src 'self';\u00a0frame-ancestors 'self'"],
    ['a host outside ASCII', "frame-ancestors 'self' https://b\u00fccher.example"],
    ['a vertical tab ahead of its name', "default-src 'self';\u000bframe-ancestors 'self'"],
    ['a byte order mark ahead of its name', "\ufeffframe-ancestors 'self'"],
    ['a control character among its sources', "frame-ancestors 'self'\u0001"],
  ])('reads no list from a directive holding %s, which a browser discards', (_label: string, policy: string) => {
    expect(frameAncestorsOf(policy)).toEqual([])
  })

  it('reads the later directive when a browser discards the first of the same name', () => {
    expect(frameAncestorsOf("frame-ancestors 'self'\u00a0; frame-ancestors *")).toEqual([['*']])
  })

  it('keeps reading a policy whose other directive a browser discards', () => {
    expect(frameAncestorsOf("img-src https://b\u00fccher.example; frame-ancestors 'self'")).toEqual([["'self'"]])
  })

  it('reads a directive bounded by every kind of ASCII whitespace', () => {
    expect(frameAncestorsOf("\t\n\f\r frame-ancestors\f'self'\r\n")).toEqual([["'self'"]])
  })
})
