import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveOptions, getSectionHeading, formatLink, getListMarker, createSpacing, DEFAULT_SERIALIZE_OPTIONS } from './templates'

describe('resolveOptions', () => {
  it('returns defaults when no options provided', () => {
    const result = resolveOptions()
    expect(result).toEqual(DEFAULT_SERIALIZE_OPTIONS)
  })

  it('returns defaults when undefined passed', () => {
    const result = resolveOptions(undefined)
    expect(result).toEqual(DEFAULT_SERIALIZE_OPTIONS)
  })

  it('merges partial options with defaults', () => {
    const result = resolveOptions({ useAsterisks: true })
    expect(result.useAsterisks).toBe(true)
    expect(result.includeDescription).toBe(true)
  })

  it('preserves all custom option values', () => {
    const result = resolveOptions({
      includeDescription: false,
      includeLinks: false,
      includeCompareUrls: false,
      includeCommits: false,
      includeReferences: false,
      includeScope: false,
      includeRawContent: true,
      lineEnding: '\r\n',
      entrySpacing: 2,
      sectionSpacing: 3,
      useAsterisks: true,
    })
    expect(result.includeDescription).toBe(false)
    expect(result.includeLinks).toBe(false)
    expect(result.includeCompareUrls).toBe(false)
    expect(result.includeCommits).toBe(false)
    expect(result.includeReferences).toBe(false)
    expect(result.includeScope).toBe(false)
    expect(result.includeRawContent).toBe(true)
    expect(result.lineEnding).toBe('\r\n')
    expect(result.entrySpacing).toBe(2)
    expect(result.sectionSpacing).toBe(3)
    expect(result.useAsterisks).toBe(true)
  })
})

describe('getSectionHeading', () => {
  it('returns default heading when no custom headings provided', () => {
    expect(getSectionHeading('features')).toBe('Features')
    expect(getSectionHeading('fixes')).toBe('Bug Fixes')
    expect(getSectionHeading('breaking')).toBe('Breaking Changes')
  })

  it('returns default heading when custom headings map is empty', () => {
    expect(getSectionHeading('features', {})).toBe('Features')
  })

  it('returns custom heading when provided', () => {
    const custom = { features: 'New Features', fixes: 'Bugfixes' }
    expect(getSectionHeading('features', custom)).toBe('New Features')
    expect(getSectionHeading('fixes', custom)).toBe('Bugfixes')
  })

  it('falls back to default when type not in custom headings', () => {
    const custom = { features: 'New Features' }
    expect(getSectionHeading('fixes', custom)).toBe('Bug Fixes')
  })
})

describe('formatLink', () => {
  it('creates markdown link', () => {
    expect(formatLink('text', 'https://example.com')).toBe('[text](https://example.com)')
  })

  it('handles empty text', () => {
    expect(formatLink('', 'https://example.com')).toBe('[](https://example.com)')
  })
})

describe('getListMarker', () => {
  it('returns dash by default', () => {
    expect(getListMarker(false)).toBe('- ')
  })

  it('returns asterisk when requested', () => {
    expect(getListMarker(true)).toBe('* ')
  })
})

describe('createSpacing', () => {
  it('returns empty string for zero count', () => {
    expect(createSpacing(0, '\n')).toBe('')
  })

  it('returns empty string for negative count', () => {
    expect(createSpacing(-1, '\n')).toBe('')
  })

  it('creates single blank line', () => {
    expect(createSpacing(1, '\n')).toBe('\n')
  })

  it('creates multiple blank lines', () => {
    expect(createSpacing(3, '\n')).toBe('\n\n\n')
  })

  it('uses custom line ending', () => {
    expect(createSpacing(2, '\r\n')).toBe('\r\n\r\n')
  })
})
