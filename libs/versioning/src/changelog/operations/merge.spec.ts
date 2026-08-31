import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createChangelog,
  createChangelogEntry,
  createChangelogSection,
  createChangelogItem,
  createCommitRef,
  createIssueRef,
} from '../models'
import { mergeChangelogs, appendChangelog, combineChangelogs } from './merge'

describe('mergeChangelogs', () => {
  it('merges two changelogs with union strategy', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { entryStrategy: 'union' })
    expect(result.changelog.entries).toHaveLength(2)
  })

  it('prefers source entries on conflict', () => {
    const sourceEntry = createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })
    const targetEntry = createChangelogEntry('1.0.0', { date: '2024-01-02', sections: [] })

    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [sourceEntry],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [targetEntry],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { entryStrategy: 'source' })
    expect(result?.changelog?.entries[0]).toEqual(expect.objectContaining({ date: '2024-01-01' }))
  })

  it('prefers target entries on conflict', () => {
    const sourceEntry = createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })
    const targetEntry = createChangelogEntry('1.0.0', { date: '2024-01-02', sections: [] })

    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [sourceEntry],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [targetEntry],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { entryStrategy: 'target' })
    expect(result?.changelog?.entries[0]).toEqual(expect.objectContaining({ date: '2024-01-02' }))
  })

  it('uses target header when useSourceHeader is false', () => {
    const source = createChangelog({
      header: { title: '# Source', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '# Target', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { useSourceHeader: false })
    expect(result.changelog.header.title).toBe('# Target')
  })

  it('merges sections with source strategy', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Source feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Added', [createChangelogItem('Target feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { sectionStrategy: 'source' })
    expect(result?.changelog?.entries[0]?.sections[0]).toEqual(expect.objectContaining({ heading: 'Features' }))
  })

  it('merges sections with target strategy', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Source feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Added', [createChangelogItem('Target feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { sectionStrategy: 'target' })
    expect(result?.changelog?.entries[0]?.sections[0]).toEqual(expect.objectContaining({ heading: 'Added' }))
  })

  it('merges items with source strategy', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Source feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Target feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'source' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toEqual([expect.objectContaining({ description: 'Source feature' })])
  })

  it('merges items with target strategy', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Source feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Target feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'target' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toEqual([expect.objectContaining({ description: 'Target feature' })])
  })

  it('merges items with union strategy combining unique items', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature B')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'union' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toHaveLength(2)
  })

  it('reports correct stats for merge', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { date: '2024-01-01', sections: [] }), createChangelogEntry('3.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.stats.sourceOnly).toBe(1)
    expect(result.stats.targetOnly).toBe(1)
    expect(result.stats.merged).toBe(1)
  })

  it('merges items with latest strategy replacing by description', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              { description: 'Same feature', scope: 'old', breaking: false, commits: [], references: [] },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              { description: 'Same feature', scope: 'new', breaking: false, commits: [], references: [] },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'latest' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toEqual([expect.objectContaining({ scope: 'new' })])
  })

  it('uses target date with entryStrategy target', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          compareUrl: 'https://source.com',
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-06-01',
          compareUrl: 'https://target.com',
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { entryStrategy: 'target' })
    expect(result.changelog.entries[0]).toEqual(expect.objectContaining({ date: '2024-06-01', compareUrl: 'https://target.com' }))
  })

  it('merges unreleased entries from both changelogs', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('Unreleased', {
          unreleased: true,
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Source Unreleased')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('Unreleased', {
          unreleased: true,
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Target Unreleased')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.changelog.entries[0]).toEqual(expect.objectContaining({ unreleased: true }))
  })

  it('handles entry only in source', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.changelog.entries).toHaveLength(1)
    expect(result.stats.sourceOnly).toBe(1)
  })

  it('handles entry only in target', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.changelog.entries).toHaveLength(1)
    expect(result.stats.targetOnly).toBe(1)
  })

  it('handles section only in source during merge', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.changelog.entries[0]?.sections).toHaveLength(2)
  })

  it('handles section only in target during merge', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.changelog.entries[0]?.sections).toHaveLength(2)
  })

  it('deduplicates identical items in union merge', () => {
    const sharedItem = createChangelogItem('Shared feature')
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [sharedItem, createChangelogItem('Source only')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [sharedItem, createChangelogItem('Target only')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'union' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toHaveLength(3)
  })

  it('does not report conflict for identical entries', () => {
    const entry = createChangelogEntry('1.0.0', {
      date: '2024-01-01',
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
    })
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [entry],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [entry],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target)
    expect(result.changelog.entries).toHaveLength(1)
    expect(result.stats.conflictsResolved).toBe(0)
  })
})

describe('appendChangelog', () => {
  it('appends entries from second changelog', () => {
    const first = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const second = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = appendChangelog(first, second)
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' }), expect.objectContaining({ version: '2.0.0' })])
  })

  it('preserves order when appending', () => {
    const first = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const second = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('4.0.0', { sections: [] }), createChangelogEntry('3.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = appendChangelog(first, second)
    expect(result.entries.map((e) => e.version)).toEqual(['2.0.0', '1.0.0', '4.0.0', '3.0.0'])
  })
})

describe('combineChangelogs', () => {
  it('combines multiple changelogs', () => {
    const first = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const second = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const third = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('3.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = combineChangelogs([first, second, third])
    expect(result.entries).toHaveLength(3)
  })
})

describe('mergeItems edge cases', () => {
  it('latest strategy replaces item with matching description from different source', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              { description: 'Feature X', scope: undefined, breaking: false, commits: [createCommitRef('abc123')], references: [] },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              {
                description: 'Feature X',
                scope: 'core',
                breaking: true,
                commits: [createCommitRef('def456')],
                references: [createIssueRef(123)],
              },
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'latest' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toEqual([expect.objectContaining({ scope: 'core', breaking: true })])
  })

  it('latest strategy adds new items when description does not match', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature B')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { itemStrategy: 'latest' })
    expect(result.changelog.entries[0]?.sections[0]?.items).toHaveLength(2)
  })

  it('merges sections with different items calling mergeSection', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Only in source')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Only in target')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = mergeChangelogs(source, target, { sectionStrategy: 'target', itemStrategy: 'union' })
    expect(result.changelog.entries[0]?.sections[0]).toEqual(
      expect.objectContaining({
        heading: 'Features',
        items: expect.arrayContaining([
          expect.objectContaining({ description: 'Only in source' }),
          expect.objectContaining({ description: 'Only in target' }),
        ]),
      })
    )
  })
})
