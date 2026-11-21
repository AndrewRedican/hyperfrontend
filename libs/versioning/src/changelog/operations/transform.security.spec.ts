import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelog, createChangelogEntry, createChangelogItem, createChangelogSection } from '../models'
import { normalizeSectionHeadings, sortSections } from './transform'

const changelog = createChangelog({
  header: { title: '#', description: [], links: [] },
  entries: [
    createChangelogEntry('1.0.1', {
      sections: [
        createChangelogSection('fixes', 'Bug Fixes', [createChangelogItem('close the leak')]),
        createChangelogSection('features', 'Features', [createChangelogItem('add a safer option')]),
        createChangelogSection('security', 'Vulnerabilities', [createChangelogItem('bump a vulnerable dependency')]),
        createChangelogSection('breaking', 'Breaking Changes', [createChangelogItem('drop an option')]),
      ],
    }),
  ],
  metadata: { format: 'conventional', isConventional: true, warnings: [] },
})

describe('sortSections with a security section', () => {
  it('places security between breaking changes and features in the standard order', () => {
    expect(sortSections(changelog).entries[0]?.sections.map((section) => section.type)).toEqual([
      'breaking',
      'security',
      'features',
      'fixes',
    ])
  })
})

describe('normalizeSectionHeadings with a security section', () => {
  it('renames the section to Security', () => {
    expect(normalizeSectionHeadings(changelog).entries[0]?.sections.find((section) => section.type === 'security')?.heading).toBe(
      'Security'
    )
  })
})
