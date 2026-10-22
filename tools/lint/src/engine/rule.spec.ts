import { describe, expect, it } from '@hyperfrontend/testing'
import { defineRule } from './rule.ts'

describe('defineRule', () => {
  it('returns the rule it is given', () => {
    const rule = { id: 'workspace/example', language: 'json' as const, fixable: false, create: () => ({}) }
    expect(defineRule(rule)).toBe(rule)
  })
})
