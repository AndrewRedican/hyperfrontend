import { describe, expect, it } from '@hyperfrontend/testing'
import { formatCommitMessage } from './format-message'

describe('formatCommitMessage', () => {
  it('renders a header-only message', () => {
    expect(formatCommitMessage({ type: 'feat', subject: 'add login' })).toBe('feat: add login')
  })

  it('renders header + body separated by a blank line', () => {
    const output = formatCommitMessage({ type: 'feat', subject: 'add login', body: 'Details about the change.' })
    expect(output).toBe('feat: add login\n\nDetails about the change.')
  })

  it('renders header + footers separated by a blank line', () => {
    const output = formatCommitMessage({
      type: 'fix',
      subject: 'oops',
      footers: [{ key: 'Refs', value: '#42', separator: ':' }],
    })
    expect(output).toBe('fix: oops\n\nRefs: #42')
  })

  it('renders header + body + footers with both blank-line separators', () => {
    const output = formatCommitMessage({
      type: 'feat',
      subject: 'add login',
      body: 'Full explanation.',
      footers: [{ key: 'Closes', value: '#1', separator: ':' }],
    })
    expect(output).toBe('feat: add login\n\nFull explanation.\n\nCloses: #1')
  })

  it('renders breaking marker + synthesized BREAKING CHANGE footer', () => {
    const output = formatCommitMessage({
      type: 'feat',
      subject: 'drop endpoint',
      breaking: true,
      breakingDescription: 'removes /v1/foo',
    })
    expect(output).toBe('feat!: drop endpoint\n\nBREAKING CHANGE: removes /v1/foo')
  })

  it('does not duplicate BREAKING CHANGE footer when one already exists', () => {
    const output = formatCommitMessage({
      type: 'feat',
      subject: 'drop endpoint',
      breaking: true,
      breakingDescription: 'ignored',
      footers: [{ key: 'BREAKING CHANGE', value: 'authored by hand', separator: ':' }],
    })
    expect(output).toBe('feat!: drop endpoint\n\nBREAKING CHANGE: authored by hand')
  })

  it('also recognizes hyphenated BREAKING-CHANGE as existing', () => {
    const output = formatCommitMessage({
      type: 'feat',
      subject: 'x',
      breaking: true,
      breakingDescription: 'ignored',
      footers: [{ key: 'BREAKING-CHANGE', value: 'authored', separator: ':' }],
    })
    expect(output).toBe('feat!: x\n\nBREAKING-CHANGE: authored')
  })

  it('renders a multi-scope breaking-change message with closing footer', () => {
    const output = formatCommitMessage({
      type: 'feat',
      scope: ['versioning', 'questions'],
      subject: 'add x',
      breaking: true,
      breakingDescription: 'removed Y',
      footers: [{ key: 'Closes', value: '#1', separator: ':' }],
    })
    expect(output).toBe('feat(versioning,questions)!: add x\n\nBREAKING CHANGE: removed Y\nCloses: #1')
  })

  it('respects the issue-ref separator " #" without injecting a trailing space', () => {
    const output = formatCommitMessage({
      type: 'fix',
      subject: 'close it',
      footers: [{ key: 'Fixes', value: '123', separator: ' #' }],
    })
    expect(output).toBe('fix: close it\n\nFixes #123')
  })

  it('skips breaking footer synthesis when breakingDescription is absent', () => {
    const output = formatCommitMessage({ type: 'feat', subject: 'x', breaking: true })
    expect(output).toBe('feat!: x')
  })

  it('skips body when the string is empty', () => {
    const output = formatCommitMessage({ type: 'feat', subject: 'x', body: '' })
    expect(output).toBe('feat: x')
  })
})
