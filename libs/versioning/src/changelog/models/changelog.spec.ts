import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelog, createEmptyChangelog, createChangelogLink, createChangelogEntry } from './index'

describe('createChangelog', () => {
  it('creates a changelog with defaults', () => {
    expect(createChangelog()).toMatchObject({ header: { title: '# Changelog' }, entries: [], metadata: { format: 'unknown' } })
  })

  it('creates a changelog with options', () => {
    const changelog = createChangelog({
      source: 'CHANGELOG.md',
      entries: [createChangelogEntry('1.0.0')],
    })
    expect(changelog).toMatchObject({ source: 'CHANGELOG.md', entries: [{ version: '1.0.0' }] })
  })
})

describe('createEmptyChangelog', () => {
  it('creates a standard empty changelog', () => {
    expect(createEmptyChangelog()).toMatchObject({
      header: { title: '# Changelog', description: expect.arrayContaining([expect.any(String)]) },
      metadata: { format: 'keep-a-changelog' },
    })
  })
})

describe('createChangelogLink', () => {
  it('creates a link', () => {
    expect(createChangelogLink('Keep a Changelog', 'https://keepachangelog.com')).toEqual({
      label: 'Keep a Changelog',
      url: 'https://keepachangelog.com',
    })
  })
})
