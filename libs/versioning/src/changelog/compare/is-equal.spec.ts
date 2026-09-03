import type { Changelog } from '../models/changelog'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createChangelog,
  createChangelogEntry,
  createChangelogSection,
  createChangelogItem,
  createCommitRef,
  createIssueRef,
} from '../models'
import {
  isChangelogEqual,
  isEntryEqual,
  isSectionEqual,
  isItemEqual,
  isHeaderEqual,
  isLinkEqual,
  isMetadataEqual,
  isCommitRefEqual,
  isIssueRefEqual,
  haveSameVersions,
  hasVersion,
  getEntryByVersion,
} from './is-equal'

describe('isChangelogEqual', () => {
  const createTestChangelog = (): Changelog =>
    createChangelog({
      header: {
        title: '# Changelog',
        description: ['Test description'],
        links: [],
      },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature one')])],
        }),
      ],
      metadata: {
        format: 'keep-a-changelog',
        isConventional: false,
        warnings: [],
      },
    })

  it('returns true for identical changelogs', () => {
    const a = createTestChangelog()
    const b = createTestChangelog()

    expect(isChangelogEqual(a, b)).toBe(true)
  })

  it('returns false when headers differ', () => {
    const a = createTestChangelog()
    const b = createChangelog({
      ...a,
      header: { ...a.header, title: '# Different Title' },
    })

    expect(isChangelogEqual(a, b)).toBe(false)
  })

  it('returns false when entries differ', () => {
    const a = createTestChangelog()
    const b = createChangelog({
      ...a,
      entries: [...a.entries, createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] })],
    })

    expect(isChangelogEqual(a, b)).toBe(false)
  })

  it('returns false when metadata differs', () => {
    const a = createTestChangelog()
    const b = createChangelog({
      ...a,
      metadata: { ...a.metadata, format: 'conventional' },
    })

    expect(isChangelogEqual(a, b)).toBe(false)
  })

  it('returns false when sources differ', () => {
    const a = createChangelog({
      source: '/path/a',
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const b = createChangelog({
      source: '/path/b',
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    expect(isChangelogEqual(a, b)).toBe(false)
  })
})

describe('isEntryEqual', () => {
  it('returns true for identical entries', () => {
    const a = createChangelogEntry('1.0.0', {
      date: '2024-01-01',
      sections: [createChangelogSection('features', 'Features', [])],
    })
    const b = createChangelogEntry('1.0.0', {
      date: '2024-01-01',
      sections: [createChangelogSection('features', 'Features', [])],
    })

    expect(isEntryEqual(a, b)).toBe(true)
  })

  it('returns false when dates differ', () => {
    const a = createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] })
    const b = createChangelogEntry('1.0.0', { date: '2024-01-02', sections: [] })

    expect(isEntryEqual(a, b)).toBe(false)
  })

  it('returns false when unreleased flags differ', () => {
    const a = createChangelogEntry('Unreleased', { unreleased: true, sections: [] })
    const b = createChangelogEntry('Unreleased', { unreleased: false, sections: [] })

    expect(isEntryEqual(a, b)).toBe(false)
  })

  it('returns false when compareUrls differ', () => {
    const a = createChangelogEntry('1.0.0', { compareUrl: 'https://github.com/a/compare/v0.9.0...v1.0.0', sections: [] })
    const b = createChangelogEntry('1.0.0', { compareUrl: 'https://github.com/b/compare/v0.9.0...v1.0.0', sections: [] })

    expect(isEntryEqual(a, b)).toBe(false)
  })

  it('returns false when rawContent differs', () => {
    const a = createChangelogEntry('1.0.0', { rawContent: 'Some raw content', sections: [] })
    const b = createChangelogEntry('1.0.0', { rawContent: 'Different content', sections: [] })

    expect(isEntryEqual(a, b)).toBe(false)
  })

  it('returns false when section counts differ', () => {
    const a = createChangelogEntry('1.0.0', {
      sections: [createChangelogSection('features', 'Features', [])],
    })
    const b = createChangelogEntry('1.0.0', { sections: [] })

    expect(isEntryEqual(a, b)).toBe(false)
  })

  it('returns false when versions differ', () => {
    const a = createChangelogEntry('1.0.0', { sections: [] })
    const b = createChangelogEntry('2.0.0', { sections: [] })

    expect(isEntryEqual(a, b)).toBe(false)
  })
})

