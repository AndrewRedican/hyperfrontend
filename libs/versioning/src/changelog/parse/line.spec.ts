import { parseVersionFromHeading, parseScopeFromItem, parseCommitRefs, parseIssueRefs } from './line'

describe('parseVersionFromHeading', () => {
  describe('version extraction', () => {
    it('parses simple version', () => {
      const result = parseVersionFromHeading('1.0.0')
      expect(result.version).toBe('1.0.0')
    })

    it('parses version with brackets', () => {
      const result = parseVersionFromHeading('[1.0.0]')
      expect(result.version).toBe('1.0.0')
    })

    it('parses version with v prefix', () => {
      const result = parseVersionFromHeading('v1.0.0')
      expect(result.version).toBe('1.0.0')
    })

    it('parses version with V prefix', () => {
      const result = parseVersionFromHeading('V1.0.0')
      expect(result.version).toBe('1.0.0')
    })

    it('parses prerelease version', () => {
      const result = parseVersionFromHeading('1.0.0-alpha.1')
      expect(result.version).toBe('1.0.0-alpha.1')
    })

    it('parses version with build metadata', () => {
      const result = parseVersionFromHeading('1.0.0+build123')
      expect(result.version).toBe('1.0.0+build123')
    })
  })

  describe('date extraction', () => {
    it('parses date with dash separator', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-01-15')
      expect(result.version).toBe('1.0.0')
      expect(result.date).toBe('2024-01-15')
    })

    it('parses date with en-dash separator', () => {
      const result = parseVersionFromHeading('[1.0.0] – 2024-01-15')
      expect(result.version).toBe('1.0.0')
      expect(result.date).toBe('2024-01-15')
    })

    it('parses date in parentheses', () => {
      const result = parseVersionFromHeading('[1.0.0] (2024-01-15)')
      expect(result.date).toBe('2024-01-15')
    })

    it('parses date in parentheses with closing paren consumed', () => {
      const result = parseVersionFromHeading('[1.0.0] (2024-01-15) some text')
      expect(result.date).toBe('2024-01-15')
    })

    it('handles missing date', () => {
      const result = parseVersionFromHeading('[1.0.0]')
      expect(result.date).toBeNull()
    })

    it('parses date with slash separator', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024/01/15')
      expect(result.date).toBe('2024-01-15')
    })

    it('handles incomplete date - missing month', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024')
      expect(result.date).toBeNull()
    })

    it('handles incomplete date - non-numeric characters', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-XX-15')
      expect(result.date).toBeNull()
    })

    it('handles incomplete date - wrong separator in middle', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-01/15')
      expect(result.date).toBeNull()
    })

    it('handles incomplete date - only year and month', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-01')
      expect(result.date).toBeNull()
    })

    it('handles incomplete day digits', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-01-1')
      expect(result.date).toBeNull()
    })
  })

  describe('compare URL extraction', () => {
    it('parses compare URL in link format', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-01-15 [compare](https://github.com/owner/repo/compare/v0.9.0...v1.0.0)')
      expect(result.compareUrl).toBe('https://github.com/owner/repo/compare/v0.9.0...v1.0.0')
    })

    it('parses link without date', () => {
      const result = parseVersionFromHeading('[1.0.0] [link](https://example.com)')
      expect(result.compareUrl).toBe('https://example.com')
    })

    it('handles malformed link - missing closing bracket', () => {
      const result = parseVersionFromHeading('[1.0.0] [compare(https://example.com)')
      expect(result.compareUrl).toBeUndefined()
    })

    it('handles malformed link - missing opening parenthesis', () => {
      const result = parseVersionFromHeading('[1.0.0] [compare]https://example.com)')
      expect(result.compareUrl).toBeUndefined()
    })

    it('handles malformed link - unclosed URL parenthesis', () => {
      const result = parseVersionFromHeading('[1.0.0] [link](https://example.com')
      expect(result.compareUrl).toBeUndefined()
    })

    it('handles link with nested parentheses in URL', () => {
      const result = parseVersionFromHeading('[1.0.0] [link](https://example.com/path(1))')
      expect(result.compareUrl).toBe('https://example.com/path(1)')
    })

    it('handles no link present', () => {
      const result = parseVersionFromHeading('[1.0.0] - 2024-01-15')
      expect(result.compareUrl).toBeUndefined()
    })
  })

  describe('unreleased', () => {
    it('parses Unreleased', () => {
      const result = parseVersionFromHeading('Unreleased')
      expect(result.version).toBe('Unreleased')
      expect(result.date).toBeNull()
    })

    it('parses [Unreleased]', () => {
      const result = parseVersionFromHeading('[Unreleased]')
      expect(result.version).toBe('Unreleased')
    })

    it('handles case insensitively', () => {
      const result = parseVersionFromHeading('UNRELEASED')
      expect(result.version).toBe('Unreleased')
    })
  })

  describe('jscutlery/semver format compatibility', () => {
    it('parses version with inline URL and trailing date', () => {
      const heading = '[0.0.4](https://github.com/owner/repo/compare/lib@0.0.3...lib@0.0.4) (2026-03-08)'
      const result = parseVersionFromHeading(heading)

      expect(result.version).toBe('0.0.4')
      expect(result.date).toBe('2026-03-08')
      expect(result.compareUrl).toBe('https://github.com/owner/repo/compare/lib@0.0.3...lib@0.0.4')
    })

    it('parses version with inline URL but no date', () => {
      const heading = '[0.0.4](https://github.com/owner/repo/compare/v0.0.3...v0.0.4)'
      const result = parseVersionFromHeading(heading)

      expect(result.version).toBe('0.0.4')
      expect(result.compareUrl).toBe('https://github.com/owner/repo/compare/v0.0.3...v0.0.4')
      expect(result.date).toBeNull()
    })

    it('parses version with parenthetical date only (no URL)', () => {
      const heading = '0.0.1 (2026-02-15)'
      const result = parseVersionFromHeading(heading)

      expect(result.version).toBe('0.0.1')
      expect(result.date).toBe('2026-02-15')
      expect(result.compareUrl).toBeUndefined()
    })

    it('handles nested parentheses in URL', () => {
      const heading = '[1.0.0](https://github.com/owner/repo/compare/v0.9.0...v1.0.0) (2026-01-15)'
      const result = parseVersionFromHeading(heading)

      expect(result.compareUrl).toBe('https://github.com/owner/repo/compare/v0.9.0...v1.0.0')
      expect(result.date).toBe('2026-01-15')
    })

    it('handles version prefix in URL with @ scope', () => {
      const heading = '[0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.1...lib-logging@0.0.2) (2026-02-26)'
      const result = parseVersionFromHeading(heading)

      expect(result.version).toBe('0.0.2')
      expect(result.date).toBe('2026-02-26')
      expect(result.compareUrl).toBe('https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.1...lib-logging@0.0.2')
    })
  })
})

