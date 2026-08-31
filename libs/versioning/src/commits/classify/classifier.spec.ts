import type { ClassificationContext, CommitWithRaw } from './models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGitCommit } from '../../git/models/commit'
import { createConventionalCommit } from '../models/conventional'
import {
  classifyCommit,
  classifyCommits,
  createClassificationContext,
  extractConventionalCommits,
  filterIncluded,
  toChangelogCommit,
} from './classifier'

/**
 * Creates a test commit input for classification testing.
 *
 * @param scope - Optional commit scope (e.g., 'versioning')
 * @param hash - Git commit hash
 * @param subject - Commit subject line
 * @returns A CommitWithRaw object for testing
 */
function createCommitInput(scope: string | undefined, hash: string, subject = 'test commit'): CommitWithRaw {
  const scopes = scope === undefined ? [] : [scope]
  return {
    commit: createConventionalCommit('feat', subject, { scope: scopes }),
    raw: createGitCommit({
      hash,
      authorName: 'Test',
      authorEmail: 'test@example.com',
      authorDate: '2026-03-17T10:00:00Z',
      subject: scope ? `feat(${scope}): ${subject}` : `feat: ${subject}`,
    }),
  }
}

describe('classifyCommit', () => {
  describe('scope-based classification (Option A)', () => {
    it('classifies direct-scope commits', () => {
      const input = createCommitInput('versioning', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning', 'lib-versioning'],
        fileCommitHashes: new Set(),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('direct-scope')
      expect(result.include).toBe(true)
      expect(result.preserveScope).toBe(false)
    })

    it('matches scope variations', () => {
      const input = createCommitInput('lib-versioning', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning', 'lib-versioning'],
        fileCommitHashes: new Set(),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('direct-scope')
      expect(result.include).toBe(true)
    })

    it('excludes commits with non-matching scope', () => {
      const input = createCommitInput('logging', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('excluded')
      expect(result.include).toBe(false)
    })

    it('excludes commits with explicitly excluded scope', () => {
      const input = createCommitInput('release', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
        excludeScopes: ['release'],
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('excluded')
      expect(result.include).toBe(false)
    })
  })

  describe('file-based classification (Option B)', () => {
    it('classifies commits touching project files even without scope match', () => {
      const input = createCommitInput('other-project', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(['abc123']),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('direct-file')
      expect(result.include).toBe(true)
      expect(result.preserveScope).toBe(true)
    })

    it('classifies unscoped commits touching project files', () => {
      const input = createCommitInput(undefined, 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(['abc123']),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('unscoped-file')
      expect(result.include).toBe(true)
      expect(result.preserveScope).toBe(false)
    })
  })

  describe('hybrid validation', () => {
    it('scope-based takes priority over file-based', () => {
      const input = createCommitInput('versioning', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(['abc123']),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('direct-scope')
    })

    it('file-based catches typos in scope', () => {
      const input = createCommitInput('versionng', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(['abc123']),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('direct-file')
      expect(result.include).toBe(true)
    })
  })

  describe('indirect dependency classification', () => {
    it('classifies commits to dependencies as indirect-dependency', () => {
      const input = createCommitInput('lib-utils', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
        dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('indirect-dependency')
      expect(result.include).toBe(true)
      expect(result.preserveScope).toBe(true)
      expect(result.dependencyPath).toEqual(['lib-utils'])
    })

    it('matches dependency scope variations', () => {
      const input = createCommitInput('utils', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
        dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('indirect-dependency')
      expect(result.include).toBe(true)
    })
  })

  describe('unscoped commit classification', () => {
    it('excludes unscoped commits not touching project files', () => {
      const input = createCommitInput(undefined, 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('unscoped-global')
      expect(result.include).toBe(false)
    })
  })

  describe('includeScopes option', () => {
    it('includes commits matching additional include scopes', () => {
      const input = createCommitInput('shared-utils', 'abc123')
      const context: ClassificationContext = {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
        includeScopes: ['shared-utils'],
      }

      const result = classifyCommit(input, context)

      expect(result.source).toBe('direct-scope')
      expect(result.include).toBe(true)
    })
  })
})

describe('classifyCommits', () => {
  it('classifies multiple commits', () => {
    const commits: CommitWithRaw[] = [
      createCommitInput('versioning', 'abc111', 'add feature'),
      createCommitInput('logging', 'abc222', 'unrelated'),
      createCommitInput(undefined, 'abc333', 'fix with file touch'),
      createCommitInput('release', 'abc444', 'release commit'),
    ]

    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(['abc333']),
      excludeScopes: ['release'],
    }

    const result = classifyCommits(commits, context)

    expect(result.commits).toHaveLength(4)
    expect(result.included).toHaveLength(2)
    expect(result.excluded).toHaveLength(2)
  })

  it('provides accurate summary', () => {
    const commits: CommitWithRaw[] = [
      createCommitInput('versioning', 'abc111'),
      createCommitInput('versioning', 'abc222'),
      createCommitInput('logging', 'abc333'),
    ]

    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
    }

    const result = classifyCommits(commits, context)

    expect(result.summary.total).toBe(3)
    expect(result.summary.included).toBe(2)
    expect(result.summary.excluded).toBe(1)
    expect(result.summary.bySource['direct-scope']).toBe(2)
    expect(result.summary.bySource['excluded']).toBe(1)
  })
})

describe('createClassificationContext', () => {
  it('creates context with defaults', () => {
    const context = createClassificationContext(['versioning'], new Set(['abc123']))

    expect(context.projectScopes).toEqual(['versioning'])
    expect(context.fileCommitHashes.has('abc123')).toBe(true)
    expect(context.excludeScopes).toContain('release')
  })

  it('accepts optional parameters', () => {
    const depMap = new Map([['lib-utils', new Set(['def456'])]])
    const infraHashes = new Set(['ghi789'])
    const context = createClassificationContext(['versioning'], new Set(['abc123']), {
      dependencyCommitMap: depMap,
      infrastructureCommitHashes: infraHashes,
      excludeScopes: ['custom-exclude'],
      includeScopes: ['shared'],
    })

    expect(context.dependencyCommitMap).toBe(depMap)
    expect(context.infrastructureCommitHashes).toBe(infraHashes)
    expect(context.excludeScopes).toEqual(['custom-exclude'])
    expect(context.includeScopes).toEqual(['shared'])
  })
})

describe('toChangelogCommit', () => {
  it('removes scope from direct-scope commits', () => {
    const input = createCommitInput('versioning', 'abc123', 'add feature')
    const classified = classifyCommit(input, {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
    })

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.scope).toEqual([])
    expect(changelogCommit.subject).toBe('add feature')
  })

  it('preserves scope from direct-file commits', () => {
    const input = createCommitInput('other', 'abc123', 'cross-cutting change')
    const classified = classifyCommit(input, {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(['abc123']),
    })

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.scope).toEqual(['other'])
  })

  it('preserves scope from indirect-dependency commits', () => {
    const input = createCommitInput('lib-utils', 'abc123', 'fix in dependency')
    const classified = classifyCommit(input, {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]),
    })

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.scope).toEqual(['lib-utils'])
  })

  it('rebuilds raw message without scope when removing scope', () => {
    const input = createCommitInput('versioning', 'abc123', 'add feature')
    const classified = classifyCommit(input, {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
    })

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.raw).toBe('feat: add feature')
  })

  it('rebuilds raw message with body when removing scope', () => {
    const commit = createConventionalCommit('feat', 'add feature', {
      scope: ['versioning'],
      body: 'This is the commit body.\n\nWith multiple paragraphs.',
    })
    const raw = createGitCommit({
      hash: 'abc123',
      authorName: 'Test',
      authorEmail: 'test@example.com',
      authorDate: '2026-03-17T10:00:00Z',
      subject: 'feat(versioning): add feature',
    })
    const classified = classifyCommit(
      { commit, raw },
      {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
      }
    )

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.raw).toContain('feat: add feature')
    expect(changelogCommit.raw).toContain('This is the commit body.')
  })

  it('rebuilds raw message with footers when removing scope', () => {
    const commit = createConventionalCommit('feat', 'add feature', {
      scope: ['versioning'],
      footers: [{ key: 'Reviewed-by', separator: ':', value: ' Team' }],
    })
    const raw = createGitCommit({
      hash: 'abc123',
      authorName: 'Test',
      authorEmail: 'test@example.com',
      authorDate: '2026-03-17T10:00:00Z',
      subject: 'feat(versioning): add feature',
    })
    const classified = classifyCommit(
      { commit, raw },
      {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
      }
    )

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.raw).toContain('Reviewed-by: Team')
  })

  it('includes breaking indicator when commit is breaking without description', () => {
    const commit = createConventionalCommit('feat', 'breaking change', {
      scope: ['versioning'],
      breaking: true,
      breakingDescription: undefined,
    })
    const raw = createGitCommit({
      hash: 'abc123',
      authorName: 'Test',
      authorEmail: 'test@example.com',
      authorDate: '2026-03-17T10:00:00Z',
      subject: 'feat(versioning)!: breaking change',
    })
    const classified = classifyCommit(
      { commit, raw },
      {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
      }
    )

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.raw).toBe('feat!: breaking change')
  })

  it('does not include breaking indicator when breakingDescription exists', () => {
    const commit = createConventionalCommit('feat', 'breaking change', {
      scope: ['versioning'],
      breaking: true,
      breakingDescription: 'API changed',
    })
    const raw = createGitCommit({
      hash: 'abc123',
      authorName: 'Test',
      authorEmail: 'test@example.com',
      authorDate: '2026-03-17T10:00:00Z',
      subject: 'feat(versioning): breaking change',
    })
    const classified = classifyCommit(
      { commit, raw },
      {
        projectScopes: ['versioning'],
        fileCommitHashes: new Set(),
      }
    )

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit.raw).toBe('feat: breaking change')
  })

  it('returns unchanged commit when no scope to remove', () => {
    const input = createCommitInput(undefined, 'abc123', 'unscoped commit')
    const classified = classifyCommit(input, {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(['abc123']),
    })

    const changelogCommit = toChangelogCommit(classified)

    expect(changelogCommit).toBe(classified.commit)
  })
})

