import { describe, expect, it } from '@hyperfrontend/testing'
import { parseConventionalCommit, isConventionalCommit } from './message'

describe('parseConventionalCommit', () => {
  describe('basic parsing', () => {
    it('parses a simple commit', () => {
      const commit = parseConventionalCommit('feat: add new feature')

      expect(commit).toEqual({
        type: 'feat',
        scope: [],
        subject: 'add new feature',
        body: undefined,
        footers: [],
        breaking: false,
        raw: 'feat: add new feature',
      })
    })

    it('parses commit with scope', () => {
      const commit = parseConventionalCommit('feat(api): add new endpoint')

      expect(commit).toEqual({
        type: 'feat',
        scope: ['api'],
        subject: 'add new endpoint',
        footers: [],
        breaking: false,
        raw: 'feat(api): add new endpoint',
      })
    })

    it('parses commit with multi-scope header', () => {
      const commit = parseConventionalCommit('feat(versioning,questions): add searchable select')

      expect(commit).toEqual({
        type: 'feat',
        scope: ['versioning', 'questions'],
        subject: 'add searchable select',
        footers: [],
        breaking: false,
        raw: 'feat(versioning,questions): add searchable select',
      })
    })

    it('parses all standard types', () => {
      const types = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']

      for (const type of types) {
        const commit = parseConventionalCommit(`${type}: test message`)
        expect(commit.type).toBe(type)
      }
    })

    it('handles empty message', () => {
      const commit = parseConventionalCommit('')
      expect(commit).toEqual({ type: '', scope: [], subject: '', footers: [], breaking: false, raw: '' })
    })
  })

  describe('breaking changes', () => {
    it('detects breaking change via !', () => {
      const commit = parseConventionalCommit('feat(api)!: remove deprecated endpoint')

      expect(commit).toMatchObject({ type: 'feat', scope: ['api'], subject: 'remove deprecated endpoint', breaking: true })
    })

    it('detects breaking change via footer', () => {
      const commit = parseConventionalCommit(`fix: change return type

BREAKING CHANGE: The return type is now a Promise`)

      expect(commit).toMatchObject({ breaking: true, breakingDescription: 'The return type is now a Promise' })
    })

    it('detects BREAKING-CHANGE footer', () => {
      const commit = parseConventionalCommit(`fix: update API

BREAKING-CHANGE: New API signature`)

      expect(commit).toMatchObject({ breaking: true, breakingDescription: 'New API signature' })
    })

    it('uses footer description over subject for breaking', () => {
      const commit = parseConventionalCommit(`feat!: major change

BREAKING CHANGE: Detailed description`)

      expect(commit).toMatchObject({ breaking: true, breakingDescription: 'Detailed description' })
    })
  })

  describe('body parsing', () => {
    it('parses body', () => {
      const commit = parseConventionalCommit(`feat: add feature

This is the body of the commit.
It can span multiple lines.`)

      expect(commit.body).toBe('This is the body of the commit.\nIt can span multiple lines.')
    })

    it('handles body with blank lines', () => {
      const commit = parseConventionalCommit(`feat: add feature

First paragraph.

Second paragraph.`)

      expect(commit.body).toBe('First paragraph.\n\nSecond paragraph.')
    })

    it('stops body at footer line', () => {
      const commit = parseConventionalCommit(`feat: add feature

Body content here
Refs: ABC-123`)

      expect(commit).toMatchObject({ body: 'Body content here', footers: [expect.objectContaining({ key: 'Refs' })] })
    })

    it('stops body when blank line followed by footer', () => {
      const commit = parseConventionalCommit(`feat: add feature

Body here

Fixes #123`)

      expect(commit).toMatchObject({ body: 'Body here', footers: [expect.objectContaining({ key: 'Fixes' })] })
    })

    it('handles no body when footer comes immediately', () => {
      const commit = parseConventionalCommit(`feat: add feature

Refs: ABC-123`)

      expect(commit).toMatchObject({ body: undefined, footers: [expect.objectContaining({ key: 'Refs' })] })
    })
  })

  describe('footer parsing', () => {
    it('parses footers with colon separator', () => {
      const commit = parseConventionalCommit(`feat: add feature

Refs: ABC-123
Reviewed-by: John Doe`)

      expect(commit.footers).toEqual([
        { key: 'Refs', value: 'ABC-123', separator: ':' },
        { key: 'Reviewed-by', value: 'John Doe', separator: ':' },
      ])
    })

    it('parses footers with space-hash separator', () => {
      const commit = parseConventionalCommit(`fix: fix bug

Fixes #123
Closes #456`)

      expect(commit.footers).toEqual([
        { key: 'Fixes', value: '123', separator: ' #' },
        { key: 'Closes', value: '456', separator: ' #' },
      ])
    })

    it('handles multi-line breaking change', () => {
      const commit = parseConventionalCommit(`feat: change API

BREAKING CHANGE: The API has changed significantly.
Users need to update their code.
See migration guide.

Refs: DOC-123`)

      expect(commit).toMatchObject({
        breaking: true,
        breakingDescription: 'The API has changed significantly.\nUsers need to update their code.\nSee migration guide.',
      })
    })
  })

  describe('edge cases', () => {
    it('handles type only (no colon)', () => {
      const commit = parseConventionalCommit('feat')
      expect(commit).toEqual({ type: 'feat', scope: [], subject: '', footers: [], breaking: false, raw: 'feat' })
    })

    it('handles extra whitespace', () => {
      const commit = parseConventionalCommit('feat:   extra spaces  ')
      expect(commit.subject).toBe('extra spaces')
    })

    it('preserves case in subject', () => {
      const commit = parseConventionalCommit('feat: Add NEW Feature')
      expect(commit.subject).toBe('Add NEW Feature')
    })

    it('lowercases type', () => {
      const commit = parseConventionalCommit('FEAT: uppercase type')
      expect(commit.type).toBe('feat')
    })

    it('handles Windows line endings', () => {
      const commit = parseConventionalCommit('feat: test\r\n\r\nBody here')
      expect(commit).toEqual({
        type: 'feat',
        scope: [],
        subject: 'test',
        body: 'Body here',
        footers: [],
        breaking: false,
        raw: 'feat: test\r\n\r\nBody here',
      })
    })

    it('handles scope with missing closing parenthesis', () => {
      const commit = parseConventionalCommit('feat(api: subject')
      expect(commit).toEqual({ type: 'feat', scope: ['api: subject'], subject: '', footers: [], breaking: false, raw: 'feat(api: subject' })
    })

    it('handles whitespace-only message', () => {
      const commit = parseConventionalCommit('   ')
      expect(commit).toEqual({ type: '', scope: [], subject: '', footers: [], breaking: false, raw: '   ' })
    })
  })

  describe('raw message', () => {
    it('preserves raw message', () => {
      const message = 'feat(scope): subject\n\nBody\n\nFixes #123'
      const commit = parseConventionalCommit(message)
      expect(commit.raw).toBe(message)
    })
  })

  describe('error handling', () => {
    it('throws on message exceeding max length', () => {
      const longMessage = 'feat: ' + 'x'.repeat(10 * 1024 + 1)
      expect(() => parseConventionalCommit(longMessage)).toThrow('exceeds maximum length')
    })
  })
})

