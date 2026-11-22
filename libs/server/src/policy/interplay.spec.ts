import type { PolicyIssue } from './issues'
import { describe, expect, it } from '@hyperfrontend/testing'
import { checkHeaderPolicy } from './interplay'

const DECLARED = 'https://host.example'

const codes = (issues: readonly PolicyIssue[]): readonly string[] => issues.map((issue) => `${issue.code} at ${issue.path}`)

const judge = (rule: Record<string, unknown>): readonly string[] =>
  codes(checkHeaderPolicy({ embedders: [DECLARED], headers: [rule] }, true))

describe('checkHeaderPolicy over a directive a browser discards', () => {
  it.each([
    [
      'restates the declared list with a no-break space after it',
      { headers: { 'Content-Security-Policy': `frame-ancestors ${DECLARED}\u00a0` } },
    ],
    [
      'puts a no-break space ahead of the directive on its pages',
      { suffix: '.html', headers: { 'Content-Security-Policy': `default-src 'self';\u00a0frame-ancestors ${DECLARED}` } },
    ],
    [
      'lists a host outside ASCII on its pages',
      { suffix: '.html', headers: { 'Content-Security-Policy': `frame-ancestors ${DECLARED} https://b\u00fccher.example` } },
    ],
    ['puts a vertical tab ahead of the directive', { headers: { 'Content-Security-Policy': `\u000bframe-ancestors ${DECLARED}` } }],
  ])('reports the embedders as dropped by a rule that %s', (_label: string, rule: Record<string, unknown>) => {
    expect(judge(rule)).toEqual(['embedders-dropped-by-rule at headers[0].headers["Content-Security-Policy"]'])
  })
})

describe('checkHeaderPolicy over a rule whose bound excludes no path', () => {
  it.each([[{ prefix: '' }], [{ prefix: '/' }], [{ suffix: '' }], [{ prefix: '/', suffix: '' }]])(
    'reports a rule bounded by %p that lists other sources as contradicting the embedders',
    (bounds: Record<string, string>) => {
      expect(judge({ ...bounds, headers: { 'Content-Security-Policy': 'frame-ancestors https://other.example' } })).toEqual([
        'embedders-contradicted-by-rule at headers[0].headers["Content-Security-Policy"]',
      ])
    }
  )

  it.each([[{ prefix: '' }], [{ prefix: '/' }], [{ suffix: '' }], [{ prefix: '/', suffix: '' }]])(
    'tells the author of a rule bounded by %p that the bound excludes no path',
    (bounds: Record<string, string>) => {
      expect(
        checkHeaderPolicy(
          {
            embedders: [DECLARED],
            headers: [{ ...bounds, headers: { 'Content-Security-Policy': 'frame-ancestors https://other.example' } }],
          },
          true
        ).map((issue) => issue.message)
      ).toEqual([
        'headers[0].headers["Content-Security-Policy"] applies to every path, because its prefix and suffix exclude none, with a frame-ancestors list other than the one "embedders" declares: make the two equal, give the rule a prefix longer than "/" or a suffix that is not empty, or remove "embedders".',
      ])
    }
  )

  it('tells the author of a rule with no bound to add one', () => {
    expect(
      checkHeaderPolicy(
        { embedders: [DECLARED], headers: [{ headers: { 'Content-Security-Policy': 'frame-ancestors https://other.example' } }] },
        true
      ).map((issue) => issue.message)
    ).toEqual([
      'headers[0].headers["Content-Security-Policy"] applies to every path with a frame-ancestors list other than the one "embedders" declares: make the two equal, bound the rule with a prefix or suffix, or remove "embedders".',
    ])
  })

  it('accepts a rule with an empty bound that restates the declared list', () => {
    expect(judge({ prefix: '/', headers: { 'Content-Security-Policy': `frame-ancestors ${DECLARED}` } })).toEqual([])
  })

  it.each([[{ prefix: '/host/' }], [{ suffix: '.html' }], [{ prefix: '/', suffix: '.html' }]])(
    'accepts a rule bounded by %p that lists sources of its own',
    (bounds: Record<string, string>) => {
      expect(judge({ ...bounds, headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } })).toEqual([])
    }
  )
})
