import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeHeaderRule } from '../policy/serve-types'
import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { checkServeConfig } from '../policy/serve-config'
import { failureResponse } from './serve-steps'

const plan = (headers: readonly ServeHeaderRule[]): ResolvedServeConfig => ({ root: resolve('/site'), port: 4284, headers, log: false })

// note: A year, the lifetime an asset rule writes for a file whose name carries a hash of its bytes.
const YEAR = 'max-age=31536000'

describe('failureResponse', () => {
  it.each([
    ['CDN-Cache-Control'],
    ['cdn-cache-control'],
    ['Cloudflare-CDN-Cache-Control'],
    ['Vercel-CDN-Cache-Control'],
    ['Surrogate-Control'],
    ['SURROGATE-CONTROL'],
    ['Expires'],
    ['expires'],
    ['X-Accel-Expires'],
  ])('leaves out the %s a matching rule wrote for the file', (name: string) => {
    expect(
      failureResponse(plan([{ prefix: '/assets/', headers: { [name]: YEAR, 'X-Frame-Options': 'DENY' } }]), '/assets/app.js').headers
    ).toEqual({ 'Content-Type': 'text/plain; charset=utf-8', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' })
  })

  it('leaves out every lifetime of a rule the validator accepts', () => {
    const rule: ServeHeaderRule = {
      prefix: '/assets/',
      headers: { 'Cache-Control': `public, ${YEAR}, immutable`, 'CDN-Cache-Control': YEAR, 'Surrogate-Control': YEAR },
    }
    expect({ issues: checkServeConfig({ headers: [rule] }), headers: failureResponse(plan([rule]), '/assets/app.js').headers }).toEqual({
      issues: [],
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  })

  it('marks the failure in the place a rule gave its cache header', () => {
    const rules: readonly ServeHeaderRule[] = [{ headers: { 'Cache-Control': YEAR, 'CDN-Cache-Control': YEAR, 'X-Frame-Options': 'DENY' } }]
    expect(Object.entries(failureResponse(plan(rules), '/app.js').headers)).toEqual([
      ['Content-Type', 'text/plain; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ['X-Frame-Options', 'DENY'],
    ])
  })

  it.each([['Clear-Site-Data'], ['Cache-Status'], ['X-Cache-Control-Policy'], ['Vary']])(
    'keeps a %s header, which sets no lifetime',
    (name: string) => {
      expect(failureResponse(plan([{ headers: { [name]: 'kept' } }]), '/app.js').headers[name]).toBe('kept')
    }
  )

  it('reads no header of a rule that does not match the path', () => {
    expect(failureResponse(plan([{ prefix: '/assets/', headers: { 'CDN-Cache-Control': YEAR } }]), '/index.html').headers).toEqual({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    })
  })

  it('answers with no rule header when the rules cannot be folded', () => {
    expect(failureResponse(plan([{ headers: null }] as unknown as readonly ServeHeaderRule[]), '/app.js').headers).toEqual({
      'Content-Type': 'text/plain; charset=utf-8',
    })
  })
})
