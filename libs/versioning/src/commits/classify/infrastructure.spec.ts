import type { GitCommit } from '../../git/models/commit'
import type { InfrastructureMatchContext, InfrastructureMatcher } from './infrastructure'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  allOf,
  anyOf,
  buildInfrastructureMatcher,
  CI_SCOPE_MATCHER,
  createMatchContext,
  DEFAULT_INFRA_SCOPE_MATCHER,
  evaluateInfrastructure,
  messageMatcher,
  not,
  scopeMatcher,
  scopePrefixMatcher,
  scopeRegexMatcher,
  TOOL_PREFIX_MATCHER,
  TOOLING_SCOPE_MATCHER,
} from './infrastructure'

/**
 * Creates a minimal GitCommit for testing.
 *
 * @param overrides - Partial properties to override defaults
 * @returns A complete GitCommit object with defaults and overrides applied
 */
function createMockCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'abc123',
    shortHash: 'abc123',
    message: 'test commit',
    subject: 'test commit',
    body: '',
    authorName: 'Test Author',
    authorEmail: 'test@example.com',
    authorDate: '2026-03-17T00:00:00Z',
    committerName: 'Test Author',
    committerEmail: 'test@example.com',
    commitDate: '2026-03-17T00:00:00Z',
    parents: [],
    refs: [],
    ...overrides,
  }
}

type MockContextOverrides = Omit<Partial<InfrastructureMatchContext>, 'scope'> & {
  scope?: string | readonly string[] | undefined
}

/**
 * Creates a minimal match context for testing.
 *
 * Accepts scope as either a string (wrapped into a single-element array) or a
 * readonly array for multi-scope cases.
 *
 * @param overrides - Partial context properties to override defaults
 * @returns A complete InfrastructureMatchContext with defaults and overrides applied
 */
function createMockContext(overrides: MockContextOverrides = {}): InfrastructureMatchContext {
  const commit = createMockCommit({
    message: overrides.message ?? 'test commit',
    subject: overrides.subject ?? 'test commit',
  })
  const { scope: scopeOverride, ...rest } = overrides
  let scope: readonly string[]
  if (scopeOverride === undefined) {
    scope = []
  } else if (typeof scopeOverride === 'string') {
    scope = [scopeOverride]
  } else {
    scope = scopeOverride
  }
  return {
    commit,
    scope,
    subject: commit.subject,
    message: commit.message,
    ...rest,
  }
}

describe('scopeMatcher', () => {
  it('returns true when scope matches exactly', () => {
    const matcher = scopeMatcher(['ci', 'build'])
    expect(matcher(createMockContext({ scope: 'ci' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'build' }))).toBe(true)
  })

  it('matches case-insensitively', () => {
    const matcher = scopeMatcher(['ci', 'build'])
    expect(matcher(createMockContext({ scope: 'CI' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'BUILD' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'Ci' }))).toBe(true)
  })

  it('returns false when scope does not match', () => {
    const matcher = scopeMatcher(['ci', 'build'])
    expect(matcher(createMockContext({ scope: 'feat' }))).toBe(false)
    expect(matcher(createMockContext({ scope: 'lib-utils' }))).toBe(false)
  })

  it('returns false when scope is undefined', () => {
    const matcher = scopeMatcher(['ci', 'build'])
    expect(matcher(createMockContext({ scope: undefined }))).toBe(false)
  })

  it('handles empty scopes array', () => {
    const matcher = scopeMatcher([])
    expect(matcher(createMockContext({ scope: 'ci' }))).toBe(false)
  })
})

describe('scopePrefixMatcher', () => {
  it('returns true when scope starts with prefix', () => {
    const matcher = scopePrefixMatcher(['tool-', 'infra-'])
    expect(matcher(createMockContext({ scope: 'tool-package' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'tool-scripts' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'infra-ci' }))).toBe(true)
  })

  it('matches case-insensitively', () => {
    const matcher = scopePrefixMatcher(['tool-'])
    expect(matcher(createMockContext({ scope: 'TOOL-package' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'Tool-Scripts' }))).toBe(true)
  })

  it('returns false when scope does not start with prefix', () => {
    const matcher = scopePrefixMatcher(['tool-'])
    expect(matcher(createMockContext({ scope: 'lib-utils' }))).toBe(false)
    expect(matcher(createMockContext({ scope: 'feat' }))).toBe(false)
  })

  it('returns false when scope is undefined', () => {
    const matcher = scopePrefixMatcher(['tool-'])
    expect(matcher(createMockContext({ scope: undefined }))).toBe(false)
  })

  it('handles empty prefixes array', () => {
    const matcher = scopePrefixMatcher([])
    expect(matcher(createMockContext({ scope: 'tool-package' }))).toBe(false)
  })
})

