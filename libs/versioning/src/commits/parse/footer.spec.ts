import { parseFooters } from './footer'

describe('parseFooters', () => {
  it('parses single footer with colon', () => {
    const lines = ['Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0]).toMatchObject({
      key: 'Refs',
      value: 'ABC-123',
      separator: ':',
    })
  })

  it('parses footer with space-hash separator', () => {
    const lines = ['Fixes #123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0]).toMatchObject({
      key: 'Fixes',
      value: '123',
      separator: ' #',
    })
  })

  it('parses multiple footers', () => {
    const lines = ['Refs: ABC-123', 'Reviewed-by: John Doe']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(2)
    expect(result.footers[0].key).toBe('Refs')
    expect(result.footers[1].key).toBe('Reviewed-by')
  })

  it('parses BREAKING CHANGE footer', () => {
    const lines = ['BREAKING CHANGE: The API has changed']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].key).toBe('BREAKING CHANGE')
    expect(result.breakingDescription).toBe('The API has changed')
  })

  it('parses BREAKING-CHANGE footer', () => {
    const lines = ['BREAKING-CHANGE: New API signature']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].key).toBe('BREAKING-CHANGE')
    expect(result.breakingDescription).toBe('New API signature')
  })

  it('handles multi-line breaking change', () => {
    const lines = [
      'BREAKING CHANGE: The API has changed significantly.',
      'Users need to update their code.',
      'See migration guide.',
      '',
      'Refs: DOC-123',
    ]
    const result = parseFooters(lines, 0)

    expect(result.breakingDescription).toContain('changed significantly')
    expect(result.breakingDescription).toContain('migration guide')
    expect(result.footers).toHaveLength(2)
  })

  it('skips leading blank lines', () => {
    const lines = ['', '', 'Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
  })

  it('handles footer with alphanumeric key', () => {
    const lines = ['Signed-off-by: John']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].key).toBe('Signed-off-by')
  })

  it('handles footer value with special characters', () => {
    const lines = ['Refs: ABC-123/DEF:456']
    const result = parseFooters(lines, 0)

    expect(result.footers[0].value).toBe('ABC-123/DEF:456')
  })

  it('handles empty footer value', () => {
    const lines = ['Note:']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].value).toBe('')
  })

  it('handles multiple consecutive footers', () => {
    const lines = ['Refs: A', 'See: B', 'Ack: C']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(3)
  })

  it('handles BREAKING-CHANGE followed by another footer', () => {
    const lines = ['BREAKING-CHANGE: desc', 'Refs: 123']
    const result = parseFooters(lines, 0)

    expect(result.breakingDescription).toBe('desc')
    expect(result.footers).toHaveLength(2)
  })

  it('starts from specified index', () => {
    const lines = ['Ignore this', 'Also ignore', 'Refs: ABC-123']
    const result = parseFooters(lines, 2)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].key).toBe('Refs')
  })

  it('skips lines starting with special characters', () => {
    const lines = ['@not-a-footer: value', 'Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].key).toBe('Refs')
  })

  it('skips lines with no valid separator', () => {
    const lines = ['InvalidLine', 'Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
    expect(result.footers[0].key).toBe('Refs')
  })

  it('handles multi-line breaking change with blank lines in between', () => {
    const lines = ['BREAKING CHANGE: First line', '', 'Third line', 'Refs: 123']
    const result = parseFooters(lines, 0)

    expect(result.breakingDescription).toBe('First line\nThird line')
    expect(result.footers).toHaveLength(2)
  })
})
