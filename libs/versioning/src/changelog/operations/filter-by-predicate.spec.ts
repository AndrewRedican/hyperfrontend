import type { Changelog } from '../models/changelog'
import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '../models'
import {
  filterEntries,
  filterBreakingChanges,
  filterSections,
  filterSectionTypes,
  filterItems,
  filterByScope,
  excludeByScope,
} from './filter-by-predicate'

const createTestChangelog = (): Changelog =>
  createChangelog({
    header: {
      title: '# Changelog',
      description: ['All notable changes'],
      links: [],
    },
    entries: [
      createChangelogEntry('2.0.0', {
        date: '2024-02-01',
        sections: [createChangelogSection('features', 'Features', [createChangelogItem('New feature')])],
      }),
      createChangelogEntry('1.0.0', {
        date: '2024-01-01',
        sections: [
          createChangelogSection('features', 'Features', [createChangelogItem('Initial feature')]),
          createChangelogSection('fixes', 'Bug Fixes', [createChangelogItem('Initial fix')]),
        ],
      }),
    ],
    metadata: {
      format: 'keep-a-changelog',
      isConventional: false,
      warnings: [],
    },
  })

describe('filterEntries', () => {
  it('filters entries by predicate', () => {
    const changelog = createTestChangelog()
    const result = filterEntries(changelog, (entry) => entry.version === '1.0.0')

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('1.0.0')
  })
})

describe('filterBreakingChanges', () => {
  it('filters entries with breaking changes', () => {
    const changelog = createChangelog({
      ...createTestChangelog(),
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('breaking', 'BREAKING CHANGES', [createChangelogItem('Breaking change', { breaking: true })])],
        }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
    })

    const result = filterBreakingChanges(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('2.0.0')
  })

  it('includes entries with breaking items in non-breaking sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Breaking feature', { breaking: true })])],
        }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterBreakingChanges(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('2.0.0')
  })
})

describe('filterSections', () => {
  it('filters sections using predicate', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
            createChangelogSection('fixes', 'Bug Fixes', [createChangelogItem('Fix')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterSections(changelog, (section) => section.type === 'features')
    expect(result.entries[0].sections).toHaveLength(1)
    expect(result.entries[0].sections[0].type).toBe('features')
  })
})

describe('filterSectionTypes', () => {
  it('keeps only specified section types', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', []),
            createChangelogSection('fixes', 'Bug Fixes', []),
            createChangelogSection('breaking', 'Breaking', []),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterSectionTypes(changelog, ['features', 'fixes'])
    expect(result.entries[0].sections).toHaveLength(2)
    expect(result.entries[0].sections.map((s) => s.type)).toEqual(['features', 'fixes'])
  })
})

describe('filterItems', () => {
  it('filters items based on predicate', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('API feature', { scope: 'api' }),
              createChangelogItem('Core feature', { scope: 'core' }),
              createChangelogItem('No scope feature'),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterItems(changelog, (item) => item.scope === 'api')
    expect(result.entries[0].sections[0].items).toHaveLength(1)
    expect(result.entries[0].sections[0].items[0].scope).toBe('api')
  })

  it('receives section and entry in predicate', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature 1')]),
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix 1')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterItems(changelog, (_item, section, entry) => {
      return section.type === 'features' && entry.version === '1.0.0'
    })
    expect(result.entries[0].sections[0].items).toHaveLength(1)
    expect(result.entries[0].sections[1].items).toHaveLength(0)
  })
})

describe('filterByScope', () => {
  it('filters items by scope, keeping all entries', () => {
    const changelog = createChangelog({
      ...createTestChangelog(),
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature with scope', { scope: 'api' })])],
        }),
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature without scope')])],
        }),
      ],
    })

    const result = filterByScope(changelog, ['api'])
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].sections[0].items).toHaveLength(1)
    expect(result.entries[0].sections[0].items[0].scope).toBe('api')
    expect(result.entries[1].sections[0].items).toHaveLength(0)
  })
})

describe('excludeByScope', () => {
  it('excludes items with specified scopes', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('API feature', { scope: 'api' }),
              createChangelogItem('Core feature', { scope: 'core' }),
              createChangelogItem('No scope feature'),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = excludeByScope(changelog, ['api'])
    const items = result.entries[0].sections[0].items
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.description)).toEqual(['Core feature', 'No scope feature'])
  })
})
