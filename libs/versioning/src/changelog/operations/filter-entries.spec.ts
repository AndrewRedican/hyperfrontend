import type { Changelog } from '../models/changelog'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '../models'
import {
  filterEntries,
  filterByVersionRange,
  filterFromVersion,
  filterRecentEntries,
  filterBreakingChanges,
  filterByScope,
  filterToVersion,
  filterVersionRange,
  filterByDateRange,
  filterSections,
  filterSectionTypes,
  excludeByScope,
  filterItems,
} from './filter-entries'

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
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })
})

describe('filterByVersionRange', () => {
  it('filters entries within version range', () => {
    const changelog = createChangelog({
      ...createTestChangelog(),
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
    })

    const result = filterByVersionRange(changelog, '>=1.0.0 <3.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.version)).toContain('1.0.0')
    expect(result.entries.map((e) => e.version)).toContain('2.0.0')
  })

  it('throws error for invalid range', () => {
    const changelog = createTestChangelog()
    expect(() => filterByVersionRange(changelog, 'not-a-range!@#')).toThrow('Invalid version range')
  })

  it('excludes unreleased entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [{ version: 'Unreleased', date: null, unreleased: true, sections: [] }, createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterByVersionRange(changelog, '>=1.0.0')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })

  it('excludes entries with invalid versions', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('not-semver', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterByVersionRange(changelog, '>=1.0.0')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })
})

describe('filterFromVersion', () => {
  it('filters entries from version onwards', () => {
    const changelog = createChangelog({
      ...createTestChangelog(),
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
    })

    const result = filterFromVersion(changelog, '2.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.version)).toContain('2.0.0')
    expect(result.entries.map((e) => e.version)).toContain('3.0.0')
  })

  it('throws error for invalid start version', () => {
    const changelog = createTestChangelog()
    expect(() => filterFromVersion(changelog, 'not-valid!!')).toThrow('Invalid start version')
  })

  it('includes unreleased entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [{ version: 'Unreleased', date: null, unreleased: true, sections: [] }, createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterFromVersion(changelog, '1.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.some((e) => e.unreleased)).toBe(true)
  })

  it('excludes entries with invalid versions', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('not-semver', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterFromVersion(changelog, '1.0.0')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
  })
})

describe('filterRecentEntries', () => {
  it('returns specified number of recent entries', () => {
    const changelog = createChangelog({
      ...createTestChangelog(),
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
    })

    const result = filterRecentEntries(changelog, 2)
    expect(result.entries).toHaveLength(2)
    expect(result.entries).toEqual([expect.objectContaining({ version: '3.0.0' }), expect.objectContaining({ version: '2.0.0' })])
  })

  it('includes unreleased in count when requested', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        { version: 'Unreleased', date: null, unreleased: true, sections: [] },
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterRecentEntries(changelog, 2, true)
    expect(result.entries).toHaveLength(2)
    expect(result.entries).toEqual([expect.objectContaining({ version: 'Unreleased' }), expect.objectContaining({ version: '2.0.0' })])
  })

  it('excludes unreleased from count by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        { version: 'Unreleased', date: null, unreleased: true, sections: [] },
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterRecentEntries(changelog, 1)
    expect(result.entries).toHaveLength(2)
    expect(result.entries).toEqual([expect.objectContaining({ version: 'Unreleased' }), expect.objectContaining({ version: '2.0.0' })])
  })

  it('returns empty entries for count 0', () => {
    const changelog = createTestChangelog()
    const result = filterRecentEntries(changelog, 0)
    expect(result.entries).toHaveLength(0)
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
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
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
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
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

describe('filterToVersion', () => {
  it('filters entries up to specified version', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterToVersion(changelog, '2.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.version)).toContain('1.0.0')
    expect(result.entries.map((e) => e.version)).toContain('2.0.0')
  })

  it('throws error for invalid version', () => {
    const changelog = createTestChangelog()
    expect(() => filterToVersion(changelog, 'invalid')).toThrow('Invalid end version')
  })

  it('excludes unreleased entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        { version: 'Unreleased', date: null, unreleased: true, sections: [] },
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterToVersion(changelog, '2.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.every((e) => !e.unreleased)).toBe(true)
  })

  it('excludes entries with invalid versions', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        { version: 'not-a-version', date: '2024-01-01', unreleased: false, sections: [] },
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterToVersion(changelog, '2.0.0')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })
})

describe('filterVersionRange', () => {
  it('filters entries within range', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterVersionRange(changelog, '1.0.0', '2.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.version).sort()).toEqual(['1.0.0', '2.0.0'])
  })

  it('throws error for invalid start version', () => {
    const changelog = createTestChangelog()
    expect(() => filterVersionRange(changelog, 'invalid', '2.0.0')).toThrow('Invalid start version')
  })

  it('throws error for invalid end version', () => {
    const changelog = createTestChangelog()
    expect(() => filterVersionRange(changelog, '1.0.0', 'invalid')).toThrow('Invalid end version')
  })

  it('excludes unreleased entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        { version: 'Unreleased', date: null, unreleased: true, sections: [] },
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterVersionRange(changelog, '1.0.0', '2.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.every((e) => !e.unreleased)).toBe(true)
  })

  it('excludes entries with invalid versions', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        { version: 'not-a-version', date: '2024-01-01', unreleased: false, sections: [] },
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterVersionRange(changelog, '0.0.1', '4.0.0')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((e) => e.version).sort()).toEqual(['1.0.0', '3.0.0'])
  })
})

describe('filterByDateRange', () => {
  it('filters entries within date range', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { date: '2024-03-01', sections: [] }),
        createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] }),
        createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterByDateRange(changelog, '2024-01-15', '2024-02-15')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
  })

  it('excludes entries without dates', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterByDateRange(changelog, '2024-01-01', '2024-12-31')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
  })

  it('handles open-ended start date', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] }),
        createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterByDateRange(changelog, undefined, '2024-01-15')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })

  it('handles open-ended end date', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] }),
        createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = filterByDateRange(changelog, '2024-01-15')
    expect(result.entries).toHaveLength(1)
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
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
    expect(result.entries).toEqual([
      expect.objectContaining({
        sections: [expect.objectContaining({ type: 'features' })],
      }),
    ])
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
    expect(result.entries).toEqual([
      expect.objectContaining({
        sections: [expect.objectContaining({ type: 'features' }), expect.objectContaining({ type: 'fixes' })],
      }),
    ])
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
    expect(result.entries).toEqual([
      expect.objectContaining({
        sections: [
          expect.objectContaining({
            items: [expect.objectContaining({ scope: 'api' })],
          }),
        ],
      }),
    ])
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
    expect(result.entries).toEqual([
      expect.objectContaining({
        sections: [
          expect.objectContaining({ items: expect.arrayContaining([expect.any(Object)]) }),
          expect.objectContaining({ items: [] }),
        ],
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
    expect(result.entries).toEqual([
      expect.objectContaining({
        sections: [
          expect.objectContaining({
            items: [expect.objectContaining({ description: 'Core feature' }), expect.objectContaining({ description: 'No scope feature' })],
          }),
        ],
      }),
    ])
  })
})
