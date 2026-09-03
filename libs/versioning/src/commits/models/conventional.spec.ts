import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit, createCommitFooter } from './conventional'

describe('createConventionalCommit', () => {
  it('creates a simple commit', () => {
    const commit = createConventionalCommit('feat', 'add new feature')
    expect(commit.type).toBe('feat')
    expect(commit.subject).toBe('add new feature')
    expect(commit.scope).toEqual([])
    expect(commit.breaking).toBe(false)
  })

  it('creates a commit with scope', () => {
    const commit = createConventionalCommit('fix', 'fix bug', { scope: ['api'] })
    expect(commit.scope).toEqual(['api'])
  })

  it('creates a commit with multi-scope', () => {
    const commit = createConventionalCommit('feat', 'add feature', { scope: ['versioning', 'questions'] })
    expect(commit.scope).toEqual(['versioning', 'questions'])
    expect(commit.raw).toBe('feat(versioning,questions): add feature')
  })

  it('creates a breaking change commit', () => {
    const commit = createConventionalCommit('feat', 'change API', {
      breaking: true,
      breakingDescription: 'API has changed',
    })
    expect(commit.breaking).toBe(true)
    expect(commit.breakingDescription).toBe('API has changed')
  })

  it('generates raw message', () => {
    const commit = createConventionalCommit('feat', 'add feature', { scope: ['api'] })
    expect(commit.raw).toBe('feat(api): add feature')
  })

  it('generates raw message with body', () => {
    const commit = createConventionalCommit('feat', 'add feature', {
      body: 'This is a detailed description.',
    })
    expect(commit.raw).toBe('feat: add feature\n\nThis is a detailed description.')
  })

  it('generates raw message with footers', () => {
    const commit = createConventionalCommit('fix', 'fix bug', {
      footers: [createCommitFooter('Refs', 'ABC-123'), createCommitFooter('Fixes', '456', ' #')],
    })
    expect(commit.raw).toBe('fix: fix bug\n\nRefs: ABC-123\nFixes #456')
  })

  it('generates raw message with body and footers', () => {
    const commit = createConventionalCommit('feat', 'add feature', {
      scope: ['core'],
      body: 'Description here',
      footers: [createCommitFooter('Closes', '789', ' #')],
    })
    expect(commit.raw).toBe('feat(core): add feature\n\nDescription here\n\nCloses #789')
  })

  it('generates raw message with breaking indicator', () => {
    const commit = createConventionalCommit('feat', 'breaking change', {
      breaking: true,
    })
    expect(commit.raw).toBe('feat!: breaking change')
  })

  it('uses provided raw message', () => {
    const commit = createConventionalCommit('feat', 'test', {
      raw: 'custom raw message',
    })
    expect(commit.raw).toBe('custom raw message')
  })
})

describe('createCommitFooter', () => {
  it('creates a footer with colon', () => {
    const footer = createCommitFooter('Refs', 'ABC-123')
    expect(footer.key).toBe('Refs')
    expect(footer.value).toBe('ABC-123')
    expect(footer.separator).toBe(':')
  })

  it('creates a footer with hash', () => {
    const footer = createCommitFooter('Fixes', '123', ' #')
    expect(footer.separator).toBe(' #')
  })
})
