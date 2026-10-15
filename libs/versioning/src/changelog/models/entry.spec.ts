import { describe, expect, it } from '@hyperfrontend/testing'
import { createChangelogEntry, createUnreleasedEntry, createChangelogItem, createChangelogSection, createCommitRef } from './index'

describe('createChangelogEntry', () => {
  it('creates an entry with defaults', () => {
    expect(createChangelogEntry('1.0.0')).toEqual({ version: '1.0.0', date: null, unreleased: false, sections: [] })
  })

  it('creates an entry with options', () => {
    const entry = createChangelogEntry('1.0.0', {
      date: '2024-01-01',
      sections: [createChangelogSection('features', 'Features')],
    })
    expect(entry).toMatchObject({ date: '2024-01-01', sections: [{ type: 'features' }] })
  })
})

describe('createUnreleasedEntry', () => {
  it('creates an unreleased entry', () => {
    expect(createUnreleasedEntry()).toMatchObject({ version: 'Unreleased', unreleased: true, date: null })
  })
})

describe('createChangelogItem', () => {
  it('creates an item with defaults', () => {
    expect(createChangelogItem('Test description')).toEqual({
      description: 'Test description',
      scope: undefined,
      commits: [],
      references: [],
      breaking: false,
    })
  })

  it('creates an item with options', () => {
    const item = createChangelogItem('Test', {
      scope: 'api',
      breaking: true,
      commits: [createCommitRef('abc1234')],
    })
    expect(item).toMatchObject({ scope: 'api', breaking: true, commits: [{ hash: 'abc1234' }] })
  })
})
