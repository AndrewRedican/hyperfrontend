import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '../models'
import {
  transformEntries,
  transformSections,
  transformItems,
  updateHeader,
  updateMetadata,
  updateEntry,
  sortEntries,
  sortEntriesByDate,
  normalizeSectionHeadings,
  compact,
  cloneChangelog,
  sortSections,
  reverseEntries,
  deduplicateItems,
  stripMetadata,
} from './transform'

describe('transformEntries', () => {
  it('applies function to all entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformEntries(changelog, (entry) => ({ ...entry, date: '2024-01-01' }))
    expect(result.entries[0].date).toBe('2024-01-01')
    expect(result.entries[1].date).toBe('2024-01-01')
  })

  it('can transform entries conditionally', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('Unreleased', { unreleased: true, sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformEntries(changelog, (entry) => (entry.unreleased ? { ...entry, version: '[Unreleased]' } : entry))
    expect(result.entries[0].version).toBe('[Unreleased]')
    expect(result.entries[1].version).toBe('1.0.0')
  })
})

describe('transformSections', () => {
  it('applies function to all sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformSections(changelog, (section) => ({ ...section, heading: 'Changed' }))
    expect(result.entries[0].sections[0].heading).toBe('Changed')
  })

  it('can transform sections conditionally', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
            createChangelogSection('deprecations', 'Deprecated', [createChangelogItem('Old')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformSections(changelog, (section) =>
      section.type === 'deprecations' ? { ...section, heading: 'Legacy' } : section
    )
    expect(result.entries[0].sections[0].heading).toBe('Features')
    expect(result.entries[0].sections[1].heading).toBe('Legacy')
  })
})

describe('transformItems', () => {
  it('applies function to all items', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformItems(changelog, (item) => ({ ...item, description: 'Changed' }))
    expect(result.entries[0].sections[0].items[0].description).toBe('Changed')
  })

  it('can transform items conditionally', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature A'),
              { description: 'WIP', scope: null, breaking: false, commits: [], references: [] },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformItems(changelog, (item) => (item.description === 'WIP' ? { ...item, description: 'Work In Progress' } : item))
    expect(result.entries[0].sections[0].items[0].description).toBe('Feature A')
    expect(result.entries[0].sections[0].items[1].description).toBe('Work In Progress')
  })
})

describe('updateHeader', () => {
  it('updates header properties', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = updateHeader(changelog, { title: '# CHANGELOG' })
    expect(result.header.title).toBe('# CHANGELOG')
  })

  it('preserves existing header properties', () => {
    const changelog = createChangelog({
      header: { title: '#', description: ['Desc'], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = updateHeader(changelog, { title: '# CHANGELOG' })
    expect(result.header.description).toEqual(['Desc'])
  })
})

describe('updateMetadata', () => {
  it('updates metadata properties', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = updateMetadata(changelog, { format: 'keep-a-changelog' })
    expect(result.metadata.format).toBe('keep-a-changelog')
  })

  it('preserves existing metadata properties', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: true, warnings: [] },
    })

    const result = updateMetadata(changelog, { format: 'keep-a-changelog' })
    expect(result.metadata.isConventional).toBe(true)
  })
})

describe('updateEntry', () => {
  it('updates a specific entry by version', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = updateEntry(changelog, '1.0.0', { date: '2024-01-01' })
    expect(result.entries[1].date).toBe('2024-01-01')
    expect(result.entries[0].date).toBeNull()
  })

  it('throws if version not found', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => updateEntry(changelog, '2.0.0', { date: '2024-01-01' })).toThrow('Entry with version "2.0.0" not found')
  })

  it('accepts a transformer function instead of partial object', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = updateEntry(changelog, '1.0.0', (entry) => ({
      ...entry,
      date: entry.date ? entry.date.replace('2024', '2025') : null,
    }))
    expect(result.entries[0].date).toBe('2025-01-01')
  })
})

describe('sortEntries', () => {
  it('sorts entries by semver in descending order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', { sections: [] }),
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntries(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['3.0.0', '2.0.0', '1.0.0'])
  })

  it('keeps unreleased at top', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', { sections: [] }),
        createChangelogEntry('Unreleased', { unreleased: true, sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntries(changelog)
    expect(result.entries[0].unreleased).toBe(true)
    expect(result.entries.slice(1).map((e) => e.version)).toEqual(['2.0.0', '1.0.0'])
  })

  it('handles prerelease versions', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0-alpha', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
        createChangelogEntry('1.0.0-beta', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntries(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['1.0.0', '1.0.0-beta', '1.0.0-alpha'])
  })

  it('keeps multiple unreleased entries in original order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('Unreleased-A', { unreleased: true, sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
        createChangelogEntry('Unreleased-B', { unreleased: true, sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntries(changelog)
    expect(result.entries[0].version).toBe('Unreleased-A')
    expect(result.entries[1].version).toBe('Unreleased-B')
  })

  it('falls back to localeCompare for non-semver versions', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2024-a-release', { sections: [] }),
        createChangelogEntry('2024-c-release', { sections: [] }),
        createChangelogEntry('2024-b-release', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntries(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['2024-c-release', '2024-b-release', '2024-a-release'])
  })
})

