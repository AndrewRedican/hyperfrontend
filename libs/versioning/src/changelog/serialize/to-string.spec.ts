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
import { DEFAULT_SERIALIZE_OPTIONS } from './templates'
import { serializeChangelog } from './to-string'

describe('serializeChangelog', () => {
  const createTestChangelog = (): Changelog =>
    createChangelog({
      header: {
        title: '# Changelog',
        description: [
          'All notable changes to this project will be documented in this file.',
          '',
          'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).',
        ],
        links: [],
      },
      entries: [
        createChangelogEntry('1.1.0', {
          date: '2024-01-15',
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Added new feature', { scope: 'api' }),
              createChangelogItem('Another feature'),
            ]),
            createChangelogSection('fixes', 'Bug Fixes', [createChangelogItem('Fixed a bug', { breaking: false })]),
          ],
        }),
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Initial release')])],
        }),
      ],
      metadata: {
        format: 'keep-a-changelog',
        isConventional: false,
        warnings: [],
      },
    })

  it('serializes a basic changelog to markdown', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelog(changelog)

    expect(result).toBe(
      [
        '# Changelog',
        '',
        'All notable changes to this project will be documented in this file.',
        '',
        'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).',
        '',
        '## 1.1.0 - 2024-01-15',
        '',
        '### Features',
        '',
        '- **api:** Added new feature',
        '- Another feature',
        '',
        '### Bug Fixes',
        '',
        '- Fixed a bug',
        '',
        '## 1.0.0 - 2024-01-01',
        '',
        '### Features',
        '',
        '- Initial release',
        '',
      ].join('\n')
    )
  })

  it('serializes without scope when disabled', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelog(changelog, { includeScope: false })

    expect(result).toContain('\n- Added new feature\n')
  })

  it('uses asterisks when configured', () => {
    const changelog = createTestChangelog()
    const result = serializeChangelog(changelog, { useAsterisks: true })

    expect(result).toContain('### Features\n\n* **api:** Added new feature\n* Another feature\n')
  })

  it('serializes with breaking change indicator', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('2.0.0', {
          date: '2024-02-01',
          sections: [
            createChangelogSection('breaking', 'Breaking Changes', [createChangelogItem('Removed deprecated API', { breaking: true })]),
          ],
        }),
      ],
      metadata: { format: 'conventional', isConventional: true, warnings: [] },
    })

    const result = serializeChangelog(changelog)
    expect(result).toContain('**BREAKING**')
  })

  it('serializes commit references', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('New feature', {
                commits: [
                  createCommitRef('abc1234def5678901234567890abcdef12345678'),
                  createCommitRef('def5678abc1234567890abcdef12345678901234', 'https://github.com/test/repo/commit/def5678'),
                ],
              }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'conventional', isConventional: true, warnings: [] },
    })

    const result = serializeChangelog(changelog)
    expect(result).toContain('- New feature (abc1234, [def5678](https://github.com/test/repo/commit/def5678))\n')
  })

  it('serializes issue references', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          sections: [
            createChangelogSection('fixes', 'Bug Fixes', [
              createChangelogItem('Fixed issue', {
                references: [createIssueRef(123, 'issue', 'https://github.com/test/repo/issues/123'), createIssueRef(456, 'pull-request')],
              }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'conventional', isConventional: true, warnings: [] },
    })

    const result = serializeChangelog(changelog)
    expect(result).toContain('- Fixed issue [#123](https://github.com/test/repo/issues/123), #456\n')
  })

  it('omits a commit reference the description already carries', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('New feature (abc1234)', { commits: [createCommitRef('abc1234')] }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'conventional', isConventional: true, warnings: [] },
    })

    expect(serializeChangelog(changelog)).toContain('- New feature (abc1234)\n')
  })

  it('omits an issue reference the description already carries', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          date: '2024-01-01',
          sections: [
            createChangelogSection('fixes', 'Bug Fixes', [
              createChangelogItem('Fixed issue #123', { references: [createIssueRef(123, 'issue')] }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'conventional', isConventional: true, warnings: [] },
    })

    expect(serializeChangelog(changelog)).toContain('- Fixed issue #123\n')
  })

  it('serializes with compare URL', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.1.0', {
          date: '2024-01-15',
          compareUrl: 'https://github.com/test/repo/compare/v1.0.0...v1.1.0',
          sections: [],
        }),
      ],
      metadata: { format: 'keep-a-changelog', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog)
    expect(result).toContain('[1.1.0](https://github.com/test/repo/compare/v1.0.0...v1.1.0)')
  })

  it('handles empty changelog', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog)
    expect(result).toBe('# Changelog\n\n')
  })

  it('excludes description when includeDescription is false', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: ['Description line'], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeDescription: false })
    expect(result).not.toContain('Description line')
  })

  it('excludes compare URL when includeCompareUrls is false', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [createChangelogEntry('1.0.0', { compareUrl: 'http://compare', sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeCompareUrls: false })
    expect(result).toBe('# Changelog\n\n## 1.0.0\n\n')
  })

  it('excludes commits when includeCommits is false', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature', { commits: [createCommitRef('abc1234567890123456789012345678901234567')] }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeCommits: false })
    expect(result).not.toContain('abc1234')
  })

  it('excludes references when includeReferences is false', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [
            createChangelogSection('features', 'Features', [
              createChangelogItem('Feature', { references: [createIssueRef(123, 'issue')] }),
            ]),
          ],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeReferences: false })
    expect(result).not.toContain('#123')
  })

  it('uses CRLF line endings when configured', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: ['Line 1'], links: [] },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { lineEnding: '\r\n' })
    expect(result).toContain('\r\n')
  })

  it('uses custom entry spacing', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [createChangelogEntry('2.0.0', { sections: [] }), createChangelogEntry('1.0.0', { sections: [] })],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { entrySpacing: 2 })
    expect(result).toContain('\n\n\n')
  })

  it('uses custom section headings when section has no heading', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        createChangelogEntry('1.0.0', {
          sections: [{ type: 'features', heading: '', items: [] }],
        }),
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { sectionHeadings: { features: 'New Features' } })
    expect(result).toContain('### New Features')
  })

  it('includes rawContent when includeRawContent is true', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [{ version: '1.0.0', date: null, unreleased: false, sections: [], rawContent: 'Raw changelog content' }],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeRawContent: true })
    expect(result).toContain('Raw changelog content')
  })

  it('handles unreleased entry without date', () => {
    const changelog = createChangelog({
      header: { title: '# Changelog', description: [], links: [] },
      entries: [
        {
          version: 'Unreleased',
          date: null,
          unreleased: true,
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Upcoming feature')])],
        },
      ],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog)
    expect(result).toContain('## Unreleased\n')
  })

  it('serializes header links when includeLinks is true', () => {
    const changelog = createChangelog({
      header: {
        title: '# Changelog',
        description: [],
        links: [
          { label: 'Unreleased', url: 'https://github.com/foo/bar/compare/v1.0.0...HEAD' },
          { label: '1.0.0', url: 'https://github.com/foo/bar/releases/tag/v1.0.0' },
        ],
      },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeLinks: true })
    expect(result).toContain(
      '[Unreleased]: https://github.com/foo/bar/compare/v1.0.0...HEAD\n[1.0.0]: https://github.com/foo/bar/releases/tag/v1.0.0\n'
    )
  })

  it('serializes header description with all lines', () => {
    const changelog = createChangelog({
      header: {
        title: '# Changelog',
        description: [
          'All notable changes to this project will be documented in this file.',
          '',
          'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).',
        ],
        links: [],
      },
      entries: [],
      metadata: { format: 'unknown', isConventional: false, warnings: [] },
    })

    const result = serializeChangelog(changelog, { includeDescription: true })
    expect(result).toContain(
      'All notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).\n'
    )
  })
})

describe('DEFAULT_SERIALIZE_OPTIONS', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_SERIALIZE_OPTIONS).toEqual(
      expect.objectContaining({ includeDescription: true, includeScope: true, lineEnding: '\n', useAsterisks: false })
    )
  })
})
