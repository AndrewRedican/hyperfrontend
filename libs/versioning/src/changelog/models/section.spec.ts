import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelogSection, createChangelogItem, getSectionType, SECTION_HEADINGS } from './index'

describe('createChangelogSection', () => {
  it('creates a section', () => {
    expect(createChangelogSection('features', 'Features', [createChangelogItem('New feature')])).toMatchObject({
      type: 'features',
      heading: 'Features',
      items: [{ description: 'New feature' }],
    })
  })
})

describe('getSectionType', () => {
  it('maps the Features heading to features', () => {
    expect(getSectionType('Features')).toBe('features')
  })

  it('maps the Bug Fixes heading to fixes', () => {
    expect(getSectionType('Bug Fixes')).toBe('fixes')
  })

  it('maps the Breaking Changes heading to breaking', () => {
    expect(getSectionType('Breaking Changes')).toBe('breaking')
  })

  it('maps the Performance heading to performance', () => {
    expect(getSectionType('Performance')).toBe('performance')
  })

  it('ignores upper case in a heading', () => {
    expect(getSectionType('FEATURES')).toBe('features')
  })

  it('ignores lower case in a heading', () => {
    expect(getSectionType('bug fixes')).toBe('fixes')
  })

  it('returns other for unknown headings', () => {
    expect(getSectionType('Random Heading')).toBe('other')
  })
})

describe('SECTION_HEADINGS', () => {
  it('names the core section types', () => {
    expect(SECTION_HEADINGS).toMatchObject({ features: 'Features', fixes: 'Bug Fixes', breaking: 'Breaking Changes' })
  })
})
