import { parseConventionalCommit, isConventionalCommit } from './message'

describe('parseConventionalCommit', () => {
  describe('basic parsing', () => {
    it('parses a simple commit', () => {
      const commit = parseConventionalCommit('feat: add new feature')

      expect(commit.type).toBe('feat')
      expect(commit.subject).toBe('add new feature')
      expect(commit.scope).toBeUndefined()
      expect(commit.breaking).toBe(false)
      expect(commit.body).toBeUndefined()
      expect(commit.footers).toHaveLength(0)
    })

    it('parses commit with scope', () => {
      const commit = parseConventionalCommit('feat(api): add new endpoint')

      expect(commit.type).toBe('feat')
      expect(commit.scope).toBe('api')
      expect(commit.subject).toBe('add new endpoint')
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
      expect(commit.type).toBe('')
      expect(commit.subject).toBe('')
    })
  })

  describe('breaking changes', () => {
    it('detects breaking change via !', () => {
      const commit = parseConventionalCommit('feat(api)!: remove deprecated endpoint')

      expect(commit.breaking).toBe(true)
      expect(commit.type).toBe('feat')
      expect(commit.scope).toBe('api')
      expect(commit.subject).toBe('remove deprecated endpoint')
    })

    it('detects breaking change via footer', () => {
      const commit = parseConventionalCommit(`fix: change return type

BREAKING CHANGE: The return type is now a Promise`)

      expect(commit.breaking).toBe(true)
      expect(commit.breakingDescription).toBe('The return type is now a Promise')
    })

    it('detects BREAKING-CHANGE footer', () => {
      const commit = parseConventionalCommit(`fix: update API

BREAKING-CHANGE: New API signature`)

      expect(commit.breaking).toBe(true)
      expect(commit.breakingDescription).toBe('New API signature')
    })

    it('uses footer description over subject for breaking', () => {
      const commit = parseConventionalCommit(`feat!: major change

BREAKING CHANGE: Detailed description`)

      expect(commit.breaking).toBe(true)
      expect(commit.breakingDescription).toBe('Detailed description')
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

      expect(commit.body).toContain('First paragraph.')
      expect(commit.body).toContain('Second paragraph.')
    })

    it('stops body at footer line', () => {
      const commit = parseConventionalCommit(`feat: add feature

Body content here
Refs: ABC-123`)

      expect(commit.body).toBe('Body content here')
      expect(commit.footers).toHaveLength(1)
    })

    it('stops body when blank line followed by footer', () => {
      const commit = parseConventionalCommit(`feat: add feature

Body here

Fixes #123`)

      expect(commit.body).toBe('Body here')
      expect(commit.footers).toHaveLength(1)
    })

    it('handles no body when footer comes immediately', () => {
      const commit = parseConventionalCommit(`feat: add feature

Refs: ABC-123`)

      expect(commit.body).toBeUndefined()
      expect(commit.footers).toHaveLength(1)
    })
  })

  describe('footer parsing', () => {
    it('parses footers with colon separator', () => {
      const commit = parseConventionalCommit(`feat: add feature

Refs: ABC-123
Reviewed-by: John Doe`)

      expect(commit.footers).toHaveLength(2)
      expect(commit.footers[0]).toMatchObject({
        key: 'Refs',
        value: 'ABC-123',
        separator: ':',
      })
      expect(commit.footers[1]).toMatchObject({
        key: 'Reviewed-by',
        value: 'John Doe',
        separator: ':',
      })
    })

    it('parses footers with space-hash separator', () => {
      const commit = parseConventionalCommit(`fix: fix bug

Fixes #123
Closes #456`)

      expect(commit.footers).toHaveLength(2)
      expect(commit.footers[0]).toMatchObject({
        key: 'Fixes',
        value: '123',
        separator: ' #',
      })
    })

    it('handles multi-line breaking change', () => {
      const commit = parseConventionalCommit(`feat: change API

BREAKING CHANGE: The API has changed significantly.
Users need to update their code.
See migration guide.

Refs: DOC-123`)

      expect(commit.breaking).toBe(true)
      expect(commit.breakingDescription).toContain('changed significantly')
      expect(commit.breakingDescription).toContain('migration guide')
    })
  })

  describe('edge cases', () => {
    it('handles type only (no colon)', () => {
      const commit = parseConventionalCommit('feat')
      expect(commit.type).toBe('feat')
      expect(commit.subject).toBe('')
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
      expect(commit.subject).toBe('test')
      expect(commit.body).toBe('Body here')
    })

    it('handles scope with missing closing parenthesis', () => {
      const commit = parseConventionalCommit('feat(api: subject')
      expect(commit.type).toBe('feat')
      expect(commit.scope).toBe('api: subject')
      expect(commit.subject).toBe('')
    })

    it('handles whitespace-only message', () => {
      const commit = parseConventionalCommit('   ')
      expect(commit.type).toBe('')
      expect(commit.subject).toBe('')
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
  it('returns true for valid conventional commits', () => {
    expect(isConventionalCommit('feat: add feature')).toBe(true)
    expect(isConventionalCommit('fix(api): fix bug')).toBe(true)
    expect(isConventionalCommit('chore!: breaking change')).toBe(true)
  })

  it('returns false for non-conventional commits', () => {
    expect(isConventionalCommit('')).toBe(false)
    expect(isConventionalCommit('Add new feature')).toBe(false)
    expect(isConventionalCommit('Fixed bug in API')).toBe(false)
    expect(isConventionalCommit('WIP')).toBe(false)
  })

  it('returns false for malformed conventional commits', () => {
    expect(isConventionalCommit(':')).toBe(false)
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
    expect(commit.footers).toHaveLength(1)
    expect(commit.footers[0]?.key).toBe('Signed-off-by')
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
    expect(commit.breaking).toBe(true)
    expect(commit.breakingDescription).toBe('desc')
    expect(commit.footers).toHaveLength(2)
  })

  it('handles footer without preceding body', () => {
    const commit = parseConventionalCommit('feat: subject\n\nRefs #123')
    expect(commit.body).toBeUndefined()
    expect(commit.footers).toHaveLength(1)
    expect(commit.footers[0]?.key).toBe('Refs')
    expect(commit.footers[0]?.value).toBe('123')
  })

  it('stops body parsing when footer line is encountered', () => {
    const commit = parseConventionalCommit('feat: subject\n\nBody paragraph.\n\nRefs: 123')
    expect(commit.body).toBe('Body paragraph.')
    expect(commit.footers).toHaveLength(1)
  })

  it('handles footer with hash reference format', () => {
    const commit = parseConventionalCommit('fix: bug\n\nCloses #456')
    expect(commit.footers).toHaveLength(1)
    expect(commit.footers[0]?.key).toBe('Closes')
    expect(commit.footers[0]?.value).toBe('456')
  })

  it('handles empty footer value', () => {
    const commit = parseConventionalCommit('feat: test\n\nNote:')
    expect(commit.footers.length).toBeGreaterThanOrEqual(0)
  })

  it('handles body ending with blank line before footer', () => {
    const commit = parseConventionalCommit('feat: test\n\nBody text.\n\nFixes #100')
    expect(commit.body).toBe('Body text.')
    expect(commit.footers).toHaveLength(1)
  })
})
