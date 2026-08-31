import type { Rule, RuleContext, RuleMessage } from './rule'
import { describe, expect, it } from '@hyperfrontend/testing'

describe('rule types', () => {
  it('accepts a conforming rule implementation', () => {
    const rule: Rule<{ max: number }> = {
      name: 'example',
      check(_commit, context) {
        const max = context.options?.max ?? 0
        return max > 0 ? [] : ['options.max must be positive']
      },
    }
    expect(rule.name).toBe('example')
  })

  it('represents a severity-tagged violation as RuleMessage', () => {
    const message: RuleMessage = { level: 'error', message: 'boom', ruleName: 'example' }
    expect(message).toEqual({ level: 'error', message: 'boom', ruleName: 'example' })
  })

  it('exposes level and options on the rule context', () => {
    const context: RuleContext<{ enabled: boolean }> = { level: 'warn', options: { enabled: true } }
    expect(context).toEqual({ level: 'warn', options: { enabled: true } })
  })
})
