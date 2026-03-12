import { createChangelog, createEmptyChangelog, createChangelogLink, createChangelogEntry } from './index'

describe('createChangelog', () => {
  it('creates a changelog with defaults', () => {
    const changelog = createChangelog()
    expect(changelog.header.title).toBe('# Changelog')
    expect(changelog.entries).toHaveLength(0)
    expect(changelog.metadata.format).toBe('unknown')
  })

  it('creates a changelog with options', () => {
    const changelog = createChangelog({
      source: 'CHANGELOG.md',
      entries: [createChangelogEntry('1.0.0')],
    })
    expect(changelog.source).toBe('CHANGELOG.md')
    expect(changelog.entries).toHaveLength(1)
  })
})

describe('createEmptyChangelog', () => {
  it('creates a standard empty changelog', () => {
    const changelog = createEmptyChangelog()
    expect(changelog.header.title).toBe('# Changelog')
    expect(changelog.header.description.length).toBeGreaterThan(0)
    expect(changelog.metadata.format).toBe('keep-a-changelog')
  })
})

describe('createChangelogLink', () => {
  it('creates a link', () => {
    const link = createChangelogLink('Keep a Changelog', 'https://keepachangelog.com')
    expect(link.label).toBe('Keep a Changelog')
    expect(link.url).toBe('https://keepachangelog.com')
  })
})
