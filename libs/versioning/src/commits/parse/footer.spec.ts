import { describe, expect, it } from '@hyperfrontend/testing'
import { parseFooters } from './footer'

describe('parseFooters', () => {
  it('parses single footer with colon', () => {
    const lines = ['Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([{ key: 'Refs', value: 'ABC-123', separator: ':' }])
  })

  it('parses footer with space-hash separator', () => {
    const lines = ['Fixes #123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([{ key: 'Fixes', value: '123', separator: ' #' }])
  })

  it('parses multiple footers', () => {
    const lines = ['Refs: ABC-123', 'Reviewed-by: John Doe']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([expect.objectContaining({ key: 'Refs' }), expect.objectContaining({ key: 'Reviewed-by' })])
  })

  it('parses BREAKING CHANGE footer', () => {
    const lines = ['BREAKING CHANGE: The API has changed']
    const result = parseFooters(lines, 0)

    expect(result).toEqual({
      footers: [expect.objectContaining({ key: 'BREAKING CHANGE' })],
      breakingDescription: 'The API has changed',
    })
  })

  it('parses BREAKING-CHANGE footer', () => {
    const lines = ['BREAKING-CHANGE: New API signature']
    const result = parseFooters(lines, 0)

    expect(result).toEqual({
      footers: [expect.objectContaining({ key: 'BREAKING-CHANGE' })],
      breakingDescription: 'New API signature',
    })
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

    expect(result).toEqual({
      footers: [expect.objectContaining({ key: 'BREAKING CHANGE' }), expect.objectContaining({ key: 'Refs' })],
      breakingDescription: 'The API has changed significantly.\nUsers need to update their code.\nSee migration guide.',
    })
  })

  it('skips leading blank lines', () => {
    const lines = ['', '', 'Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(1)
  })

  it('handles footer with alphanumeric key', () => {
    const lines = ['Signed-off-by: John']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([expect.objectContaining({ key: 'Signed-off-by' })])
  })

  it('handles footer value with special characters', () => {
    const lines = ['Refs: ABC-123/DEF:456']
    const result = parseFooters(lines, 0)

    expect(result.footers[0]?.value).toBe('ABC-123/DEF:456')
  })

  it('handles empty footer value', () => {
    const lines = ['Note:']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([expect.objectContaining({ value: '' })])
  })

  it('handles multiple consecutive footers', () => {
    const lines = ['Refs: A', 'See: B', 'Ack: C']
    const result = parseFooters(lines, 0)

    expect(result.footers).toHaveLength(3)
  })

  it('handles BREAKING-CHANGE followed by another footer', () => {
    const lines = ['BREAKING-CHANGE: desc', 'Refs: 123']
    const result = parseFooters(lines, 0)

    expect(result).toEqual({
      footers: [expect.objectContaining({ key: 'BREAKING-CHANGE' }), expect.objectContaining({ key: 'Refs' })],
      breakingDescription: 'desc',
    })
  })

  it('starts from specified index', () => {
    const lines = ['Ignore this', 'Also ignore', 'Refs: ABC-123']
    const result = parseFooters(lines, 2)

    expect(result.footers).toEqual([expect.objectContaining({ key: 'Refs' })])
  })

  it('skips lines starting with special characters', () => {
    const lines = ['@not-a-footer: value', 'Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([expect.objectContaining({ key: 'Refs' })])
  })

  it('skips lines with no valid separator', () => {
    const lines = ['InvalidLine', 'Refs: ABC-123']
    const result = parseFooters(lines, 0)

    expect(result.footers).toEqual([expect.objectContaining({ key: 'Refs' })])
  })

  it('handles multi-line breaking change with blank lines in between', () => {
    const lines = ['BREAKING CHANGE: First line', '', 'Third line', 'Refs: 123']
    const result = parseFooters(lines, 0)

    expect(result).toEqual({
      footers: [expect.objectContaining({ key: 'BREAKING CHANGE' }), expect.objectContaining({ key: 'Refs' })],
      breakingDescription: 'First line\nThird line',
    })
  })
})