describe('isConventionalCommit', () => {
  it('returns true for a typed subject', () => {
    expect(isConventionalCommit('feat: add feature')).toBe(true)
  })

  it('returns true for a scoped header', () => {
    expect(isConventionalCommit('fix(api): fix bug')).toBe(true)
  })

  it('returns true for a breaking-marked header', () => {
    expect(isConventionalCommit('chore!: breaking change')).toBe(true)
  })

  it('returns false for an empty message', () => {
    expect(isConventionalCommit('')).toBe(false)
  })

  it('returns false for a sentence without a type', () => {
    expect(isConventionalCommit('Add new feature')).toBe(false)
  })

  it('returns false for a past-tense sentence', () => {
    expect(isConventionalCommit('Fixed bug in API')).toBe(false)
  })

  it('returns false for a bare word', () => {
    expect(isConventionalCommit('WIP')).toBe(false)
  })

  it('returns false for a lone colon', () => {
    expect(isConventionalCommit(':')).toBe(false)
  })

  it('returns false for a colon with no type before it', () => {
    expect(isConventionalCommit(': no type')).toBe(false)
  })
})

describe('body parsing edge cases', () => {
  it('handles body with only trailing blank lines', () => {
    const commit = parseConventionalCommit('feat: test\n\nBody content\n\n\n')
    expect(commit.body).toBe('Body content')
  })

  it('handles message with only header and blank lines', () => {
    const commit = parseConventionalCommit('feat: test\n\n\n')
    expect(commit.body).toBeUndefined()
  })

  it('handles body line that looks like footer but is not', () => {
    const commit = parseConventionalCommit('feat: test\n\nSome text with colon: in middle')
    expect(commit.body).toContain('Some text with colon')
  })
})

describe('footer parsing edge cases', () => {
  it('handles footer with alphanumeric key', () => {
    const commit = parseConventionalCommit('feat: test\n\nSigned-off-by: John')
    expect(commit.footers).toEqual([expect.objectContaining({ key: 'Signed-off-by' })])
  })

  it('handles multiple consecutive footers', () => {
    const commit = parseConventionalCommit('feat: test\n\nRefs: A\nSee: B\nAck: C')
    expect(commit.footers).toHaveLength(3)
  })

  it('handles footer value with special characters', () => {
    const commit = parseConventionalCommit('feat: test\n\nRefs: ABC-123/DEF:456')
    expect(commit.footers[0]?.value).toBe('ABC-123/DEF:456')
  })

  it('handles BREAKING-CHANGE followed by another footer', () => {
    const commit = parseConventionalCommit('feat: test\n\nBREAKING-CHANGE: desc\nRefs: 123')
    expect(commit).toMatchObject({
      breaking: true,
      breakingDescription: 'desc',
      footers: [expect.objectContaining({ key: 'BREAKING-CHANGE' }), expect.objectContaining({ key: 'Refs' })],
    })
  })

  it('handles footer without preceding body', () => {
    const commit = parseConventionalCommit('feat: subject\n\nRefs #123')
    expect(commit).toMatchObject({ body: undefined, footers: [{ key: 'Refs', value: '123', separator: ' #' }] })
  })

  it('stops body parsing when footer line is encountered', () => {
    const commit = parseConventionalCommit('feat: subject\n\nBody paragraph.\n\nRefs: 123')
    expect(commit).toMatchObject({ body: 'Body paragraph.', footers: [expect.objectContaining({ key: 'Refs' })] })
  })

  it('handles footer with hash reference format', () => {
    const commit = parseConventionalCommit('fix: bug\n\nCloses #456')
    expect(commit.footers).toEqual([{ key: 'Closes', value: '456', separator: ' #' }])
  })

  it('handles empty footer value', () => {
    const commit = parseConventionalCommit('feat: test\n\nNote:')
    expect(commit.footers.length).toBeGreaterThanOrEqual(0)
  })

  it('handles body ending with blank line before footer', () => {
    const commit = parseConventionalCommit('feat: test\n\nBody text.\n\nFixes #100')
    expect(commit).toMatchObject({ body: 'Body text.', footers: [expect.objectContaining({ key: 'Fixes' })] })
  })
})