describe('filterIncluded', () => {
  it('filters to only included commits', () => {
    const commits: CommitWithRaw[] = [
      createCommitInput('versioning', 'abc111'),
      createCommitInput('logging', 'abc222'),
      createCommitInput('versioning', 'abc333'),
    ]

    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
    }

    const result = classifyCommits(commits, context)
    const included = filterIncluded(result.commits)

    expect(included).toHaveLength(2)
    expect(included.every((c) => c.include)).toBe(true)
    expect(included.every((c) => c.source === 'direct-scope')).toBe(true)
  })

  it('returns empty array when no commits are included', () => {
    const commits: CommitWithRaw[] = [createCommitInput('logging', 'abc111'), createCommitInput('other', 'abc222')]

    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
    }

    const result = classifyCommits(commits, context)
    const included = filterIncluded(result.commits)

    expect(included).toHaveLength(0)
  })
})

describe('extractConventionalCommits', () => {
  it('extracts conventional commits from classified commits', () => {
    const commits: CommitWithRaw[] = [
      createCommitInput('versioning', 'abc111', 'first'),
      createCommitInput('versioning', 'abc222', 'second'),
    ]

    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
    }

    const result = classifyCommits(commits, context)
    const conventional = extractConventionalCommits(result.commits)

    expect(conventional).toHaveLength(2)
    expect(conventional[0]?.subject).toBe('first')
    expect(conventional[1]?.subject).toBe('second')
    expect(conventional[0]?.type).toBe('feat')
  })
})

