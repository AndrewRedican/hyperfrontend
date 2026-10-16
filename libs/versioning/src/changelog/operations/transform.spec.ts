import { describe, expect, it } from '@hyperfrontend/testing'
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
    expect(result.entries.map((e) => e.date)).toEqual(['2024-01-01', '2024-01-01'])
  })

  it('can transform entries conditionally', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('Unreleased', { unreleased: true, sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformEntries(changelog, (entry) => (entry.unreleased ? { ...entry, version: '[Unreleased]' } : entry))
    expect(result.entries.map((e) => e.version)).toEqual(['[Unreleased]', '1.0.0'])
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
    expect(result).toMatchObject({ entries: [{ sections: [{ heading: 'Changed' }] }] })
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
    expect(result).toMatchObject({ entries: [{ sections: [{ heading: 'Features' }, { heading: 'Legacy' }] }] })
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
    expect(result).toMatchObject({ entries: [{ sections: [{ items: [{ description: 'Changed' }] }] }] })
  })

  it('can transform items conditionally', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature A'),
              { description: 'WIP', scope: undefined, breaking: false, commits: [], references: [] },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = transformItems(changelog, (item) => (item.description === 'WIP' ? { ...item, description: 'Work In Progress' } : item))
    expect(result).toMatchObject({
      entries: [{ sections: [{ items: [{ description: 'Feature A' }, { description: 'Work In Progress' }] }] }],
    })
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
    expect(result.entries.map((e) => e.date)).toEqual([null, '2024-01-01'])
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
    expect(result).toMatchObject({ entries: [{ date: '2025-01-01' }] })
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
    expect(result.entries.map((e) => e.version)).toEqual(['Unreleased', '2.0.0', '1.0.0'])
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
    expect(result.entries.map((e) => e.version)).toEqual(['Unreleased-A', 'Unreleased-B', '1.0.0'])
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
    expect(result.entries[0]?.unreleased).toBe(true)
  })

  it('puts entries without dates after dated entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { date: '2024-01-01', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['2.0.0', '1.0.0'])
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
    expect(result.entries.map((e) => e.version)).toEqual(['Unreleased-A', 'Unreleased-B', '1.0.0'])
  })

  it('keeps entries without dates in original order', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = sortEntriesByDate(changelog)
    expect(result.entries.map((e) => e.version)).toEqual(['2.0.0', '1.0.0'])
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
    expect(result).toMatchObject({ entries: [{ sections: [{ heading: 'Features' }, { heading: 'Bug Fixes' }] }] })
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
    expect(result.entries.flatMap((e) => e.sections.map((s) => s.heading))).toEqual(['Features', 'Features'])
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
    expect(result).toMatchObject({ entries: [{ version: '2.0.0', sections: [{ type: 'features' }] }] })
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
    expect(result).toEqual(changelog)
  })

  it('keeps empty unreleased entry by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('Unreleased', { unreleased: true, sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = compact(changelog)
    expect(result).toMatchObject({ entries: [{ unreleased: true }] })
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
    expect(result).toMatchObject({ entries: [{ version: '1.0.0' }] })
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
    expect(result).toMatchObject({ entries: [{ version: '1.0.0', rawContent: 'Some raw content' }] })
  })
})

describe('cloneChangelog', () => {
  const original = createChangelog({
    header: { title: '#', description: [], links: [] },
    entries: [
      createChangelogEntry('1.0.0', {
        sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
      }),
    ],
    metadata: { format: 'unknown', isConventional: false, warnings: [] },
  })

  it('creates a structurally equal copy', () => {
    const clone = cloneChangelog(original)
    expect(clone).toEqual(original)
  })

  it('shares no object with the original at any nesting level', () => {
    const clone = cloneChangelog(original)
    const cloneSection = clone.entries[0]?.sections[0]
    const originalSection = original.entries[0]?.sections[0]
    const cloneItem = cloneSection?.items[0]
    const originalItem = originalSection?.items[0]
    expect({
      changelog: clone === original,
      header: clone.header === original.header,
      headerDescription: clone.header.description === original.header.description,
      headerLinks: clone.header.links === original.header.links,
      entries: clone.entries === original.entries,
      entry: clone.entries[0] === original.entries[0],
      sections: clone.entries[0]?.sections === original.entries[0]?.sections,
      section: cloneSection === originalSection,
      items: cloneSection?.items === originalSection?.items,
      item: cloneItem === originalItem,
      itemCommits: cloneItem?.commits === originalItem?.commits,
      itemReferences: cloneItem?.references === originalItem?.references,
      metadata: clone.metadata === original.metadata,
      metadataWarnings: clone.metadata.warnings === original.metadata.warnings,
    }).toEqual({
      changelog: false,
      header: false,
      headerDescription: false,
      headerLinks: false,
      entries: false,
      entry: false,
      sections: false,
      section: false,
      items: false,
      item: false,
      itemCommits: false,
      itemReferences: false,
      metadata: false,
      metadataWarnings: false,
    })
  })

  it('gives the clone its own header and entries objects', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const clone = cloneChangelog(source)
    expect({
      changelog: clone === source,
      entries: clone.entries === source.entries,
      header: clone.header === source.header,
    }).toEqual({ changelog: false, entries: false, header: false })
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
    expect(result.entries[0]?.sections.map((s) => s.type)).toEqual(['breaking', 'features', 'fixes'])
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
    expect(result.entries.map((e) => e.sections[0]?.type)).toEqual(['features', 'features'])
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
    expect(result.entries[0]?.sections[0]?.items).toHaveLength(2)
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
    expect(result.entries[0]?.sections[0]?.items[0]?.scope).toBe('first')
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
    expect(result.entries.map((e) => e.sections[0]?.items.map((item) => item.description))).toEqual([['Feature'], ['Feature']])
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
    expect({ source: result.source, metadata: result.metadata }).toEqual({
      source: undefined,
      metadata: { format: 'keep-a-changelog', isConventional: true, warnings: [] },
    })
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
    expect(result).toEqual(expect.objectContaining({ header: changelog.header, entries: changelog.entries }))
  })
})
