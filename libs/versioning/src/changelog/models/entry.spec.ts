import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelogEntry, createUnreleasedEntry, createChangelogItem, createChangelogSection, createCommitRef } from './index'

describe('createChangelogEntry', () => {
  it('creates an entry with defaults', () => {
    const entry = createChangelogEntry('1.0.0')
    expect(entry.version).toBe('1.0.0')
    expect(entry.date).toBeNull()
    expect(entry.unreleased).toBe(false)
    expect(entry.sections).toHaveLength(0)
  })

  it('creates an entry with options', () => {
    const entry = createChangelogEntry('1.0.0', {
      date: '2024-01-01',
      sections: [createChangelogSection('features', 'Features')],
    })
    expect(entry.date).toBe('2024-01-01')
    expect(entry.sections).toHaveLength(1)
  })
})

describe('createUnreleasedEntry', () => {
  it('creates an unreleased entry', () => {
    const entry = createUnreleasedEntry()
    expect(entry.version).toBe('Unreleased')
    expect(entry.unreleased).toBe(true)
    expect(entry.date).toBeNull()
  })
})

describe('createChangelogItem', () => {
  it('creates an item with defaults', () => {
    const item = createChangelogItem('Test description')
    expect(item.description).toBe('Test description')
    expect(item.scope).toBeUndefined()
    expect(item.commits).toHaveLength(0)
    expect(item.references).toHaveLength(0)
    expect(item.breaking).toBe(false)
  })

  it('creates an item with options', () => {
    const item = createChangelogItem('Test', {
      scope: 'api',
      breaking: true,
      commits: [createCommitRef('abc1234')],
    })
    expect(item.scope).toBe('api')
    expect(item.breaking).toBe(true)
    expect(item.commits).toHaveLength(1)
  })
})
