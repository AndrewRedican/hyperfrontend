import { createChangelog, createChangelogEntry, createChangelogItem, createChangelogSection } from '../models'
import { diffChangelogs, diffEntries, summarizeDiff } from './diff'

describe('diffChangelogs', () => {
  it('identifies identical changelogs', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(changelog, changelog)
    expect(diff.identical).toBe(true)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('identifies added entries', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    expect(diff.identical).toBe(false)
    expect(diff.added).toHaveLength(1)
    expect(diff.added[0].version).toBe('2.0.0')
    expect(diff.removed).toHaveLength(0)
  })

  it('identifies removed entries', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    expect(diff.identical).toBe(false)
    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].version).toBe('1.0.0')
    expect(diff.added).toHaveLength(0)
  })

  it('identifies modified entries', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { date: '2024-01-02', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    expect(diff.identical).toBe(false)
    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].version).toBe('1.0.0')
    expect(diff.modified[0].changes).toContainEqual(
      expect.objectContaining({
        path: ['date'],
        type: 'changed',
        oldValue: '2024-01-01',
        newValue: '2024-01-02',
      })
    )
  })

  it('reports correct stats', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] }), createChangelogEntry('3.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    expect(diff.stats.addedCount).toBe(1)
    expect(diff.stats.removedCount).toBe(1)
    expect(diff.stats.modifiedCount).toBe(1)
  })
})