describe('parseScopeFromItem', () => {
  it('parses bold scope with colon inside', () => {
    const result = parseScopeFromItem('**api:** New endpoint')
    expect(result.scope).toBe('api')
    expect(result.description).toBe('New endpoint')
  })

  it('parses bold scope with colon outside', () => {
    const result = parseScopeFromItem('**api**: New endpoint')
    expect(result.scope).toBe('api')
    expect(result.description).toBe('New endpoint')
  })

  it('parses bold scope with colon inside and no space after', () => {
    const result = parseScopeFromItem('**api:**description')
    expect(result.scope).toBe('api')
    expect(result.description).toBe('description')
  })

  it('parses bold scope with colon outside and no space', () => {
    const result = parseScopeFromItem('**api**:description')
    expect(result.scope).toBe('api')
    expect(result.description).toBe('description')
  })

  it('trims whitespace after scope', () => {
    const result = parseScopeFromItem('**api:**    Lots of spaces')
    expect(result.description).toBe('Lots of spaces')
  })

  it('parses simple scope', () => {
    const result = parseScopeFromItem('api: New endpoint')
    expect(result.scope).toBe('api')
    expect(result.description).toBe('New endpoint')
  })

  it('handles no scope', () => {
    const result = parseScopeFromItem('New feature without scope')
    expect(result.scope).toBeUndefined()
    expect(result.description).toBe('New feature without scope')
  })

  it('handles scope with hyphen', () => {
    const result = parseScopeFromItem('**test-utils:** Add helper')
    expect(result.scope).toBe('test-utils')
  })

  it('does not treat long text before colon as scope', () => {
    const result = parseScopeFromItem('This is a very long description: with a colon in it')
    expect(result.scope).toBeUndefined()
  })

  it('handles bold without scope pattern', () => {
    const result = parseScopeFromItem('**Important notice** This is important')
    expect(result.scope).toBe('Important notice')
    expect(result.description).toBe('This is important')
  })

  it('rejects invalid scope characters', () => {
    const result = parseScopeFromItem('invalid scope!: description')
    expect(result.scope).toBeUndefined()
  })

  it('handles empty scope', () => {
    const result = parseScopeFromItem(': description')
    expect(result.scope).toBeUndefined()
    expect(result.description).toBe(': description')
  })

  it('handles numbers in scope', () => {
    const result = parseScopeFromItem('v2: New version')
    expect(result.scope).toBe('v2')
    expect(result.description).toBe('New version')
  })

  it('trims input whitespace', () => {
    const result = parseScopeFromItem('  api: description  ')
    expect(result.scope).toBe('api')
    expect(result.description).toBe('description')
  })
})