describe('sortEntriesByDate', () => {
  it('sorts entries by date in descending order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] }),
        createChangelogEntry('2.0.0', { date: '2024-06-01', sections: [] }),
        createChangelogEntry('3.0.0', { date: '2024-03-01', sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['2.0.0', '3.0.0', '1.0.0'])
  })

  it('keeps unreleased at top', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', { date: '2024-06-01', sections: [] }),
        createChangelogEntry('Unreleased', { unreleased: true, sections: [] }),
        createChangelogEntry('2.0.0', { date: '2024-01-01', sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries[0].unreleased).toBe(true)
  })

  it('puts entries without dates after dated entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { date: '2024-01-01', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries[0].version).toBe('2.0.0')
    expect(result.entries[1].version).toBe('1.0.0')
  })

  it('keeps multiple unreleased entries in original order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('Unreleased-A', { unreleased: true, sections: [] }),
        createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] }),
        createChangelogEntry('Unreleased-B', { unreleased: true, sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries[0].version).toBe('Unreleased-A')
    expect(result.entries[1].version).toBe('Unreleased-B')
  })

  it('keeps entries without dates in original order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries[0].version).toBe('2.0.0')
    expect(result.entries[1].version).toBe('1.0.0')
  })
})

describe('normalizeSectionHeadings', () => {
  it('normalizes section headings to standard format', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'FEATURES', [createChangelogItem('Feature')]),
            createChangelogSection('fixes', 'bug fixes', [createChangelogItem('Fix')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = normalizeSectionHeadings(changelog)
    expect(result.entries[0].sections[0].heading).toBe('Features')
    expect(result.entries[0].sections[1].heading).toBe('Bug Fixes')
  })

  it('normalizes across all entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'added', [createChangelogItem('Feature')])],
        }),
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'ADDED', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = normalizeSectionHeadings(changelog)
    expect(result.entries[0].sections[0].heading).toBe(result.entries[1].sections[0].heading)
  })
})

describe('compact', () => {
  it('removes empty sections and entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
            createChangelogSection('fixes', 'Fixes', []),
          ],
        }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = compact(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sections).toHaveLength(1)
  })

  it('preserves non-empty content', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature A'), createChangelogItem('Feature B')]),
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = compact(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sections).toHaveLength(2)
  })

  it('keeps empty unreleased entry by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('Unreleased', { unreleased: true, sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = compact(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].unreleased).toBe(true)
  })

  it('removes empty unreleased entry when keepUnreleased is false', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('Unreleased', { unreleased: true, sections: [] }),
        createChangelogEntry('1.0.0', { sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = compact(changelog, false)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('1.0.0')
  })

  it('preserves entries with rawContent even if no sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', { rawContent: 'Some raw content', sections: [] }),
        createChangelogEntry('0.9.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = compact(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('1.0.0')
    expect(result.entries[0].rawContent).toBe('Some raw content')
  })
})

describe('cloneChangelog', () => {
  it('creates a deep copy', () => {
    const original = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const clone = cloneChangelog(original)
    expect(clone).toEqual(original)
    expect(clone).not.toBe(original)
    expect(clone.entries).not.toBe(original.entries)
    expect(clone.entries[0]).not.toBe(original.entries[0])
    expect(clone.entries[0].sections[0]).not.toBe(original.entries[0].sections[0])
  })

  it('modifications to clone do not affect original', () => {
    const original = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const clone = cloneChangelog(original)
    // Verify it's a deep copy by checking reference inequality
    expect(clone).not.toBe(original)
    expect(clone.entries).not.toBe(original.entries)
    expect(clone.header).not.toBe(original.header)
  })
})

describe('sortSections', () => {
  it('sorts sections in standard order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')]),
            createChangelogSection('breaking', 'Breaking', [createChangelogItem('Breaking')]),
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortSections(changelog)
    expect(result.entries[0].sections.map((s) => s.type)).toEqual(['breaking', 'features', 'fixes'])
  })

  it('sorts across all entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [
            createChangelogSection('deprecations', 'Deprecated', [createChangelogItem('Old')]),
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
          ],
        }),
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')]),
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortSections(changelog)
    expect(result.entries[0].sections[0].type).toBe('features')
    expect(result.entries[1].sections[0].type).toBe('features')
  })
})

describe('reverseEntries', () => {
  it('reverses entry order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = reverseEntries(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['1.0.0', '2.0.0', '3.0.0'])
  })
})

describe('deduplicateItems', () => {
  it('removes duplicate items within sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature A'),
              createChangelogItem('Feature A'),
              createChangelogItem('Feature B'),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = deduplicateItems(changelog)
    expect(result.entries[0].sections[0].items).toHaveLength(2)
  })

  it('preserves first occurrence', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              { description: 'Feature', scope: 'first', breaking: false, commits: [], references: [] },
              { description: 'Feature', scope: 'second', breaking: false, commits: [], references: [] },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = deduplicateItems(changelog)
    expect(result.entries[0].sections[0].items[0].scope).toBe('first')
  })

  it('deduplicates across all entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature'), createChangelogItem('Feature')])],
        }),
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature'), createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = deduplicateItems(changelog)
    expect(result.entries[0].sections[0].items).toHaveLength(1)
    expect(result.entries[1].sections[0].items).toHaveLength(1)
  })
})

describe('stripMetadata', () => {
  it('removes optional metadata fields and clears warnings', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: {
        format: 'keep-a-changelog',
        isConventional: true,
        repositoryUrl: 'https://github.com/test/repo',
        packageName: '@test/pkg',
        warnings: ['Some warning'],
      },
    })

    const result = stripMetadata(changelog)
    expect(result.metadata.format).toBe('keep-a-changelog')
    expect(result.metadata.isConventional).toBe(true)
    expect(result.metadata.repositoryUrl).toBeUndefined()
    expect(result.metadata.packageName).toBeUndefined()
    expect(result.metadata.warnings).toEqual([])
    expect(result.source).toBeUndefined()
  })

  it('preserves entries and header', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: ['Description'], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'keep-a-changelog', isConventional: true, warnings: [] },
    })

    const result = stripMetadata(changelog)
    expect(result.header.title).toBe('# Changelog')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sections[0].items[0].description).toBe('Feature')
  })
})