describe('diffEntries', () => {
  it('detects section changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', []), createChangelogSection('fixes', 'Bug Fixes', [])],
    })

    const diff = diffEntries(source, target)
    expect(diff.addedSections).toHaveLength(1)
    expect(diff.addedSections[0].type).toBe('fixes')
  })

  it('detects date added (null to value)', () => {
    const source = createChangelogEntry('1.0.0', { date: null, sections: [] })
    const target = createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['date'],
      type: 'added',
      oldValue: null,
      newValue: '2024-01-01',
    })
  })

  it('detects date removed (value to null)', () => {
    const source = createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })
    const target = createChangelogEntry('1.0.0', { date: null, sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['date'],
      type: 'removed',
      oldValue: '2024-01-01',
      newValue: null,
    })
  })

  it('detects unreleased flag changes', () => {
    const source = createChangelogEntry('1.0.0', { unreleased: false, sections: [] })
    const target = createChangelogEntry('1.0.0', { unreleased: true, sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['unreleased'],
      type: 'changed',
      oldValue: false,
      newValue: true,
    })
  })

  it('detects compareUrl added', () => {
    const source = createChangelogEntry('1.0.0', { sections: [] })
    const target = createChangelogEntry('1.0.0', { compareUrl: 'https://example.com/compare', sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['compareUrl'],
      type: 'added',
      oldValue: undefined,
      newValue: 'https://example.com/compare',
    })
  })

  it('detects compareUrl removed', () => {
    const source = createChangelogEntry('1.0.0', { compareUrl: 'https://example.com/compare', sections: [] })
    const target = createChangelogEntry('1.0.0', { sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['compareUrl'],
      type: 'removed',
      oldValue: 'https://example.com/compare',
      newValue: undefined,
    })
  })

  it('detects compareUrl changed', () => {
    const source = createChangelogEntry('1.0.0', { compareUrl: 'https://old.com', sections: [] })
    const target = createChangelogEntry('1.0.0', { compareUrl: 'https://new.com', sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['compareUrl'],
      type: 'changed',
      oldValue: 'https://old.com',
      newValue: 'https://new.com',
    })
  })

  it('detects rawContent added', () => {
    const source = createChangelogEntry('1.0.0', { sections: [] })
    const target = createChangelogEntry('1.0.0', { rawContent: 'Some raw content', sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['rawContent'],
      type: 'added',
      oldValue: undefined,
      newValue: 'Some raw content',
    })
  })

  it('detects rawContent removed', () => {
    const source = createChangelogEntry('1.0.0', { rawContent: 'Some raw content', sections: [] })
    const target = createChangelogEntry('1.0.0', { sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['rawContent'],
      type: 'removed',
      oldValue: 'Some raw content',
      newValue: undefined,
    })
  })

  it('detects rawContent changed', () => {
    const source = createChangelogEntry('1.0.0', { rawContent: 'Old content', sections: [] })
    const target = createChangelogEntry('1.0.0', { rawContent: 'New content', sections: [] })

    const diff = diffEntries(source, target)
    expect(diff.changes).toContainEqual({
      path: ['rawContent'],
      type: 'changed',
      oldValue: 'Old content',
      newValue: 'New content',
    })
  })

  it('detects removed sections', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', []), createChangelogSection('fixes', 'Bug Fixes', [])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [])],
    })

    const diff = diffEntries(source, target)
    expect(diff.removedSections).toHaveLength(1)
    expect(diff.removedSections[0].type).toBe('fixes')
  })

  it('detects modified sections with added items', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('existing feature')])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [createChangelogItem('existing feature'), createChangelogItem('new feature')]),
      ],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections).toHaveLength(1)
    expect(diff.modifiedSections[0].type).toBe('features')
    expect(diff.modifiedSections[0].addedItems).toHaveLength(1)
    expect(diff.modifiedSections[0].addedItems[0].description).toBe('new feature')
  })

  it('detects modified sections with removed items', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [createChangelogItem('existing feature'), createChangelogItem('old feature')]),
      ],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('existing feature')])],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections).toHaveLength(1)
    expect(diff.modifiedSections[0].removedItems).toHaveLength(1)
    expect(diff.modifiedSections[0].removedItems[0].description).toBe('old feature')
  })

  it('detects modified items with scope changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature', { scope: 'core' })])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature', { scope: 'api' })])],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections).toHaveLength(1)
    expect(diff.modifiedSections[0].modifiedItems).toHaveLength(1)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual({
      path: ['scope'],
      type: 'changed',
      oldValue: 'core',
      newValue: 'api',
    })
  })

  it('detects scope added', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature')])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature', { scope: 'api' })])],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual({
      path: ['scope'],
      type: 'added',
      oldValue: undefined,
      newValue: 'api',
    })
  })

  it('detects scope removed', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature', { scope: 'api' })])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature')])],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual({
      path: ['scope'],
      type: 'removed',
      oldValue: 'api',
      newValue: undefined,
    })
  })

  it('detects breaking flag changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature', { breaking: false })])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('feature', { breaking: true })])],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual({
      path: ['breaking'],
      type: 'changed',
      oldValue: false,
      newValue: true,
    })
  })

  it('detects commit ref changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [
          createChangelogItem('feature', { commits: [{ hash: 'abc123', shortHash: 'abc123' }] }),
        ]),
      ],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [
          createChangelogItem('feature', { commits: [{ hash: 'def456', shortHash: 'def456' }] }),
        ]),
      ],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual(
      expect.objectContaining({
        path: ['commits'],
        type: 'changed',
      })
    )
  })

  it('detects commit ref length changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [
          createChangelogItem('feature', { commits: [{ hash: 'abc123', shortHash: 'abc123' }] }),
        ]),
      ],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [
          createChangelogItem('feature', {
            commits: [
              { hash: 'abc123', shortHash: 'abc123' },
              { hash: 'def456', shortHash: 'def456' },
            ],
          }),
        ]),
      ],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual(
      expect.objectContaining({
        path: ['commits'],
        type: 'changed',
      })
    )
  })

  it('detects issue ref changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [createChangelogItem('feature', { references: [{ number: 1, type: 'issue' }] })]),
      ],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [createChangelogItem('feature', { references: [{ number: 2, type: 'issue' }] })]),
      ],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual(
      expect.objectContaining({
        path: ['references'],
        type: 'changed',
      })
    )
  })

  it('detects issue ref length changes', () => {
    const source = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [createChangelogItem('feature', { references: [{ number: 1, type: 'issue' }] })]),
      ],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [
        createChangelogSection('features', 'Features', [
          createChangelogItem('feature', {
            references: [
              { number: 1, type: 'issue' },
              { number: 2, type: 'issue' },
            ],
          }),
        ]),
      ],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].changes).toContainEqual(
      expect.objectContaining({
        path: ['references'],
        type: 'changed',
      })
    )
  })

  it('includes source and target in item diff', () => {
    const sourceItem = createChangelogItem('feature', { scope: 'core' })
    const targetItem = createChangelogItem('feature', { scope: 'api' })
    const source = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [sourceItem])],
    })
    const target = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [targetItem])],
    })

    const diff = diffEntries(source, target)
    expect(diff.modifiedSections[0].modifiedItems[0].source).toEqual(sourceItem)
    expect(diff.modifiedSections[0].modifiedItems[0].target).toEqual(targetItem)
    expect(diff.modifiedSections[0].modifiedItems[0].sourceDescription).toBe('feature')
  })
})

describe('summarizeDiff', () => {
  it('summarizes identical changelogs', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(changelog, changelog)
    expect(summarizeDiff(diff)).toBe('Changelogs are identical')
  })

  it('summarizes changes', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    const summary = summarizeDiff(diff)
    expect(summary).toContain('Added 1 version(s): 2.0.0')
  })

  it('summarizes removed entries', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    const summary = summarizeDiff(diff)
    expect(summary).toContain('Removed 1 version(s): 1.0.0')
  })

  it('summarizes modified entries', () => {
    const source = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const target = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { date: '2024-01-02', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const diff = diffChangelogs(source, target)
    const summary = summarizeDiff(diff)
    expect(summary).toContain('Modified 1 version(s): 1.0.0')
  })
})
