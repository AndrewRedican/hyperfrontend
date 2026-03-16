import { createChangelogSection, createChangelogItem, getSectionType, SECTION_HEADINGS } from './index'

describe('createChangelogSection', () => {
  it('creates a section', () => {
    const section = createChangelogSection('features', 'Features', [createChangelogItem('New feature')])
    expect(section.type).toBe('features')
    expect(section.heading).toBe('Features')
    expect(section.items).toHaveLength(1)
  })
})

describe('getSectionType', () => {
  it('returns correct types for standard headings', () => {
    expect(getSectionType('Features')).toBe('features')
    expect(getSectionType('Bug Fixes')).toBe('fixes')
    expect(getSectionType('Breaking Changes')).toBe('breaking')
    expect(getSectionType('Performance')).toBe('performance')
  })

  it('handles case insensitively', () => {
    expect(getSectionType('FEATURES')).toBe('features')
    expect(getSectionType('bug fixes')).toBe('fixes')
  })

  it('returns other for unknown headings', () => {
    expect(getSectionType('Random Heading')).toBe('other')
  })
})

describe('SECTION_HEADINGS', () => {
  it('has all section types', () => {
    expect(SECTION_HEADINGS.features).toBe('Features')
    expect(SECTION_HEADINGS.fixes).toBe('Bug Fixes')
    expect(SECTION_HEADINGS.breaking).toBe('Breaking Changes')
  })
})
