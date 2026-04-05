import { createChangelog, createChangelogEntry } from '../models'
import { removeEntry, removeEntries, removeUnreleased } from './remove-entry'

describe('removeEntry', () => {
  it('removes an entry by version', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEntry(changelog, '1.0.0')
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
  })

  it('returns unchanged changelog if version not found', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEntry(changelog, '2.0.0', { throwIfNotFound: false })
    expect(result.entries).toHaveLength(1)
  })

  it('throws error if version not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeEntry(changelog, '2.0.0')).toThrow('Entry with version "2.0.0" not found')
  })
})

describe('removeEntries', () => {
  it('removes multiple entries by version', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('3.0.0', { sections: [] }),
        createChangelogEntry('2.0.0', { sections: [] }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEntries(changelog, ['1.0.0', '3.0.0'])
    expect(result.entries).toEqual([expect.objectContaining({ version: '2.0.0' })])
  })

  it('ignores versions not found', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEntries(changelog, ['2.0.0', '3.0.0'], { throwIfNotFound: false })
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })

  it('throws error for versions not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeEntries(changelog, ['2.0.0', '3.0.0'])).toThrow('Entries not found for versions: 2.0.0, 3.0.0')
  })
})

describe('removeUnreleased', () => {
  it('removes unreleased entry', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('Unreleased', { unreleased: true, sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeUnreleased(changelog)
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })

  it('returns unchanged changelog if no unreleased', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeUnreleased(changelog, { throwIfNotFound: false })
    expect(result.entries).toEqual([expect.objectContaining({ version: '1.0.0' })])
  })

  it('throws error if no unreleased entry by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeUnreleased(changelog)).toThrow('No unreleased entry found')
  })
})