describe('haveSameVersions', () => {
  it('returns true when versions match', () => {
    const a = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const b = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(haveSameVersions(a, b)).toBe(true)
  })

  it('returns false when versions differ', () => {
    const a = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const b = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(haveSameVersions(a, b)).toBe(false)
  })

  it('returns false when entry counts differ', () => {
    const a = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const b = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(haveSameVersions(a, b)).toBe(false)
  })

  it('returns false when duplicate versions create different set sizes', () => {
    const a = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })
    const b = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    expect(haveSameVersions(a, b)).toBe(false)
  })
})

describe('hasVersion', () => {
  const changelog = createChangelog({
    header: { title: '#', description: [], links: [] },
    entries: [createChangelogEntry('1.0.0', { sections: [] }), createChangelogEntry('2.0.0', { sections: [] })],
    metadata: { format: 'unknown', isConventional: false, warnings: [] },
  })

  it('returns true for existing version', () => {
    expect(hasVersion(changelog, '1.0.0')).toBe(true)
    expect(hasVersion(changelog, '2.0.0')).toBe(true)
  })

  it('returns false for non-existing version', () => {
    expect(hasVersion(changelog, '3.0.0')).toBe(false)
  })
})

describe('getEntryByVersion', () => {
  const changelog = createChangelog({
    header: { title: '#', description: [], links: [] },
    entries: [
      createChangelogEntry('1.0.0', { date: '2024-01-01', sections: [] }),
      createChangelogEntry('2.0.0', { date: '2024-02-01', sections: [] }),
    ],
    metadata: { format: 'unknown', isConventional: false, warnings: [] },
  })

  it('returns entry for existing version', () => {
    const entry = getEntryByVersion(changelog, '1.0.0')
    expect(entry).toBeDefined()
    expect(entry?.version).toBe('1.0.0')
    expect(entry?.date).toBe('2024-01-01')
  })

  it('returns undefined for non-existing version', () => {
    expect(getEntryByVersion(changelog, '3.0.0')).toBeUndefined()
  })
})

describe('isHeaderEqual', () => {
  it('returns true for identical headers', () => {
    const a = { title: '# Changelog', description: ['Test'], links: [{ label: 'test', url: 'http://test' }] }
    const b = { title: '# Changelog', description: ['Test'], links: [{ label: 'test', url: 'http://test' }] }
    expect(isHeaderEqual(a, b)).toBe(true)
  })

  it('returns false when titles differ', () => {
    const a = { title: '# Changelog', description: [], links: [] }
    const b = { title: '# Changes', description: [], links: [] }
    expect(isHeaderEqual(a, b)).toBe(false)
  })

  it('returns false when descriptions differ', () => {
    const a = { title: '#', description: ['A'], links: [] }
    const b = { title: '#', description: ['B'], links: [] }
    expect(isHeaderEqual(a, b)).toBe(false)
  })

  it('returns false when description lengths differ', () => {
    const a = { title: '#', description: ['A', 'B'], links: [] }
    const b = { title: '#', description: ['A'], links: [] }
    expect(isHeaderEqual(a, b)).toBe(false)
  })

  it('returns false when links differ', () => {
    const a = { title: '#', description: [], links: [{ label: 'a', url: 'http://a' }] }
    const b = { title: '#', description: [], links: [{ label: 'b', url: 'http://b' }] }
    expect(isHeaderEqual(a, b)).toBe(false)
  })

  it('returns false when link counts differ', () => {
    const a = { title: '#', description: [], links: [{ label: 'a', url: 'http://a' }] }
    const b = { title: '#', description: [], links: [] }
    expect(isHeaderEqual(a, b)).toBe(false)
  })
})

