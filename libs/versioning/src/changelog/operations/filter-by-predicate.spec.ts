import type { Changelog } from '../models/changelog'
import { describe, expect, it } from '@hyperfrontend/testing'
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
    expect(result.entries[0]).toEqual(expect.objectContaining({ version: '1.0.0' }))
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
    expect(result.entries[0]).toEqual(expect.objectContaining({ version: '2.0.0' }))
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
    expect(result.entries[0]).toEqual(expect.objectContaining({ version: '2.0.0' }))
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
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        sections: [expect.objectContaining({ type: 'features' })],
      })
    )
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
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        sections: [expect.objectContaining({ type: 'features' }), expect.objectContaining({ type: 'fixes' })],
      })
    )
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
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        sections: [expect.objectContaining({ items: [expect.objectContaining({ scope: 'api' })] })],
      })
    )
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
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        sections: [expect.objectContaining({ items: [expect.anything()] }), expect.objectContaining({ items: [] })],
      })
    )
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
    expect(result.entries).toEqual([
      expect.objectContaining({
        sections: [expect.objectContaining({ items: [expect.objectContaining({ scope: 'api' })] })],
      }),
      expect.objectContaining({
        sections: [expect.objectContaining({ items: [] })],
      }),
    ])
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
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        sections: [
          expect.objectContaining({
            items: [expect.objectContaining({ description: 'Core feature' }), expect.objectContaining({ description: 'No scope feature' })],
          }),
        ],
      })
    )
  })
})
