import type { RuleScope, ServeHeaderRule } from './serve-types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { matchesEveryPath } from './scope'

describe('matchesEveryPath', () => {
  it.each([[{}], [{ prefix: '' }], [{ prefix: '/' }], [{ suffix: '' }], [{ prefix: '/', suffix: '' }], [{ prefix: '', suffix: '' }]])(
    'reads %p as bounding nothing',
    (scope: RuleScope) => {
      expect(matchesEveryPath(scope)).toBe(true)
    }
  )

  it.each([
    [{ prefix: '/app/' }],
    [{ suffix: '.html' }],
    [{ prefix: '/', suffix: '.html' }],
    [{ prefix: '/app/', suffix: '' }],
    [{ prefix: '//' }],
    [{ suffix: '/' }],
  ])('reads %p as bounded', (scope: RuleScope) => {
    expect(matchesEveryPath(scope)).toBe(false)
  })

  it('reads a whole header rule by its bounds alone', () => {
    const rule: ServeHeaderRule = { prefix: '/', headers: { 'Cache-Control': 'no-cache' } }
    expect(matchesEveryPath(rule)).toBe(true)
  })
})
