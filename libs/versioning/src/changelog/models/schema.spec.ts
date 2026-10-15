import type { Changelog } from './changelog'
import type { ChangelogEntry } from './entry'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateChangelog, checkSchemaCompatibility, changelogSchema } from './schema'

describe('changelogSchema', () => {
  it('exports a valid JSON schema object', () => {
    expect(changelogSchema).toMatchObject({ type: 'object', required: expect.arrayContaining(['header', 'entries', 'metadata']) })
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
    expect(validateChangelog(validChangelog)).toEqual({ valid: true, errors: [] })
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
    expect(checkSchemaCompatibility(baseChangelog, baseChangelog)).toEqual({ compatible: true, differences: [] })
  })

  it('detects format mismatch', () => {
    const other: Changelog = {
      ...baseChangelog,
      metadata: { ...baseChangelog.metadata, format: 'conventional' },
    }
    expect(checkSchemaCompatibility(baseChangelog, other)).toMatchObject({
      compatible: false,
      differences: expect.arrayContaining([expect.objectContaining({ path: 'metadata.format' })]),
    })
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
    expect(checkSchemaCompatibility(baseChangelog, other)).toMatchObject({
      compatible: false,
      differences: expect.arrayContaining([expect.objectContaining({ type: 'missing-property' })]),
    })
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
    expect(checkSchemaCompatibility(baseChangelog, other)).toMatchObject({
      compatible: false,
      differences: expect.arrayContaining([expect.objectContaining({ type: 'extra-property' })]),
    })
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
    expect(checkSchemaCompatibility(baseChangelog, other)).toEqual({ compatible: true, differences: [] })
  })
})
