import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createChangelog,
  createChangelogEntry,
  createChangelogSection,
  createChangelogItem,
  createCommitRef,
  createIssueRef,
} from '../models'
import { serializeChangelogToJson, toJsonObject } from './to-json'

describe('serializeChangelogToJson', () => {
  const createTestChangelog = () =>
    createChangelog({
      source: '/path/to/CHANGELOG.md',
      header: {
        title: '# Changelog',
        description: ['Test description'],
        links: [{ label: 'test', url: 'https://example.com' }],
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

  it('serializes to compact JSON', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelogToJson(changelog)

    expect(result).not.toContain('\n')
    expect(JSON.parse(result)).toHaveProperty('header')
    expect(JSON.parse(result)).toHaveProperty('entries')
  })

  it('serializes to pretty JSON', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelogToJson(changelog, { pretty: true })

    expect(result).toContain('\n')
    expect(result).toContain('  ')
  })

  it('includes source when configured', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelogToJson(changelog, { includeSource: true })

    const parsed = JSON.parse(result)
    expect(parsed.source).toBe('/path/to/CHANGELOG.md')
  })

  it('excludes metadata when configured', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelogToJson(changelog, { includeMetadata: false })

    const parsed = JSON.parse(result)
    expect(parsed.metadata).toBeUndefined()
  })
})

describe('toJsonObject', () => {
  it('returns a plain object', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog)
    expect(typeof result).toBe('object')
    expect(result['header']).toBeDefined()
    expect(result['entries']).toEqual([])
  })

  it('includes compareUrl when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { compareUrl: 'http://compare', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog)
    const entries = result['entries'] as Array<Record<string, unknown>>
    expect(entries[0]?.['compareUrl']).toBe('http://compare')
  })

  it('includes rawContent when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [{ version: '1.0.0', date: null, unreleased: false, sections: [], rawContent: 'Raw content here' }],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog)
    const entries = result['entries'] as Array<Record<string, unknown>>
    expect(entries[0]?.['rawContent']).toBe('Raw content here')
  })

  it('includes scope in items when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature', { scope: 'api' })])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog)
    const entries = result['entries'] as Array<Record<string, unknown>>
    const sections = entries[0]?.['sections'] as Array<Record<string, unknown>> | undefined
    const items = sections?.[0]?.['items'] as Array<Record<string, unknown>> | undefined
    expect(items?.[0]?.['scope']).toBe('api')
  })

  it('includes commit with url when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature', { commits: [createCommitRef('abc1234567890123456789012345678901234567', 'http://commit')] }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog)
    const entries = result['entries'] as Array<Record<string, unknown>>
    const sections = entries[0]?.['sections'] as Array<Record<string, unknown>> | undefined
    const items = sections?.[0]?.['items'] as Array<Record<string, unknown>> | undefined
    const commits = items?.[0]?.['commits'] as Array<Record<string, unknown>> | undefined
    expect(commits?.[0]?.['url']).toBe('http://commit')
  })

  it('includes reference with url when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature', { references: [createIssueRef(123, 'issue', 'http://issue')] }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog)
    const entries = result['entries'] as Array<Record<string, unknown>>
    const sections = entries[0]?.['sections'] as Array<Record<string, unknown>> | undefined
    const items = sections?.[0]?.['items'] as Array<Record<string, unknown>> | undefined
    const refs = items?.[0]?.['references'] as Array<Record<string, unknown>> | undefined
    expect(refs?.[0]?.['url']).toBe('http://issue')
  })

  it('includes repositoryUrl in metadata when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [], repositoryUrl: 'http://repo' },
    })

    const result = toJsonObject(changelog)
    const metadata = result['metadata'] as Record<string, unknown>
    expect(metadata['repositoryUrl']).toBe('http://repo')
  })

  it('includes packageName in metadata when present', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [], packageName: '@test/pkg' },
    })

    const result = toJsonObject(changelog)
    const metadata = result['metadata'] as Record<string, unknown>
    expect(metadata['packageName']).toBe('@test/pkg')
  })

  it('excludes empty arrays when includeEmptyArrays is false', () => {
    const changelog = createChangelog({
      header: { title: '#', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Feature')])],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = toJsonObject(changelog, { includeEmptyArrays: false })
    const header = result['header'] as Record<string, unknown>
    expect(header['description']).toBeUndefined()
  })
})
