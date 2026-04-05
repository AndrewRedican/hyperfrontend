import { parseChangelog } from './parser'

describe('parseChangelog', () => {
  describe('basic parsing', () => {
    it('parses an empty changelog', () => {
      const changelog = parseChangelog('')
      expect(changelog.header.title).toBe('# Changelog')
      expect(changelog.entries).toHaveLength(0)
    })

    it('parses a minimal changelog', () => {
      const content = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- Initial release
`

      const changelog = parseChangelog(content)

      expect(changelog.header.title).toBe('# Changelog')
      expect(changelog.entries).toHaveLength(1)
      expect(changelog.entries[0]?.version).toBe('1.0.0')
      expect(changelog.entries[0]?.date).toBe('2024-01-01')
      expect(changelog.entries[0]?.sections).toHaveLength(1)
      expect(changelog.entries[0]?.sections[0]?.type).toBe('features')
      expect(changelog.entries[0]?.sections[0]?.items).toHaveLength(1)
    })
  })

  describe('header parsing', () => {
    it('parses header description', () => {
      const content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0]
`

      const changelog = parseChangelog(content)

      expect(changelog.header.description.length).toBeGreaterThan(0)
      expect(changelog.header.description.some((d) => d.includes('notable changes'))).toBe(true)
    })

    it('extracts links from header', () => {
      const content = `# Changelog

Based on [Keep a Changelog](https://keepachangelog.com).

## [1.0.0]
`

      const changelog = parseChangelog(content)

      expect(changelog.header.links).toHaveLength(1)
      expect(changelog.header.links[0]).toMatchObject({
        label: 'Keep a Changelog',
        url: 'https://keepachangelog.com',
      })
    })
  })

  describe('version parsing', () => {
    it('parses version without brackets', () => {
      const changelog = parseChangelog('## 1.0.0 - 2024-01-01\n-test')
      expect(changelog.entries[0]?.version).toBe('1.0.0')
    })

    it('parses version with v prefix', () => {
      const changelog = parseChangelog('## v1.0.0 - 2024-01-01\n-test')
      expect(changelog.entries[0]?.version).toBe('1.0.0')
    })

    it('parses unreleased section', () => {
      const changelog = parseChangelog('## [Unreleased]\n- Upcoming feature')
      expect(changelog.entries[0]?.version).toBe('Unreleased')
      expect(changelog.entries[0]?.unreleased).toBe(true)
      expect(changelog.entries[0]?.date).toBeNull()
    })

    it('parses prerelease versions', () => {
      const changelog = parseChangelog('## [1.0.0-alpha.1] - 2024-01-01\n- test')
      expect(changelog.entries[0]?.version).toBe('1.0.0-alpha.1')
    })

    it('parses multiple versions', () => {
      const content = `# Changelog

## [2.0.0] - 2024-02-01

### Added
- Feature 2

## [1.0.0] - 2024-01-01

### Added
- Feature 1
`

      const changelog = parseChangelog(content)

      expect(changelog.entries).toHaveLength(2)
      expect(changelog.entries[0]?.version).toBe('2.0.0')
      expect(changelog.entries[1]?.version).toBe('1.0.0')
    })
  })

  describe('section parsing', () => {
    it('parses all standard section types', () => {
      const content = `## [1.0.0]

### Breaking Changes
- Breaking 1

### Features
- Feature 1

### Bug Fixes
- Fix 1

### Performance
- Perf 1

### Documentation
- Doc 1
`

      const changelog = parseChangelog(content)
      const sections = changelog.entries[0]?.sections

      expect(sections?.find((s) => s.type === 'breaking')).toBeDefined()
      expect(sections?.find((s) => s.type === 'features')).toBeDefined()
      expect(sections?.find((s) => s.type === 'fixes')).toBeDefined()
      expect(sections?.find((s) => s.type === 'performance')).toBeDefined()
      expect(sections?.find((s) => s.type === 'documentation')).toBeDefined()
    })

    it('normalizes section headings', () => {
      const content = `## [1.0.0]

### Added
- Feature (should be 'features')

### Fixed
- Fix (should be 'fixes')
`

      const changelog = parseChangelog(content)
      const sections = changelog.entries[0]?.sections

      expect(sections?.[0]?.type).toBe('features')
      expect(sections?.[1]?.type).toBe('fixes')
    })
  })

  describe('item parsing', () => {
    it('parses simple items', () => {
      const content = `## [1.0.0]

### Added
- First item
- Second item
- Third item
`

      const changelog = parseChangelog(content)
      const items = changelog.entries[0]?.sections[0]?.items

      expect(items).toHaveLength(3)
      expect(items?.[0]?.description).toBe('First item')
      expect(items?.[1]?.description).toBe('Second item')
      expect(items?.[2]?.description).toBe('Third item')
    })

    it('detects breaking change items', () => {
      const content = `## [1.0.0]

### Changed
- BREAKING: Changed API
- Normal change
`

      const changelog = parseChangelog(content)
      const items = changelog.entries[0]?.sections[0]?.items

      expect(items?.[0]?.breaking).toBe(true)
      expect(items?.[1]?.breaking).toBe(false)
    })

    it('detects breaking change with ! prefix', () => {
      const content = `## [1.0.0]

### Changed
- ! This is a breaking change
`

      const changelog = parseChangelog(content)
      const items = changelog.entries[0]?.sections[0]?.items

      expect(items?.[0]?.breaking).toBe(true)
    })

    it('detects breaking change with [breaking] tag', () => {
      const content = `## [1.0.0]

### Changed
- [breaking] Changed configuration format
`

      const changelog = parseChangelog(content)
      const items = changelog.entries[0]?.sections[0]?.items

      expect(items?.[0]?.breaking).toBe(true)
    })

    it('detects breaking change with "breaking change" text', () => {
      const content = `## [1.0.0]

### Changed
- This is a breaking change that affects users
`

      const changelog = parseChangelog(content)
      const items = changelog.entries[0]?.sections[0]?.items

      expect(items?.[0]?.breaking).toBe(true)
    })

    it('parses scope from items', () => {
      const content = `## [1.0.0]

### Added
- **api:** New endpoint
- **cli:** New command
`

      const changelog = parseChangelog(content)
      const items = changelog.entries[0]?.sections[0]?.items

      expect(items?.[0]?.scope).toBe('api')
      expect(items?.[1]?.scope).toBe('cli')
    })

    it('creates other section for items without heading', () => {
      const content = `## [1.0.0]

- Item without section heading
- Another item
`

      const changelog = parseChangelog(content)
      const sections = changelog.entries[0]?.sections

      expect(sections).toHaveLength(1)
      expect(sections?.[0]?.type).toBe('other')
      expect(sections?.[0]?.heading).toBe('Changes')
      expect(sections?.[0]?.items).toHaveLength(2)
    })
  })

  describe('format detection', () => {
    it('detects Keep a Changelog format', () => {
      const content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0]
`

      const changelog = parseChangelog(content)
      expect(changelog.metadata.format).toBe('keep-a-changelog')
    })

    it('detects conventional format', () => {
      const content = `# Changelog

## [1.0.0]

### Features
- Feature one

### Bug Fixes
- Fix one
`

      const changelog = parseChangelog(content)
      expect(changelog.metadata.format).toBe('conventional')
    })
  })

  describe('source tracking', () => {
    it('includes source path if provided', () => {
      const changelog = parseChangelog('# Changelog', 'CHANGELOG.md')
      expect(changelog.source).toBe('CHANGELOG.md')
    })
  })

  describe('repository URL extraction', () => {
    it('extracts repository URL from GitHub links', () => {
      const content = `# Changelog

See [releases](https://github.com/owner/repo/releases).

## [1.0.0]
`

      const changelog = parseChangelog(content)
      expect(changelog.metadata.repositoryUrl).toBe('https://github.com/owner/repo')
    })
  })

  describe('real-world changelogs', () => {
    it('parses a full changelog', () => {
      const content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature in development

## [1.1.0] - 2024-02-01

### Added
- **api:** New REST endpoints
- **cli:** Interactive mode

### Fixed
- Memory leak in connection pool
- Incorrect error message

### Changed
- Updated dependencies

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Basic functionality
`

      const changelog = parseChangelog(content)

      expect(changelog.header.title).toContain('Changelog')
      expect(changelog.header.description.length).toBeGreaterThan(0)
      expect(changelog.header.links.length).toBeGreaterThan(0)

      expect(changelog.entries).toHaveLength(3)

      expect(changelog.entries[0]?.unreleased).toBe(true)
      expect(changelog.entries[0]?.sections).toHaveLength(1)

      expect(changelog.entries[1]?.version).toBe('1.1.0')
      expect(changelog.entries[1]?.date).toBe('2024-02-01')
      expect(changelog.entries[1]?.sections).toHaveLength(3)

      expect(changelog.entries[2]?.version).toBe('1.0.0')
      expect(changelog.entries[2]?.date).toBe('2024-01-01')

      expect(changelog.metadata.format).toBe('keep-a-changelog')
    })
  })

  describe('header parsing edge cases', () => {
    it('trims trailing empty lines from description', () => {
      const content = `# My Changelog

This is a description.

Another paragraph.



## [1.0.0]
`

      const changelog = parseChangelog(content)
      expect(changelog.header.description[changelog.header.description.length - 1]).not.toBe('')
    })

    it('handles changelog without h1 title', () => {
      const content = `## [1.0.0]

### Features
- Feature
`

      const changelog = parseChangelog(content)
      expect(changelog.header.title).toBe('# Changelog')
    })
  })

  describe('orphan list items', () => {
    it('creates other section for items without heading', () => {
      const content = `# Changelog

## [1.0.0]

- Item without a section heading
- Another orphan item
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections).toHaveLength(1)
      expect(changelog.entries[0]?.sections[0]?.type).toBe('other')
      expect(changelog.entries[0]?.sections[0]?.items).toHaveLength(2)
    })
  })

  describe('breaking change detection', () => {
    it('detects breaking change via [breaking] marker', () => {
      const content = `# Changelog

## [1.0.0]

### Features
- [breaking] This is a breaking change
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections[0]?.items[0]?.breaking).toBe(true)
    })

    it('detects breaking change via breaking: prefix', () => {
      const content = `# Changelog

## [1.0.0]

### Features
- breaking: Removed deprecated API
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections[0]?.items[0]?.breaking).toBe(true)
    })

    it('detects breaking change via ! prefix', () => {
      const content = `# Changelog

## [1.0.0]

### Features
- !Important breaking API change
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections[0]?.items[0]?.breaking).toBe(true)
    })

    it('detects breaking change via "breaking change" text', () => {
      const content = `# Changelog

## [1.0.0]

### Features
- This is a breaking change to the API
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections[0]?.items[0]?.breaking).toBe(true)
    })

    it('does not mark non-breaking items', () => {
      const content = `# Changelog

## [1.0.0]

### Features
- Regular feature addition
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections[0]?.items[0]?.breaking).toBe(false)
    })
  })

  describe('entry parsing edge cases', () => {
    it('handles consecutive entries without content', () => {
      const content = `# Changelog

## [1.0.0]

## [0.9.0]
`

      const changelog = parseChangelog(content)
      expect(changelog.entries).toHaveLength(2)
      expect(changelog.entries[0]?.sections).toHaveLength(0)
    })

    it('handles entry with only blank lines', () => {
      const content = `# Changelog

## [1.0.0]



### Features
- Feature
`

      const changelog = parseChangelog(content)
      expect(changelog.entries[0]?.sections).toHaveLength(1)
    })

    it('parses entry with text but no sections', () => {
      const content = `# Changelog

## [1.0.0]

Some text without a proper section heading.
More text here.

## [0.9.0]

### Added
- Feature
`

      const changelog = parseChangelog(content)
      expect(changelog.entries).toHaveLength(2)
    })
  })

  describe('format detection edge cases', () => {
    it('detects unknown format when no patterns match', () => {
      const content = `# Notes

Some random text

## Version 1
`

      const changelog = parseChangelog(content)
      expect(changelog.metadata.format).toBe('unknown')
    })

    it('detects custom format with structured sections', () => {
      const content = `# My Project

## [1.0.0]

### Custom Section
- Item one
- Item two
`

      const changelog = parseChangelog(content)
      expect(changelog.metadata.format).toBe('custom')
    })

    it('detects keepachangelog from lowercase', () => {
      const content = `# Changelog

Based on keepachangelog format.

## [1.0.0]
`

      const changelog = parseChangelog(content)
      expect(changelog.metadata.format).toBe('keep-a-changelog')
    })
  })

  describe('link parsing edge cases', () => {
    it('handles orphan link-text without URL', () => {
      const content = `# Changelog

Some text with [label only] no URL.

## [1.0.0]
`

      const changelog = parseChangelog(content)
      expect(changelog.header.description.length).toBeGreaterThan(0)
    })
  })
})