describe('messageMatcher', () => {
  it('returns true when message contains pattern', () => {
    const matcher = messageMatcher(['[infra]', '[ci skip]'])
    expect(matcher(createMockContext({ message: 'fix: update build [infra]' }))).toBe(true)
    expect(matcher(createMockContext({ message: 'chore: minor update [ci skip]' }))).toBe(true)
  })

  it('matches case-insensitively', () => {
    const matcher = messageMatcher(['[infra]'])
    expect(matcher(createMockContext({ message: 'fix: update [INFRA]' }))).toBe(true)
    expect(matcher(createMockContext({ message: 'fix: update [Infra]' }))).toBe(true)
  })

  it('returns false when message does not contain pattern', () => {
    const matcher = messageMatcher(['[infra]'])
    expect(matcher(createMockContext({ message: 'feat: new feature' }))).toBe(false)
  })

  it('handles empty patterns array', () => {
    const matcher = messageMatcher([])
    expect(matcher(createMockContext({ message: 'anything' }))).toBe(false)
  })
})

describe('scopeRegexMatcher', () => {
  it('returns true when scope matches regex', () => {
    const matcher = scopeRegexMatcher(/^(ci|build|tool)-.+/)
    expect(matcher(createMockContext({ scope: 'ci-pipeline' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'build-scripts' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'tool-package' }))).toBe(true)
  })

  it('returns false when scope does not match regex', () => {
    const matcher = scopeRegexMatcher(/^(ci|build|tool)-.+/)
    expect(matcher(createMockContext({ scope: 'ci' }))).toBe(false)
    expect(matcher(createMockContext({ scope: 'lib-utils' }))).toBe(false)
  })

  it('returns false when scope is undefined', () => {
    const matcher = scopeRegexMatcher(/^ci/)
    expect(matcher(createMockContext({ scope: undefined }))).toBe(false)
  })
})

describe('anyOf', () => {
  it('returns true if any matcher matches', () => {
    const combined = anyOf(scopeMatcher(['ci']), scopeMatcher(['build']))
    expect(combined(createMockContext({ scope: 'ci' }))).toBe(true)
    expect(combined(createMockContext({ scope: 'build' }))).toBe(true)
  })

  it('returns false if no matcher matches', () => {
    const combined = anyOf(scopeMatcher(['ci']), scopeMatcher(['build']))
    expect(combined(createMockContext({ scope: 'feat' }))).toBe(false)
  })

  it('short-circuits on first match', () => {
    let secondCalled = false
    const first: InfrastructureMatcher = () => true
    const second: InfrastructureMatcher = () => {
      secondCalled = true
      return true
    }
    const combined = anyOf(first, second)
    combined(createMockContext())
    expect(secondCalled).toBe(false)
  })

  it('handles empty matchers', () => {
    const combined = anyOf()
    expect(combined(createMockContext({ scope: 'ci' }))).toBe(false)
  })
})

describe('allOf', () => {
  it('returns true if all matchers match', () => {
    const combined = allOf(scopeMatcher(['ci']), messageMatcher(['build']))
    expect(combined(createMockContext({ scope: 'ci', message: 'ci: build pipeline' }))).toBe(true)
  })

  it('returns false if any matcher fails', () => {
    const combined = allOf(scopeMatcher(['ci']), messageMatcher(['build']))
    expect(combined(createMockContext({ scope: 'ci', message: 'ci: update config' }))).toBe(false)
    expect(combined(createMockContext({ scope: 'feat', message: 'feat: build something' }))).toBe(false)
  })

  it('short-circuits on first failure', () => {
    let secondCalled = false
    const first: InfrastructureMatcher = () => false
    const second: InfrastructureMatcher = () => {
      secondCalled = true
      return true
    }
    const combined = allOf(first, second)
    combined(createMockContext())
    expect(secondCalled).toBe(false)
  })

  it('handles empty matchers - returns true (vacuous truth)', () => {
    const combined = allOf()
    expect(combined(createMockContext())).toBe(true)
  })
})

