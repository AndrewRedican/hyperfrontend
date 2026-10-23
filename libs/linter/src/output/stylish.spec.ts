import type { FileResult, Message } from '../engine/report'
import { describe, expect, it } from '@hyperfrontend/testing'
import { formatStylish } from './stylish'

const message = (overrides: Partial<Message>): Message => ({
  ruleId: 'no-enum',
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

describe('formatStylish', () => {
  it('prints nothing for clean files', () => {
    expect(formatStylish([{ filePath: '/w/a.ts', messages: [], output: null }])).toBe('')
  })

  it('prints each problem under its file with aligned columns and a count', () => {
    const result: FileResult = {
      filePath: '/w/a.ts',
      messages: [
        message({ line: 3, column: 5 }),
        message({ line: 12, column: 1, severity: 1, message: 'Unused variable', ruleId: 'no-unused-vars' }),
      ],
      output: null,
    }
    expect(formatStylish([result])).toBe(
      [
        '',
        '/w/a.ts',
        '   3:5  error    No enums         no-enum',
        '  12:1  warning  Unused variable  no-unused-vars',
        '',
        '✖ 2 problems (1 error, 1 warning)',
        '',
      ].join('\n')
    )
  })

  it('counts one problem in the singular', () => {
    expect(formatStylish([{ filePath: '/w/a.ts', messages: [message({})], output: null }])).toContain('✖ 1 problem (1 error, 0 warnings)')
  })

  it('counts one warning in the singular', () => {
    expect(formatStylish([{ filePath: '/w/a.ts', messages: [message({ severity: 1 })], output: null }])).toContain(
      '✖ 1 problem (0 errors, 1 warning)'
    )
  })

  it('counts several fixable problems in the plural', () => {
    const fixed = message({ fix: { start: 0, end: 1, text: '' } })
    const warned = message({ severity: 1, fix: { start: 0, end: 1, text: '' } })
    expect(formatStylish([{ filePath: '/w/a.ts', messages: [fixed, fixed, warned, warned], output: null }])).toContain(
      '  2 errors and 2 warnings potentially fixable with the `--fix` option.\n'
    )
  })

  it('names the fixable problems', () => {
    const result: FileResult = { filePath: '/w/a.ts', messages: [message({ fix: { start: 0, end: 1, text: '' } })], output: null }
    expect(formatStylish([result])).toContain('  1 error and 0 warnings potentially fixable with the `--fix` option.\n')
  })

  it('prints a fatal problem without a rule', () => {
    const result: FileResult = {
      filePath: '/w/a.json',
      messages: [message({ ruleId: null, fatal: true, message: 'Parsing error: Unexpected character }' })],
      output: null,
    }
    expect(formatStylish([result])).toContain('  1:1  error  Parsing error: Unexpected character }\n')
  })
})