describe('isLinkEqual', () => {
  it('returns true for identical links', () => {
    expect(isLinkEqual({ label: 'test', url: 'http://test' }, { label: 'test', url: 'http://test' })).toBe(true)
  })

  it('returns false when labels differ', () => {
    expect(isLinkEqual({ label: 'a', url: 'http://test' }, { label: 'b', url: 'http://test' })).toBe(false)
  })

  it('returns false when urls differ', () => {
    expect(isLinkEqual({ label: 'test', url: 'http://a' }, { label: 'test', url: 'http://b' })).toBe(false)
  })
})

describe('isSectionEqual', () => {
  it('returns true for identical sections', () => {
    const a = createChangelogSection('features', 'Features', [createChangelogItem('Item')])
    const b = createChangelogSection('features', 'Features', [createChangelogItem('Item')])
    expect(isSectionEqual(a, b)).toBe(true)
  })

  it('returns false when types differ', () => {
    const a = createChangelogSection('features', 'Features', [])
    const b = createChangelogSection('fixes', 'Features', [])
    expect(isSectionEqual(a, b)).toBe(false)
  })

  it('returns false when headings differ', () => {
    const a = createChangelogSection('features', 'Features', [])
    const b = createChangelogSection('features', 'Added', [])
    expect(isSectionEqual(a, b)).toBe(false)
  })

  it('returns false when item counts differ', () => {
    const a = createChangelogSection('features', 'Features', [createChangelogItem('Item1')])
    const b = createChangelogSection('features', 'Features', [createChangelogItem('Item1'), createChangelogItem('Item2')])
    expect(isSectionEqual(a, b)).toBe(false)
  })

  it('returns false when items differ', () => {
    const a = createChangelogSection('features', 'Features', [createChangelogItem('Item A')])
    const b = createChangelogSection('features', 'Features', [createChangelogItem('Item B')])
    expect(isSectionEqual(a, b)).toBe(false)
  })
})

describe('isItemEqual', () => {
  it('returns true for identical items', () => {
    const a = createChangelogItem('Test', { scope: 'api', breaking: true })
    const b = createChangelogItem('Test', { scope: 'api', breaking: true })
    expect(isItemEqual(a, b)).toBe(true)
  })

  it('returns false when scopes differ', () => {
    const a = createChangelogItem('Test', { scope: 'api' })
    const b = createChangelogItem('Test', { scope: 'core' })
    expect(isItemEqual(a, b)).toBe(false)
  })

  it('returns false when descriptions differ', () => {
    const a = createChangelogItem('Test A')
    const b = createChangelogItem('Test B')
    expect(isItemEqual(a, b)).toBe(false)
  })

  it('returns false when breaking flags differ', () => {
    const a = createChangelogItem('Test', { breaking: true })
    const b = createChangelogItem('Test', { breaking: false })
    expect(isItemEqual(a, b)).toBe(false)
  })

  it('returns false when commit counts differ', () => {
    const a = createChangelogItem('Test', { commits: [createCommitRef('abc1234567890123456789012345678901234567')] })
    const b = createChangelogItem('Test', { commits: [] })
    expect(isItemEqual(a, b)).toBe(false)
  })

  it('returns false when commits differ', () => {
    const a = createChangelogItem('Test', { commits: [createCommitRef('abc1234567890123456789012345678901234567')] })
    const b = createChangelogItem('Test', { commits: [createCommitRef('def1234567890123456789012345678901234567')] })
    expect(isItemEqual(a, b)).toBe(false)
  })

  it('returns false when reference counts differ', () => {
    const a = createChangelogItem('Test', { references: [createIssueRef(1, 'issue')] })
    const b = createChangelogItem('Test', { references: [] })
    expect(isItemEqual(a, b)).toBe(false)
  })

  it('returns false when references differ', () => {
    const a = createChangelogItem('Test', { references: [createIssueRef(1, 'issue')] })
    const b = createChangelogItem('Test', { references: [createIssueRef(2, 'issue')] })
    expect(isItemEqual(a, b)).toBe(false)
  })
})