describe('not', () => {
  it('negates a matcher that returns true', () => {
    const matcher = scopeMatcher(['ci'])
    const negated = not(matcher)
    expect(negated(createMockContext({ scope: 'ci' }))).toBe(false)
  })

  it('negates a matcher that returns false', () => {
    const matcher = scopeMatcher(['ci'])
    const negated = not(matcher)
    expect(negated(createMockContext({ scope: 'feat' }))).toBe(true)
  })
})

describe('pre-built matchers', () => {
  describe('CI_SCOPE_MATCHER', () => {
    it('matches CI/CD scopes', () => {
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'ci' }))).toBe(true)
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'cd' }))).toBe(true)
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'build' }))).toBe(true)
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'pipeline' }))).toBe(true)
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'workflow' }))).toBe(true)
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'actions' }))).toBe(true)
    })

    it('does not match non-CI scopes', () => {
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'feat' }))).toBe(false)
      expect(CI_SCOPE_MATCHER(createMockContext({ scope: 'lib-utils' }))).toBe(false)
    })
  })

  describe('TOOLING_SCOPE_MATCHER', () => {
    it('matches tooling scopes', () => {
      expect(TOOLING_SCOPE_MATCHER(createMockContext({ scope: 'tooling' }))).toBe(true)
      expect(TOOLING_SCOPE_MATCHER(createMockContext({ scope: 'workspace' }))).toBe(true)
      expect(TOOLING_SCOPE_MATCHER(createMockContext({ scope: 'monorepo' }))).toBe(true)
      expect(TOOLING_SCOPE_MATCHER(createMockContext({ scope: 'nx' }))).toBe(true)
      expect(TOOLING_SCOPE_MATCHER(createMockContext({ scope: 'root' }))).toBe(true)
    })
  })

  describe('TOOL_PREFIX_MATCHER', () => {
    it('matches tool-prefixed scopes', () => {
      expect(TOOL_PREFIX_MATCHER(createMockContext({ scope: 'tool-package' }))).toBe(true)
      expect(TOOL_PREFIX_MATCHER(createMockContext({ scope: 'tool-scripts' }))).toBe(true)
    })

    it('does not match non-tool-prefixed scopes', () => {
      expect(TOOL_PREFIX_MATCHER(createMockContext({ scope: 'lib-utils' }))).toBe(false)
      expect(TOOL_PREFIX_MATCHER(createMockContext({ scope: 'tooling' }))).toBe(false)
    })
  })

  describe('DEFAULT_INFRA_SCOPE_MATCHER', () => {
    it('combines CI, tooling, and tool-prefix matchers', () => {
      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'ci' }))).toBe(true)
      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'build' }))).toBe(true)

      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'workspace' }))).toBe(true)
      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'nx' }))).toBe(true)

      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'tool-package' }))).toBe(true)

      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'feat' }))).toBe(false)
      expect(DEFAULT_INFRA_SCOPE_MATCHER(createMockContext({ scope: 'lib-utils' }))).toBe(false)
    })
  })
})