describe('parseCommitRefs', () => {
  it('parses hash in parentheses', () => {
    const refs = parseCommitRefs('Fix bug (abc1234)')
    expect(refs).toHaveLength(1)
    expect(refs[0].shortHash).toBe('abc1234')
  })

  it('parses hash in brackets', () => {
    const refs = parseCommitRefs('Fix bug [abc1234]')
    expect(refs).toHaveLength(1)
  })

  it('parses multiple refs', () => {
    const refs = parseCommitRefs('Fix (abc1234) and (def5678)')
    expect(refs).toHaveLength(2)
  })

  it('handles full hash', () => {
    const fullHash = 'abc1234567890abc1234567890abc1234567890a'
    const refs = parseCommitRefs(`Fix (${fullHash})`)
    expect(refs[0].hash).toBe(fullHash)
    expect(refs[0].shortHash).toBe('abc1234')
  })

  it('includes URL if base URL provided', () => {
    const refs = parseCommitRefs('Fix (abc1234)', 'https://github.com/owner/repo')
    expect(refs[0].url).toBe('https://github.com/owner/repo/commit/abc1234')
  })

  it('rejects hash that is too short', () => {
    const refs = parseCommitRefs('Fix (abc12)')
    expect(refs).toHaveLength(0)
  })

  it('rejects non-hex characters', () => {
    const refs = parseCommitRefs('Fix (ghijklm)')
    expect(refs).toHaveLength(0)
  })

  it('rejects unclosed parentheses', () => {
    const refs = parseCommitRefs('Fix (abc1234')
    expect(refs).toHaveLength(0)
  })

  it('handles no commit refs', () => {
    const refs = parseCommitRefs('Just a regular description')
    expect(refs).toHaveLength(0)
  })
})

describe('parseIssueRefs', () => {
  it('parses issue reference', () => {
    const refs = parseIssueRefs('Fix #123')
    expect(refs).toHaveLength(1)
    expect(refs[0].number).toBe(123)
    expect(refs[0].type).toBe('issue')
  })

  it('parses multiple references', () => {
    const refs = parseIssueRefs('Fix #123 and #456')
    expect(refs).toHaveLength(2)
    expect(refs[0].number).toBe(123)
    expect(refs[1].number).toBe(456)
  })

  it('detects PR references from PR keyword', () => {
    const refs = parseIssueRefs('Merged PR #123')
    expect(refs[0].type).toBe('pull-request')
  })

  it('detects PR references from pull keyword within 10 char context', () => {
    const refs = parseIssueRefs('See pull #456')
    expect(refs[0].type).toBe('pull-request')
  })

  it('defaults to issue when pull keyword is too far', () => {
    const refs = parseIssueRefs('See pull request #456')
    expect(refs[0].type).toBe('issue')
  })

  it('includes URL if base URL provided', () => {
    const refs = parseIssueRefs('Fix #123', 'https://github.com/owner/repo')
    expect(refs[0].url).toBe('https://github.com/owner/repo/issues/123')
  })

  it('handles no issue refs', () => {
    const refs = parseIssueRefs('Just a regular description')
    expect(refs).toHaveLength(0)
  })

  it('ignores hash without following digits', () => {
    const refs = parseIssueRefs('Use # character')
    expect(refs).toHaveLength(0)
  })

  it('handles reference at start of text', () => {
    const refs = parseIssueRefs('#42 is the answer')
    expect(refs).toHaveLength(1)
    expect(refs[0].number).toBe(42)
  })
})
