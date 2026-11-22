import type { HeaderPolicy, ServeHeaderRule } from './serve-types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { applyErrorHeaderRules, applyFailureHeaderRules, applyHeaderRules, expandHeaderPolicy } from './expand'

const DROPPED =
  'replaces the policy "embedders" declares and has no frame-ancestors directive, so the paths it matches could be framed by any origin: add the directive to that value or remove "embedders".'

const CONTRADICTED =
  'applies to every path with a frame-ancestors list other than the one "embedders" declares: make the two equal, bound the rule with a prefix or suffix, or remove "embedders".'

describe('expandHeaderPolicy', () => {
  it('places embedders, the permissions policy, isolation and the authored rules in that order', () => {
    expect(
      expandHeaderPolicy({
        headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }],
        isolation: 'credentialless',
        permissionsPolicy: { camera: [] },
        embedders: ["'self'"],
      })
    ).toEqual([
      { headers: { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' } },
      { headers: { 'Permissions-Policy': 'camera=()' } },
      {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      },
      { suffix: '.html', headers: { 'Cache-Control': 'no-cache' } },
    ])
  })

  it('expands nothing for an empty policy', () => {
    expect(expandHeaderPolicy({})).toEqual([])
  })

  it('returns the authored rules alone when no field is declared', () => {
    const headers = [{ prefix: '/a', headers: { 'X-Test': 'on' } }]
    expect(expandHeaderPolicy({ headers })).toEqual(headers)
  })

  it('expands no rule for an empty permissions policy', () => {
    expect(expandHeaderPolicy({ permissionsPolicy: {} })).toEqual([])
  })

  it('expands an empty embedders list into a rule that denies framing', () => {
    expect(expandHeaderPolicy({ embedders: [] })).toEqual([
      { headers: { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' } },
    ])
  })

  it('throws the problems of both fields, one per line', () => {
    expect(() => expandHeaderPolicy({ embedders: ['self'], permissionsPolicy: { Camera: [] } })).toThrow(
      "embedders[0] is a keyword and must carry its single quotes: 'self' or 'none'.\n" +
        'permissionsPolicy["Camera"] is not a feature name: use lowercase letters, digits and hyphens, starting with a letter.'
    )
  })

  it('refuses a bounded rule whose policy drops frame-ancestors', () => {
    expect(() =>
      expandHeaderPolicy({
        embedders: ["'self'"],
        headers: [{ suffix: '.html', headers: { 'Content-Security-Policy': "default-src 'self'" } }],
      })
    ).toThrow(`headers[0].headers["Content-Security-Policy"] ${DROPPED}`)
  })

  it('refuses an unbounded rule whose policy drops frame-ancestors, whatever the case of its name', () => {
    expect(() =>
      expandHeaderPolicy({
        embedders: ["'self'"],
        headers: [{ headers: { 'X-Test': 'on' } }, { headers: { 'content-security-policy': "default-src 'self'" } }],
      })
    ).toThrow(`headers[1].headers["content-security-policy"] ${DROPPED}`)
  })

  it('refuses an unbounded rule whose list differs from the declared one', () => {
    expect(() =>
      expandHeaderPolicy({
        embedders: ["'self'"],
        headers: [{ headers: { 'Content-Security-Policy': "frame-ancestors 'self' https://b.example" } }],
      })
    ).toThrow(`headers[0].headers["Content-Security-Policy"] ${CONTRADICTED}`)
  })

  it('refuses an unbounded rule that lists the declared sources in another order', () => {
    expect(() =>
      expandHeaderPolicy({
        embedders: ["'self'", 'https://b.example'],
        headers: [{ headers: { 'Content-Security-Policy': "frame-ancestors https://b.example 'self'" } }],
      })
    ).toThrow(CONTRADICTED)
  })

  it('refuses an unbounded rule one of whose policies lists other sources', () => {
    expect(() =>
      expandHeaderPolicy({
        embedders: ["'self'"],
        headers: [{ headers: { 'Content-Security-Policy': "frame-ancestors 'self', frame-ancestors 'none'" } }],
      })
    ).toThrow(CONTRADICTED)
  })

  it('accepts a bounded rule with a list of its own', () => {
    const headers = [{ prefix: '/host', headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } }]
    expect(expandHeaderPolicy({ embedders: ['https://host.example'], headers })).toEqual([
      { headers: { 'Content-Security-Policy': 'frame-ancestors https://host.example' } },
      ...headers,
    ])
  })

  it('accepts a rule bounded by a suffix with a list of its own', () => {
    const headers = [{ suffix: '.html', headers: { 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'" } }]
    expect(expandHeaderPolicy({ embedders: ['https://host.example'], headers })).toHaveLength(2)
  })

  it('accepts an unbounded rule that restates the declared list inside a fuller policy', () => {
    const headers = [{ headers: { 'Content-Security-Policy': "default-src 'self'; Frame-Ancestors 'self' https://b.example" } }]
    expect(expandHeaderPolicy({ embedders: ["'self'", 'https://b.example'], headers })).toHaveLength(2)
  })

  it('accepts an unbounded rule that restates an empty list as none', () => {
    const headers = [{ headers: { 'Content-Security-Policy': "default-src 'self', frame-ancestors 'none'" } }]
    expect(expandHeaderPolicy({ embedders: [], headers })).toHaveLength(2)
  })

  it('ignores the report-only header', () => {
    const headers = [{ headers: { 'Content-Security-Policy-Report-Only': "default-src 'self'" } }]
    expect(expandHeaderPolicy({ embedders: ["'self'"], headers })).toHaveLength(2)
  })

  it('leaves a policy without frame-ancestors alone when no embedders are declared', () => {
    const headers = [{ headers: { 'Content-Security-Policy': "default-src 'self'" } }]
    expect(expandHeaderPolicy({ permissionsPolicy: { camera: [] }, headers })).toHaveLength(2)
  })

  it('reports every rule at odds with the declared embedders at once', () => {
    const policy: HeaderPolicy = {
      embedders: ["'self'"],
      headers: [
        { headers: { 'Content-Security-Policy': 'frame-ancestors *' } },
        { suffix: '.html', headers: { 'Content-Security-Policy': "default-src 'self'" } },
      ],
    }
    expect(() => expandHeaderPolicy(policy)).toThrow(
      `headers[0].headers["Content-Security-Policy"] ${CONTRADICTED}\nheaders[1].headers["Content-Security-Policy"] ${DROPPED}`
    )
  })
})

describe('expandHeaderPolicy over a policy no validator saw', () => {
  const refusal = (policy: unknown): string => {
    try {
      return `accepted as ${JSON.stringify(expandHeaderPolicy(policy as HeaderPolicy))}`
    } catch (error) {
      return String(error)
    }
  }

  it.each([[null], [undefined], [5], ['policy'], [[]]])('refuses %p, which is no object', (policy: unknown) => {
    expect(refusal(policy)).toBe('Error: header policy must be an object.')
  })

  it.each([
    ['a rule that is no object', { headers: [null] }, 'headers[0] must be an object.'],
    ['a rule without a headers record', { headers: [{}] }, 'headers[0].headers must be an object.'],
    ['rules that are no array', { headers: 'abc' }, '"headers" must be an array.'],
    [
      'a policy header that is no string beside declared embedders',
      { embedders: ["'self'"], headers: [{ headers: { 'Content-Security-Policy': 5 } }] },
      'headers[0].headers["Content-Security-Policy"] must be a string.',
    ],
    [
      'an isolation that would carry a second header',
      { isolation: 'x\r\nSet-Cookie: a=b' },
      '"isolation" must be one of require-corp, credentialless.',
    ],
    ['an isolation of null', { isolation: null }, '"isolation" must be one of require-corp, credentialless.'],
    [
      'a rule with a field no rule takes',
      { headers: [{ prefx: '/a/', headers: { 'X-Test': 'on' } }] },
      'headers[0] has an unknown field "prefx": a rule takes prefix, suffix and headers.',
    ],
  ])('refuses %s with the sentence a config validator gives', (_label: string, policy: unknown, message: string) => {
    expect(refusal(policy)).toBe(`Error: ${message}`)
  })

  it('reports the problems of every policy field at once, in the order a config validator gives them', () => {
    expect(
      refusal({
        headers: [{ suffix: 5, extra: true, headers: {} }],
        permissionsPolicy: { Camera: [] },
        embedders: ['self'],
        isolation: 'none',
      })
    ).toBe(
      [
        'Error: "isolation" must be one of require-corp, credentialless.',
        'headers[0].suffix must be a string.',
        "embedders[0] is a keyword and must carry its single quotes: 'self' or 'none'.",
        'permissionsPolicy["Camera"] is not a feature name: use lowercase letters, digits and hyphens, starting with a letter.',
        'headers[0] has an unknown field "extra": a rule takes prefix, suffix and headers.',
      ].join('\n')
    )
  })

  it('leaves the fields of a serve config that are no policy field unjudged', () => {
    expect(refusal({ root: 5, port: 0, stray: true, embedders: [] })).toBe(
      'accepted as [{"headers":{"Content-Security-Policy":"frame-ancestors \'none\'","X-Frame-Options":"DENY"}}]'
    )
  })
})

describe('applyHeaderRules', () => {
  const lines = (rules: readonly ServeHeaderRule[], path: string, headers?: Record<string, string>): string[] =>
    Object.entries(applyHeaderRules(rules, path, headers)).map(([name, value]) => `${name}: ${value}`)

  it('returns no header when there are no rules', () => {
    expect(applyHeaderRules([], '/index.html')).toEqual({})
  })

  it('applies a rule without bounds to every path', () => {
    expect(lines([{ headers: { 'X-Rule': 'all' } }], '/anything')).toEqual(['X-Rule: all'])
  })

  it.each([
    ['/sub/notes.txt', ['X-Rule: prefix']],
    ['/notes.txt', []],
  ])('matches a prefix against %s', (path: string, expected: string[]) => {
    expect(lines([{ prefix: '/sub/', headers: { 'X-Rule': 'prefix' } }], path)).toEqual(expected)
  })

  it.each([
    ['/index.html', ['X-Rule: suffix']],
    ['/index.htm', []],
  ])('matches a suffix against %s', (path: string, expected: string[]) => {
    expect(lines([{ suffix: '.html', headers: { 'X-Rule': 'suffix' } }], path)).toEqual(expected)
  })

  it.each([
    ['/sub/index.html', ['X-Rule: both']],
    ['/sub/notes.txt', []],
    ['/index.html', []],
  ])('matches both bounds against %s', (path: string, expected: string[]) => {
    expect(lines([{ prefix: '/sub/', suffix: '.html', headers: { 'X-Rule': 'both' } }], path)).toEqual(expected)
  })

  it('lets a later rule override an earlier one per header, in the place the header first took', () => {
    expect(lines([{ headers: { 'X-A': 'first', 'X-B': 'kept' } }, { headers: { 'X-C': 'new', 'X-A': 'second' } }], '/index.html')).toEqual([
      'X-A: second',
      'X-B: kept',
      'X-C: new',
    ])
  })

  it('replaces a header respelled in another case instead of sending both', () => {
    expect(lines([{ headers: { 'Cache-Control': 'no-cache' } }, { headers: { 'cache-control': 'no-store' } }], '/index.html')).toEqual([
      'cache-control: no-store',
    ])
  })

  it.each([['Content-Length'], ['content-encoding'], ['ETag'], ['Transfer-Encoding'], ['transfer-encoding'], ['Trailer'], ['TRAILER']])(
    'never lets a rule set %s',
    (name: string) => {
      expect(applyHeaderRules([{ headers: { [name]: 'forged', 'X-Rule': 'on' } }], '/index.html')).toEqual({ 'X-Rule': 'on' })
    }
  )

  it.each([['Connection'], ['connection'], ['Keep-Alive'], ['keep-alive'], ['Upgrade'], ['UPGRADE'], ['TE'], ['te']])(
    'never lets a rule set %s, which belongs to the connection',
    (name: string) => {
      expect(applyHeaderRules([{ headers: { [name]: 'close', 'X-Rule': 'on' } }], '/index.html')).toEqual({ 'X-Rule': 'on' })
    }
  )

  it.each([['Connection'], ['Keep-Alive'], ['Upgrade'], ['TE']])('leaves the %s a response already carried as it was', (name: string) => {
    expect(applyHeaderRules([{ headers: { [name]: 'close' } }], '/index.html', { [name]: 'kept' })).toEqual({ [name]: 'kept' })
  })

  it('folds the rules over the headers it is given', () => {
    expect(
      lines([{ headers: { 'content-type': 'application/json', 'X-Rule': 'on' } }], '/data', {
        'Content-Type': 'text/plain',
        ETag: 'W/"5-1000"',
      })
    ).toEqual(['ETag: W/"5-1000"', 'content-type: application/json', 'X-Rule: on'])
  })

  it('leaves the headers it is given untouched', () => {
    const given = { 'Content-Type': 'text/plain' }
    applyHeaderRules([{ headers: { 'Content-Type': 'application/json' } }], '/data', given)
    expect(given).toEqual({ 'Content-Type': 'text/plain' })
  })
})

describe('applyFailureHeaderRules', () => {
  // note: A year, the lifetime an asset rule writes for a file whose name carries a hash of its bytes.
  const YEAR = 'max-age=31536000'
  const OWN = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  const lines = (rules: readonly ServeHeaderRule[], path: string, headers: Record<string, string> = OWN): string[] =>
    Object.entries(applyFailureHeaderRules(rules, path, headers)).map(([name, value]) => `${name}: ${value}`)

  it('keeps the failure unstored whatever a matching rule wrote for the path', () => {
    expect(lines([{ headers: { 'Cache-Control': `public, ${YEAR}, immutable` } }], '/assets/app.js')).toEqual([
      'Content-Type: text/plain; charset=utf-8',
      'Cache-Control: no-store',
    ])
  })

  it('marks a failure that named no cache header as never stored', () => {
    expect(lines([], '/app.js', { 'Content-Type': 'text/plain; charset=utf-8' })).toEqual([
      'Content-Type: text/plain; charset=utf-8',
      'Cache-Control: no-store',
    ])
  })

  it('writes the mark under one spelling when the failure carried another', () => {
    expect(lines([], '/app.js', { 'cache-control': 'no-store' })).toEqual(['Cache-Control: no-store'])
  })

  it.each([
    ['Expires'],
    ['expires'],
    ['Surrogate-Control'],
    ['X-Accel-Expires'],
    ['CDN-Cache-Control'],
    ['cdn-cache-control'],
    ['Cloudflare-CDN-Cache-Control'],
  ])('takes no %s from a matching rule', (name: string) => {
    expect(lines([{ headers: { [name]: YEAR, 'X-Frame-Options': 'DENY' } }], '/app.js')).toEqual([
      'Content-Type: text/plain; charset=utf-8',
      'Cache-Control: no-store',
      'X-Frame-Options: DENY',
    ])
  })

  it.each([['Clear-Site-Data'], ['Cache-Status'], ['X-Cache-Control-Policy'], ['Vary'], ['Content-Security-Policy']])(
    'takes a %s header, which sets no lifetime',
    (name: string) => {
      expect(applyFailureHeaderRules([{ headers: { [name]: 'kept' } }], '/app.js', OWN)[name]).toBe('kept')
    }
  )

  it('leaves a lifetime the failure itself carried, since no rule wrote it', () => {
    expect(lines([{ headers: { 'CDN-Cache-Control': YEAR } }], '/app.js', { ...OWN, 'CDN-Cache-Control': 'max-age=5' })).toEqual([
      'Content-Type: text/plain; charset=utf-8',
      'Cache-Control: no-store',
      'CDN-Cache-Control: max-age=5',
    ])
  })

  it.each([
    ['Content-Length'],
    ['content-encoding'],
    ['ETag'],
    ['Transfer-Encoding'],
    ['Trailer'],
    ['Connection'],
    ['keep-alive'],
    ['Upgrade'],
    ['TE'],
  ])('never lets a rule set %s on a failure either', (name: string) => {
    expect(lines([{ headers: { [name]: 'forged' } }], '/app.js', {})).toEqual(['Cache-Control: no-store'])
  })

  it('reads no header of a rule that does not match the path', () => {
    expect(lines([{ prefix: '/assets/', headers: { 'X-Frame-Options': 'DENY' } }], '/index.html')).toEqual([
      'Content-Type: text/plain; charset=utf-8',
      'Cache-Control: no-store',
    ])
  })

  it('lets a later rule override an earlier one per header, as on any response', () => {
    const rules = [{ headers: { 'X-Frame-Options': 'DENY' } }, { suffix: '.js', headers: { 'X-Frame-Options': 'SAMEORIGIN' } }]
    expect(applyFailureHeaderRules(rules, '/app.js', OWN)['X-Frame-Options']).toBe('SAMEORIGIN')
  })

  it('leaves the headers it is given untouched', () => {
    const given = { 'cache-control': 'no-store' }
    applyFailureHeaderRules([{ headers: { 'X-Frame-Options': 'DENY' } }], '/app.js', given)
    expect(given).toEqual({ 'cache-control': 'no-store' })
  })
})

describe('applyErrorHeaderRules', () => {
  // note: A year, the lifetime an asset rule writes for a file whose name carries a hash of its bytes.
  const YEAR = 'max-age=31536000'
  const OWN = { 'Content-Type': 'text/plain; charset=utf-8' }

  it.each([
    ['Cache-Control'],
    ['cache-control'],
    ['Expires'],
    ['Surrogate-Control'],
    ['X-Accel-Expires'],
    ['CDN-Cache-Control'],
    ['Cloudflare-CDN-Cache-Control'],
  ])('answers no-store in place of the %s of a matching rule', (name: string) => {
    expect(applyErrorHeaderRules([{ headers: { [name]: YEAR, 'X-Frame-Options': 'DENY' } }], '/assets/app.js', OWN)).toEqual({
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store',
    })
  })

  it.each([['no-store'], ['private, no-cache'], ['no-cache']])('answers no-store under a rule that says %s', (value: string) => {
    expect(applyErrorHeaderRules([{ headers: { 'Cache-Control': value } }], '/app.js', OWN)).toEqual({
      ...OWN,
      'Cache-Control': 'no-store',
    })
  })

  it('writes no-store in the place the header first took', () => {
    const rules = [{ headers: { 'Cache-Control': YEAR, 'X-Frame-Options': 'DENY' } }]
    expect(Object.keys(applyErrorHeaderRules(rules, '/app.js', OWN))).toEqual(['Content-Type', 'Cache-Control', 'X-Frame-Options'])
  })

  it('adds no cache header of its own', () => {
    expect(applyErrorHeaderRules([], '/app.js', OWN)).toEqual(OWN)
  })

  it('adds no cache header under rules that name none', () => {
    expect(applyErrorHeaderRules([{ headers: { 'X-Frame-Options': 'DENY' } }], '/app.js', OWN)).toEqual({
      ...OWN,
      'X-Frame-Options': 'DENY',
    })
  })

  it('adds no cache header when the rule that names one does not match the path', () => {
    expect(applyErrorHeaderRules([{ prefix: '/assets/', headers: { 'Cache-Control': YEAR } }], '/index.html', OWN)).toEqual(OWN)
  })

  it('replaces a cache header the answer carried once a matching rule names one', () => {
    expect(applyErrorHeaderRules([{ headers: { 'Cache-Control': YEAR } }], '/app.js', { 'Cache-Control': 'no-cache' })).toEqual({
      'Cache-Control': 'no-store',
    })
  })

  it('leaves a cache header the answer carried as it was under rules that name none', () => {
    expect(applyErrorHeaderRules([{ headers: { 'X-Frame-Options': 'DENY' } }], '/app.js', { 'Cache-Control': 'no-cache' })).toEqual({
      'Cache-Control': 'no-cache',
      'X-Frame-Options': 'DENY',
    })
  })

  it('reads no header of a rule that does not match the path', () => {
    expect(applyErrorHeaderRules([{ prefix: '/assets/', headers: { 'X-Frame-Options': 'DENY' } }], '/index.html', OWN)).toEqual(OWN)
  })

  it('keeps a rule from setting a header the server owns', () => {
    expect(applyErrorHeaderRules([{ headers: { 'Content-Length': '9999' } }], '/app.js', OWN)).toEqual(OWN)
  })
})
