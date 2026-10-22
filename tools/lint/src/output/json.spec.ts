import type { Message } from '../engine/report.ts'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { formatJson } from './json.ts'

const message = (overrides: Partial<Message>): Message => ({
  ruleId: 'workspace/no-enum',
  severity: 2,
  message: 'No enums.',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 2,
  fatal: false,
  fix: null,
  suggestions: [],
  ...overrides,
})

describe('formatJson', () => {
  it('prints a clean file with zero counts', () => {
    expect(parse(formatJson([{ filePath: '/w/a.ts', messages: [], output: null }]))).toEqual([
      {
        filePath: '/w/a.ts',
        messages: [],
        suppressedMessages: [],
        errorCount: 0,
        fatalErrorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
    ])
  })

  it('prints a plain message without optional parts', () => {
    expect(parse(formatJson([{ filePath: '/w/a.ts', messages: [message({})], output: null }]))).toMatchObject([
      {
        messages: [{ ruleId: 'workspace/no-enum', severity: 2, message: 'No enums.', line: 1, column: 1, endLine: 1, endColumn: 2 }],
        errorCount: 1,
      },
    ])
  })

  it('leaves the end position out of a problem without a range', () => {
    expect(
      parse(formatJson([{ filePath: '/w/a.ts', messages: [message({ endLine: null, endColumn: null })], output: null }]))
    ).toMatchObject([{ messages: [expect.not.objectContaining({ endLine: expect.anything() })] }])
  })

  it('counts a fatal error and marks the message', () => {
    expect(parse(formatJson([{ filePath: '/w/a.ts', messages: [message({ ruleId: null, fatal: true })], output: null }]))).toMatchObject([
      { messages: [{ fatal: true }], fatalErrorCount: 1 },
    ])
  })

  it('prints a fix as a range and counts it', () => {
    const fixed = message({ severity: 1, fix: { start: 2, end: 5, text: 'x' } })
    expect(parse(formatJson([{ filePath: '/w/a.ts', messages: [fixed], output: null }]))).toMatchObject([
      { messages: [{ fix: { range: [2, 5], text: 'x' } }], warningCount: 1, fixableWarningCount: 1 },
    ])
  })

  it('prints suggestions with their descriptions', () => {
    const suggested = message({ suggestions: [{ message: 'Use unknown', fix: { start: 0, end: 3, text: 'unknown' } }] })
    expect(parse(formatJson([{ filePath: '/w/a.ts', messages: [suggested], output: null }]))).toMatchObject([
      { messages: [{ suggestions: [{ desc: 'Use unknown', fix: { range: [0, 3], text: 'unknown' } }] }] },
    ])
  })

  it('prints the fixed text when there is one', () => {
    expect(parse(formatJson([{ filePath: '/w/a.ts', messages: [], output: 'fixed' }]))).toMatchObject([{ output: 'fixed' }])
  })
})