describe('buildInfrastructureMatcher', () => {
  it('returns null when no configuration provided', () => {
    const matcher = buildInfrastructureMatcher({})
    expect(matcher).toBeNull()
  })

  it('returns null when only paths provided (paths handled elsewhere)', () => {
    const matcher = buildInfrastructureMatcher({ paths: ['tools/'] })
    expect(matcher).toBeNull()
  })

  it('builds scope matcher from scopes config', () => {
    const matcher = buildInfrastructureMatcher({ scopes: ['ci', 'build'] })
    if (matcher === null) {
      throw new Error('Expected matcher to be defined')
    }
    expect(matcher(createMockContext({ scope: 'ci' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'build' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'feat' }))).toBe(false)
  })

  it('uses custom matcher when provided', () => {
    const customMatcher: InfrastructureMatcher = (ctx) => ctx.scope.includes('custom')
    const matcher = buildInfrastructureMatcher({ matcher: customMatcher })
    if (matcher === null) {
      throw new Error('Expected matcher to be defined')
    }
    expect(matcher(createMockContext({ scope: 'custom' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'other' }))).toBe(false)
  })

  it('combines scopes and custom matcher with OR logic', () => {
    const customMatcher: InfrastructureMatcher = (ctx) => ctx.message.includes('[infra]')
    const matcher = buildInfrastructureMatcher({
      scopes: ['ci'],
      matcher: customMatcher,
    })
    if (matcher === null) {
      throw new Error('Expected matcher to be defined')
    }

    expect(matcher(createMockContext({ scope: 'ci' }))).toBe(true)

    expect(matcher(createMockContext({ scope: 'feat', message: 'feat: update [infra]' }))).toBe(true)

    expect(matcher(createMockContext({ scope: 'feat', message: 'feat: normal update' }))).toBe(false)
  })

  it('handles empty scopes array', () => {
    const matcher = buildInfrastructureMatcher({ scopes: [] })
    expect(matcher).toBeNull()
  })

  it('returns single matcher directly when only one configured', () => {
    const customMatcher: InfrastructureMatcher = (ctx) => ctx.scope.includes('custom')
    const matcher = buildInfrastructureMatcher({ matcher: customMatcher })
    if (matcher === null) {
      throw new Error('Expected matcher to be defined')
    }

    expect(matcher(createMockContext({ scope: 'custom' }))).toBe(true)
  })
})

describe('createMatchContext', () => {
  it('creates context from git commit', () => {
    const commit = createMockCommit({
      message: 'feat(scope): add feature\n\nBody text',
      subject: 'feat(scope): add feature',
    })
    const context = createMatchContext(commit)

    expect(context.commit).toBe(commit)
    expect(context.subject).toBe('feat(scope): add feature')
    expect(context.message).toBe('feat(scope): add feature\n\nBody text')
    expect(context.scope).toEqual([])
  })

  it('uses provided scope', () => {
    const commit = createMockCommit()
    const context = createMatchContext(commit, ['my-scope'])

    expect(context.scope).toEqual(['my-scope'])
  })
})

describe('evaluateInfrastructure', () => {
  it('evaluates commit against matcher', () => {
    const commit = createMockCommit({ message: 'ci: update pipeline' })
    const matcher = scopeMatcher(['ci'])

    expect(evaluateInfrastructure(commit, matcher, ['ci'])).toBe(true)
  })

  it('returns false when commit does not match', () => {
    const commit = createMockCommit({ message: 'feat: new feature' })
    const matcher = scopeMatcher(['ci'])

    expect(evaluateInfrastructure(commit, matcher, ['feat'])).toBe(false)
  })

  it('works without pre-parsed scope', () => {
    const commit = createMockCommit({ message: '[infra] update config' })
    const matcher = messageMatcher(['[infra]'])

    expect(evaluateInfrastructure(commit, matcher)).toBe(true)
  })
})

describe('complex composition scenarios', () => {
  it('creates complex matcher with nested composition', () => {
    const matcher = allOf(anyOf(scopeMatcher(['ci']), scopeMatcher(['build'])), not(scopeMatcher(['release'])))

    expect(matcher(createMockContext({ scope: 'ci' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'build' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'release' }))).toBe(false)
    expect(matcher(createMockContext({ scope: 'feat' }))).toBe(false)
  })

  it('creates matcher for dependencies with security updates', () => {
    const matcher = allOf(scopeMatcher(['deps']), messageMatcher(['security']))

    expect(matcher(createMockContext({ scope: 'deps', message: 'chore(deps): security update' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'deps', message: 'chore(deps): bump lodash' }))).toBe(false)
    expect(matcher(createMockContext({ scope: 'feat', message: 'feat: security feature' }))).toBe(false)
  })

  it('creates matcher with regex and scope combinations', () => {
    const matcher = anyOf(scopePrefixMatcher(['tool-']), scopeRegexMatcher(/^infra-/))

    expect(matcher(createMockContext({ scope: 'tool-package' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'infra-ci' }))).toBe(true)
    expect(matcher(createMockContext({ scope: 'lib-utils' }))).toBe(false)
  })
})
