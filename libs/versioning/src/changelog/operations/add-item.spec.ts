import type { Changelog } from '../models/changelog'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '../models'
import { addItemToEntry } from './add-item'

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

describe('addItemToEntry', () => {
  it('adds item to existing section', () => {
    const changelog = createTestChangelog()
    const item = createChangelogItem('New item')

    const result = addItemToEntry(changelog, '2.0.0', 'features', item)

    const entry = result.entries.find((e) => e.version === '2.0.0')
    const section = entry?.sections.find((s) => s.type === 'features')
    expect(section?.items).toHaveLength(2)
  })

  it('creates section if it does not exist', () => {
    const changelog = createTestChangelog()
    const item = createChangelogItem('New fix')

    const result = addItemToEntry(changelog, '2.0.0', 'fixes', item)

    const entry = result.entries.find((e) => e.version === '2.0.0')
    const section = entry?.sections.find((s) => s.type === 'fixes')
    expect(section?.items).toHaveLength(1)
  })

  it('throws error for non-existent version', () => {
    const changelog = createTestChangelog()
    const item = createChangelogItem('New item')

    expect(() => addItemToEntry(changelog, '99.0.0', 'features', item)).toThrow('not found')
  })
})
