import type { ClassificationContext, CommitWithRaw } from './models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGitCommit } from '../../git/models/commit'
import { createConventionalCommit } from '../models/conventional'
import { classifyCommit } from './classifier'

/**
 * Creates a commit to classify.
 *
 * @param scope - The commit scope, or undefined for an unscoped commit
 * @param hash - The hash a dependency's commit set is searched for
 * @returns The parsed commit with its raw git data
 */
function createCommitInput(scope: string | undefined, hash: string): CommitWithRaw {
  return {
    commit: createConventionalCommit('fix', 'a change', { scope: scope === undefined ? [] : [scope] }),
    raw: createGitCommit({
      hash,
      authorName: 'Test',
      authorEmail: 'test@example.com',
      authorDate: '2026-11-05T10:00:00Z',
      subject: scope === undefined ? 'fix: a change' : `fix(${scope}): a change`,
    }),
  }
}

/**
 * Creates a classification context for a project named `versioning`.
 *
 * @param overrides - The fields that differ from an empty context
 * @returns A context with no project file commits unless the overrides name some
 */
function createContext(overrides: Partial<ClassificationContext>): ClassificationContext {
  return { projectScopes: ['versioning'], fileCommitHashes: new Set(), ...overrides }
}

describe('classifyCommit with dependency commits', () => {
  it('classifies a commit a dependency holds as indirect whatever its scope names', () => {
    const context = createContext({ dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]) })

    expect(classifyCommit(createCommitInput('unrelated', 'abc123'), context)).toEqual(
      expect.objectContaining({ source: 'indirect-dependency', include: true, dependencyPath: ['lib-utils'] })
    )
  })

  it('classifies an unscoped commit a dependency holds as indirect', () => {
    const context = createContext({ dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]) })

    expect(classifyCommit(createCommitInput(undefined, 'abc123'), context)).toEqual(
      expect.objectContaining({ source: 'indirect-dependency', dependencyPath: ['lib-utils'] })
    )
  })

  it('names the dependency the scope matches when several hold the commit', () => {
    const context = createContext({
      dependencyCommitMap: new Map([
        ['lib-logging', new Set(['abc123'])],
        ['lib-utils', new Set(['abc123'])],
      ]),
    })

    expect(classifyCommit(createCommitInput('utils', 'abc123'), context)).toEqual(
      expect.objectContaining({ dependencyPath: ['lib-utils'] })
    )
  })

  it('names the first dependency holding the commit when the scope matches none', () => {
    const context = createContext({
      dependencyCommitMap: new Map([
        ['lib-logging', new Set(['abc123'])],
        ['lib-utils', new Set(['abc123'])],
      ]),
    })

    expect(classifyCommit(createCommitInput('unrelated', 'abc123'), context)).toEqual(
      expect.objectContaining({ dependencyPath: ['lib-logging'] })
    )
  })

  it('keeps an excluded scope excluded when a dependency holds the commit', () => {
    const context = createContext({ excludeScopes: ['deps'], dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]) })

    expect(classifyCommit(createCommitInput('deps', 'abc123'), context)).toEqual(expect.objectContaining({ source: 'excluded' }))
  })

  it('keeps a commit that touches the project itself direct when a dependency also holds it', () => {
    const context = createContext({
      fileCommitHashes: new Set(['abc123']),
      dependencyCommitMap: new Map([['lib-utils', new Set(['abc123'])]]),
    })

    expect(classifyCommit(createCommitInput('lib-utils', 'abc123'), context)).toEqual(expect.objectContaining({ source: 'direct-file' }))
  })

  it('leaves a commit no dependency holds out of the indirect set', () => {
    const context = createContext({ dependencyCommitMap: new Map([['lib-utils', new Set(['other'])]]) })

    expect(classifyCommit(createCommitInput('lib-utils', 'abc123'), context)).toEqual(expect.objectContaining({ source: 'excluded' }))
  })
})
