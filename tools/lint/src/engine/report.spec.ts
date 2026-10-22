import type { Message } from './report.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compareMessages } from './report.ts'

const message = (line: number, column: number, ruleId: string | null): Message => ({
  ruleId,
  severity: 2,
  message: 'm',
  line,
  column,
  endLine: line,
  endColumn: column,
  fatal: false,
  fix: null,
  suggestions: [],
})

describe('compareMessages', () => {
  it('orders by line first', () => {
    expect(compareMessages(message(2, 1, 'a'), message(1, 9, 'a'))).toBeGreaterThan(0)
  })

  it('orders by column on the same line', () => {
    expect(compareMessages(message(1, 1, 'b'), message(1, 2, 'a'))).toBeLessThan(0)
  })

  it('orders by rule at the same position', () => {
    expect(compareMessages(message(1, 1, 'b'), message(1, 1, 'a'))).toBeGreaterThan(0)
  })

  it('treats a fatal message as an empty rule id', () => {
    expect(compareMessages(message(1, 1, null), message(1, 1, 'a'))).toBeLessThan(0)
  })
})
