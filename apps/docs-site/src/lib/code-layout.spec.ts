import { describe, expect, it } from 'vitest'
import { classifyCodeLayout, COMPACT_MAX_LINE_LENGTH, COMPACT_MAX_LINES, measureCode, readLayoutOverride } from './code-layout'

describe('measureCode', () => {
  it('measures the longest line and the line count', () => {
    expect(measureCode('git clone https://example.com/repo.git\ncd repo\nnpm install')).toEqual({ longestLine: 38, lineCount: 3 })
  })

  it('does not count a trailing newline as a line', () => {
    expect(measureCode('npm install\n')).toEqual({ longestLine: 11, lineCount: 1 })
  })

  it('counts a tab as four columns', () => {
    expect(measureCode('\tx')).toEqual({ longestLine: 5, lineCount: 1 })
  })
})

describe('readLayoutOverride', () => {
  it('reads a full override', () => {
    expect(readLayoutOverride('layout=full')).toBe('full')
  })

  it('reads a compact override among other meta', () => {
    expect(readLayoutOverride('title="install" layout=compact showLineNumbers')).toBe('compact')
  })

  it('ignores an unknown layout value', () => {
    expect(readLayoutOverride('layout=wide')).toBeUndefined()
  })

  it('returns undefined for an empty meta string', () => {
    expect(readLayoutOverride('')).toBeUndefined()
  })
})

describe('classifyCodeLayout', () => {
  it('draws a short command compact', () => {
    expect(classifyCodeLayout('npm install @hyperfrontend/features')).toBe('compact')
  })

  it('draws a block full once its longest line passes the limit', () => {
    expect(classifyCodeLayout('x'.repeat(COMPACT_MAX_LINE_LENGTH + 1))).toBe('full')
  })

  it('draws a block compact at exactly the line limit', () => {
    expect(classifyCodeLayout('x'.repeat(COMPACT_MAX_LINE_LENGTH))).toBe('compact')
  })

  it('draws a block full once it has too many lines', () => {
    expect(classifyCodeLayout([...new Array<undefined>(COMPACT_MAX_LINES + 1)].map(() => 'x').join('\n'))).toBe('full')
  })

  it('draws a block compact at exactly the line count limit', () => {
    expect(classifyCodeLayout([...new Array<undefined>(COMPACT_MAX_LINES)].map(() => 'x').join('\n'))).toBe('compact')
  })

  it('lets an author force a short block full', () => {
    expect(classifyCodeLayout('npm install x', 'full')).toBe('full')
  })

  it('lets an author force a long block compact', () => {
    expect(classifyCodeLayout('x'.repeat(200), 'compact')).toBe('compact')
  })
})
