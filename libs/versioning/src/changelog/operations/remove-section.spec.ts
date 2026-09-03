import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '../models'
import { removeSection, removeItem, removeEmptySections, removeEmptyEntries } from './remove-section'

describe('removeSection', () => {
  it('removes a section from an entry', () => {
    const changelog = createChangelog({
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

    const result = removeSection(changelog, '1.0.0', 'features')
    expect(result.entries[0].sections).toHaveLength(1)
    expect(result.entries[0].sections[0].type).toBe('fixes')
  })

  it('throws error when version not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeSection(changelog, '2.0.0', 'features')).toThrow('Entry with version "2.0.0" not found')
  })

  it('returns unchanged if version not found', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeSection(changelog, '2.0.0', 'features', { throwIfNotFound: false })
    expect(result.entries[0].sections).toHaveLength(1)
  })

  it('throws error when section not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeSection(changelog, '1.0.0', 'fixes')).toThrow('Section with type "fixes" not found in version "1.0.0"')
  })

  it('returns unchanged if section not found with throwIfNotFound false', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeSection(changelog, '1.0.0', 'fixes', { throwIfNotFound: false })
    expect(result.entries[0].sections).toHaveLength(1)
  })
})

describe('removeItem', () => {
  it('removes an item by description', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A'), createChangelogItem('Feature B')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeItem(changelog, '1.0.0', 'features', 'Feature A')
    expect(result.entries[0].sections[0].items).toHaveLength(1)
    expect(result.entries[0].sections[0].items[0].description).toBe('Feature B')
  })

  it('throws error when version not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeItem(changelog, '2.0.0', 'features', 'Feature A')).toThrow('Entry with version "2.0.0" not found')
  })

  it('returns unchanged if version not found', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeItem(changelog, '2.0.0', 'features', 'Feature A', { throwIfNotFound: false })
    expect(result.entries[0].sections[0].items).toHaveLength(1)
  })

  it('throws error when section not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeItem(changelog, '1.0.0', 'fixes', 'Feature A')).toThrow('Section with type "fixes" not found in version "1.0.0"')
  })

  it('returns unchanged if section not found with throwIfNotFound false', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeItem(changelog, '1.0.0', 'fixes', 'Feature A', { throwIfNotFound: false })
    expect(result.entries[0].sections[0].items).toHaveLength(1)
  })

  it('throws error when item not found by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(() => removeItem(changelog, '1.0.0', 'features', 'Feature B')).toThrow(
      'Item with description "Feature B" not found in section "features"'
    )
  })

  it('returns unchanged if item not found with throwIfNotFound false', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature A')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeItem(changelog, '1.0.0', 'features', 'Feature B', { throwIfNotFound: false })
    expect(result.entries[0].sections[0].items).toHaveLength(1)
  })
})

describe('removeEmptySections', () => {
  it('removes sections with no items', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [createChangelogItem('Feature')]),
            createChangelogSection('fixes', 'Fixes', []),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptySections(changelog)
    expect(result.entries[0].sections).toHaveLength(1)
    expect(result.entries[0].sections[0].type).toBe('features')
  })

  it('removes empty sections from all entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [])],
        }),
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', []),
            createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptySections(changelog)
    expect(result.entries[0].sections).toHaveLength(0)
    expect(result.entries[1].sections).toHaveLength(1)
  })

  it('keeps all sections when none are empty', () => {
    const changelog = createChangelog({
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

    const result = removeEmptySections(changelog)
    expect(result.entries[0].sections).toHaveLength(2)
  })
})

describe('removeEmptyEntries', () => {
  it('removes entries with no sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('2.0.0')
  })

  it('removes entries with only empty sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('2.0.0')
  })

  it('keeps all entries when none are empty', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('fixes', 'Fixes', [createChangelogItem('Fix')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog)
    expect(result.entries).toHaveLength(2)
  })

  it('handles changelog with all empty entries', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog)
    expect(result.entries).toHaveLength(0)
  })

  it('keeps empty unreleased entry by default', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('Unreleased', { sections: [], unreleased: true }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].unreleased).toBe(true)
  })

  it('removes empty unreleased entry when keepUnreleased is false', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('Unreleased', { sections: [], unreleased: true }),
        createChangelogEntry('1.0.0', { sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog, false)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('1.0.0')
  })

  it('keeps entry with rawContent even if no sections', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', { sections: [], rawContent: 'Some raw content' }),
        createChangelogEntry('1.0.0', { sections: [] }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = removeEmptyEntries(changelog)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].version).toBe('2.0.0')
  })
})