describe('infrastructure classification', () => {
  it('classifies commits with matching infrastructure hash as indirect-infra', () => {
    const input = createCommitInput('package', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      infrastructureCommitHashes: new Set(['abc123']),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-infra')
    expect(result.include).toBe(true)
  })

  it('preserves scope for infrastructure commits', () => {
    const input = createCommitInput('tool-scripts', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      infrastructureCommitHashes: new Set(['abc123']),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-infra')
    expect(result.include).toBe(true)
    expect(result.preserveScope).toBe(true)
  })

  it('does not match commits without infrastructure hash', () => {
    const input = createCommitInput('unrelated', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      infrastructureCommitHashes: new Set(['other-hash']),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('excluded')
    expect(result.include).toBe(false)
  })

  it('classifies unscoped commits as indirect-infra when hash matches', () => {
    const input = createCommitInput(undefined, 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      infrastructureCommitHashes: new Set(['abc123']),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-infra')
    expect(result.include).toBe(true)
  })

  it('file-based detection takes priority over infrastructure', () => {
    const input = createCommitInput('other-project', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(['abc123']),
      infrastructureCommitHashes: new Set(['abc123']),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('direct-file')
    expect(result.include).toBe(true)
  })

  it('dependency detection takes priority over infrastructure', () => {
    const input = createCommitInput('lib-utils', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]),
      infrastructureCommitHashes: new Set(['abc123']),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-dependency')
    expect(result.include).toBe(true)
  })
})

describe('dependency scope variations', () => {
  it('matches @scoped/name dependencies by stripped name', () => {
    const input = createCommitInput('utils', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['@hyperfrontend/utils', new Set(['abc123'])]]),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-dependency')
    expect(result.include).toBe(true)
    expect(result.dependencyPath).toEqual(['@hyperfrontend/utils'])
  })

  it('does not match when dependency scope has no variations matching', () => {
    const input = createCommitInput('completely-different', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['lib-utils', new Set(['def456'])]]),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('excluded')
    expect(result.include).toBe(false)
  })

  it('excludes commits when scope matches dependency but hash is not in commit set (mislabeled commit)', () => {
    const input = createCommitInput('lib-utils', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['lib-utils', new Set(['different-hash'])]]),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('excluded')
    expect(result.include).toBe(false)
  })

  it('excludes commits when scope variation matches but hash is not verified', () => {
    const input = createCommitInput('utils', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['lib-utils', new Set(['other-hash'])]]),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('excluded')
    expect(result.include).toBe(false)
  })

  it('performs case-insensitive scope matching for dependencies', () => {
    const input = createCommitInput('LIB-UTILS', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-dependency')
    expect(result.include).toBe(true)
  })

  it('matches first dependency when multiple dependencies exist', () => {
    const input = createCommitInput('utils', 'abc123')
    const context: ClassificationContext = {
      projectScopes: ['versioning'],
      fileCommitHashes: new Set(),
      dependencyCommitMap: new Map([
        ['lib-utils', new Set(['abc123'])],
        ['@hyperfrontend/utils', new Set(['abc123'])],
      ]),
    }

    const result = classifyCommit(input, context)

    expect(result.source).toBe('indirect-dependency')
    expect(result.include).toBe(true)
    expect(result.dependencyPath).toEqual(['lib-utils'])
  })
})