describe('isCommitRefEqual', () => {
  it('returns true for identical commit refs', () => {
    const a = createCommitRef('abc1234567890123456789012345678901234567', 'http://example.com/abc')
    const b = createCommitRef('abc1234567890123456789012345678901234567', 'http://example.com/abc')
    expect(isCommitRefEqual(a, b)).toBe(true)
  })

  it('returns false when hashes differ', () => {
    const a = createCommitRef('abc1234567890123456789012345678901234567')
    const b = createCommitRef('def1234567890123456789012345678901234567')
    expect(isCommitRefEqual(a, b)).toBe(false)
  })

  it('returns false when urls differ', () => {
    const a = createCommitRef('abc1234567890123456789012345678901234567', 'http://a')
    const b = createCommitRef('abc1234567890123456789012345678901234567', 'http://b')
    expect(isCommitRefEqual(a, b)).toBe(false)
  })
})

describe('isIssueRefEqual', () => {
  it('returns true for identical issue refs', () => {
    const a = createIssueRef(123, 'issue', 'http://example.com/123')
    const b = createIssueRef(123, 'issue', 'http://example.com/123')
    expect(isIssueRefEqual(a, b)).toBe(true)
  })

  it('returns false when numbers differ', () => {
    const a = createIssueRef(123, 'issue')
    const b = createIssueRef(456, 'issue')
    expect(isIssueRefEqual(a, b)).toBe(false)
  })

  it('returns false when types differ', () => {
    const a = createIssueRef(123, 'issue')
    const b = createIssueRef(123, 'pull-request')
    expect(isIssueRefEqual(a, b)).toBe(false)
  })

  it('returns false when urls differ', () => {
    const a = createIssueRef(123, 'issue', 'http://a')
    const b = createIssueRef(123, 'issue', 'http://b')
    expect(isIssueRefEqual(a, b)).toBe(false)
  })
})

describe('isMetadataEqual', () => {
  it('returns true for identical metadata', () => {
    const a = { format: 'keep-a-changelog' as const, isConventional: false, warnings: ['warn'] }
    const b = { format: 'keep-a-changelog' as const, isConventional: false, warnings: ['warn'] }
    expect(isMetadataEqual(a, b)).toBe(true)
  })

  it('returns false when formats differ', () => {
    const a = { format: 'keep-a-changelog' as const, isConventional: false, warnings: [] }
    const b = { format: 'conventional' as const, isConventional: false, warnings: [] }
    expect(isMetadataEqual(a, b)).toBe(false)
  })

  it('returns false when isConventional differs', () => {
    const a = { format: 'keep-a-changelog' as const, isConventional: true, warnings: [] }
    const b = { format: 'keep-a-changelog' as const, isConventional: false, warnings: [] }
    expect(isMetadataEqual(a, b)).toBe(false)
  })

  it('returns false when repositoryUrl differs', () => {
    const a = { format: 'unknown' as const, isConventional: false, warnings: [], repositoryUrl: 'http://a' }
    const b = { format: 'unknown' as const, isConventional: false, warnings: [], repositoryUrl: 'http://b' }
    expect(isMetadataEqual(a, b)).toBe(false)
  })

  it('returns false when packageName differs', () => {
    const a = { format: 'unknown' as const, isConventional: false, warnings: [], packageName: 'pkg-a' }
    const b = { format: 'unknown' as const, isConventional: false, warnings: [], packageName: 'pkg-b' }
    expect(isMetadataEqual(a, b)).toBe(false)
  })

  it('returns false when warning counts differ', () => {
    const a = { format: 'unknown' as const, isConventional: false, warnings: ['a'] }
    const b = { format: 'unknown' as const, isConventional: false, warnings: [] }
    expect(isMetadataEqual(a, b)).toBe(false)
  })

  it('returns false when warnings differ', () => {
    const a = { format: 'unknown' as const, isConventional: false, warnings: ['a'] }
    const b = { format: 'unknown' as const, isConventional: false, warnings: ['b'] }
    expect(isMetadataEqual(a, b)).toBe(false)
  })
})
