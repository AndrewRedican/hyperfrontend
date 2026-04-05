import type { Changelog } from './changelog'
import type { ChangelogEntry } from './entry'
import { validateChangelog, checkSchemaCompatibility, changelogSchema } from './schema'

describe('changelogSchema', () => {
  it('exports a valid JSON schema object', () => {
    expect(changelogSchema).toBeDefined()
    expect(changelogSchema.type).toBe('object')
    expect(changelogSchema.required).toContain('header')
    expect(changelogSchema.required).toContain('entries')
    expect(changelogSchema.required).toContain('metadata')
  })
})

describe('validateChangelog', () => {
  const validChangelog: Changelog = {
    header: {
      title: '# Changelog',
      description: ['All notable changes.'],
      links: [],
    },
    entries: [
      {
        version: '1.0.0',
        date: '2024-01-15',
        unreleased: false,
        sections: [
          {
            type: 'features',
            heading: 'Features',
            items: [
              {
                description: 'New feature',
                commits: [],
                references: [],
                breaking: false,
              },
            ],
          },
        ],
      },
    ],
    metadata: {
      format: 'keep-a-changelog',
      isConventional: false,
      warnings: [],
    },
  }

  it('validates a valid changelog', () => {
    const result = validateChangelog(validChangelog)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing header', () => {
    const invalid = { ...validChangelog, header: undefined }
    const result = validateChangelog(invalid)
    expect(result.valid).toBe(false)
  })

  it('rejects missing entries', () => {
    const invalid = { ...validChangelog, entries: undefined }
    const result = validateChangelog(invalid)
    expect(result.valid).toBe(false)
  })

  it('rejects missing metadata', () => {
    const invalid = { ...validChangelog, metadata: undefined }
    const result = validateChangelog(invalid)
    expect(result.valid).toBe(false)
  })

  it('rejects invalid format value', () => {
    const invalid = {
      ...validChangelog,
      metadata: { ...validChangelog.metadata, format: 'invalid-format' },
    }
    const result = validateChangelog(invalid)
    expect(result.valid).toBe(false)
  })

  it('validates changelog with source', () => {
    const withSource = { ...validChangelog, source: '/path/to/CHANGELOG.md' }
    const result = validateChangelog(withSource)
    expect(result.valid).toBe(true)
  })
})

describe('checkSchemaCompatibility', () => {
  const baseEntry: ChangelogEntry = {
    version: '1.0.0',
    date: '2024-01-15',
    unreleased: false,
    sections: [
      {
        type: 'features',
        heading: 'Features',
        items: [],
      },
    ],
  }

  const baseChangelog: Changelog = {
    header: {
      title: '# Changelog',
      description: [],
      links: [],
    },
    entries: [baseEntry],
    metadata: {
      format: 'keep-a-changelog',
      isConventional: false,
      warnings: [],
    },
  }

  it('returns compatible for identical changelogs', () => {
    const result = checkSchemaCompatibility(baseChangelog, baseChangelog)
    expect(result.compatible).toBe(true)
    expect(result.differences).toHaveLength(0)
  })

  it('detects format mismatch', () => {
    const other: Changelog = {
      ...baseChangelog,
      metadata: { ...baseChangelog.metadata, format: 'conventional' },
    }
    const result = checkSchemaCompatibility(baseChangelog, other)
    expect(result.compatible).toBe(false)
    expect(result.differences.some((d) => d.path === 'metadata.format')).toBe(true)
  })

  it('detects missing section types', () => {
    const other: Changelog = {
      ...baseChangelog,
      entries: [
        {
          ...baseEntry,
          sections: [],
        },
      ],
    }
    const result = checkSchemaCompatibility(baseChangelog, other)
    expect(result.compatible).toBe(false)
    expect(result.differences.some((d) => d.type === 'missing-property')).toBe(true)
  })

  it('detects extra section types', () => {
    const other: Changelog = {
      ...baseChangelog,
      entries: [
        {
          ...baseEntry,
          sections: [
            ...baseEntry.sections,
            {
              type: 'fixes',
              heading: 'Bug Fixes',
              items: [],
            },
          ],
        },
      ],
    }
    const result = checkSchemaCompatibility(baseChangelog, other)
    expect(result.compatible).toBe(false)
    expect(result.differences.some((d) => d.type === 'extra-property')).toBe(true)
  })

  it('handles changelogs with no entries', () => {
    const empty: Changelog = {
      ...baseChangelog,
      entries: [],
    }
    const result = checkSchemaCompatibility(empty, empty)
    expect(result.compatible).toBe(true)
  })

  it('treats title difference as compatible (content difference, not schema)', () => {
    const other: Changelog = {
      ...baseChangelog,
      header: { ...baseChangelog.header, title: '# Different Title' },
    }
    const result = checkSchemaCompatibility(baseChangelog, other)
    expect(result.compatible).toBe(true)
    expect(result.differences).toHaveLength(0)
  })
})
