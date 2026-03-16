import type { Changelog } from '../models/changelog'
import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '../models'
import { addEntry, addUnreleasedEntry, releaseUnreleased } from './add-entry'

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

describe('addEntry', () => {
  it('adds a new entry to the changelog', () => {
    const changelog = createTestChangelog()
    const newEntry = createChangelogEntry('3.0.0', {
      date: '2024-03-01',
      sections: [],
    })

    const result = addEntry(changelog, newEntry)

    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].version).toBe('3.0.0')
  })

  it('adds entry at specified position', () => {
    const changelog = createTestChangelog()
    const newEntry = createChangelogEntry('1.5.0', {
      date: '2024-01-15',
      sections: [],
    })

    const result = addEntry(changelog, newEntry, { position: 1 })

    expect(result.entries[1].version).toBe('1.5.0')
  })

  it('adds entry at end position', () => {
    const changelog = createTestChangelog()
    const newEntry = createChangelogEntry('0.1.0', {
      date: '2023-01-01',
      sections: [],
    })

    const result = addEntry(changelog, newEntry, { position: 'end' })

    expect(result.entries[result.entries.length - 1].version).toBe('0.1.0')
  })

  it('throws error for duplicate version without replaceExisting', () => {
    const changelog = createTestChangelog()
    const duplicateEntry = createChangelogEntry('2.0.0', {
      date: '2024-03-01',
      sections: [],
    })

    expect(() => addEntry(changelog, duplicateEntry)).toThrow('already exists')
  })

  it('replaces existing entry with replaceExisting option', () => {
    const changelog = createTestChangelog()
    const newEntry = createChangelogEntry('2.0.0', {
      date: '2024-12-01',
      sections: [],
    })

    const result = addEntry(changelog, newEntry, { replaceExisting: true })

    expect(result.entries).toHaveLength(2)
    const entry = result.entries.find((e) => e.version === '2.0.0')
    expect(entry?.date).toBe('2024-12-01')
  })

  it('updates metadata when updateMetadata is true', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'keep-a-changelog', isConventional: true, warnings: ['old warning'] },
    })
    const newEntry = createChangelogEntry('2.0.0', { sections: [] })

    const result = addEntry(changelog, newEntry, { updateMetadata: true })

    expect(result.metadata.warnings).toEqual([])
  })
})

describe('addUnreleasedEntry', () => {
  it('adds an Unreleased entry at the beginning', () => {
    const changelog = createTestChangelog()
    const result = addUnreleasedEntry(changelog, [])

    expect(result.entries[0].version).toBe('Unreleased')
    expect(result.entries).toHaveLength(3)
  })

  it('does not add duplicate Unreleased entry', () => {
    const changelog = createTestChangelog()
    const withUnreleased = addUnreleasedEntry(changelog, [])
    const result = addUnreleasedEntry(withUnreleased, [])

    expect(result.entries.filter((e) => e.version === 'Unreleased')).toHaveLength(1)
  })
})

describe('releaseUnreleased', () => {
  it('converts Unreleased to versioned entry', () => {
    const changelog = addUnreleasedEntry(createTestChangelog(), [])
    const result = releaseUnreleased(changelog, '3.0.0', '2024-03-01')

    expect(result.entries[0].version).toBe('3.0.0')
    expect(result.entries[0].date).toBe('2024-03-01')
  })

  it('throws error if no Unreleased entry', () => {
    const changelog = createTestChangelog()

    expect(() => releaseUnreleased(changelog, '3.0.0', '2024-03-01')).toThrow('No unreleased entry found')
  })
})
