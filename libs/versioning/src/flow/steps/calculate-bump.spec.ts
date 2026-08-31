import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'

import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'

import { createCalculateBumpStep, createCheckIdempotencyStep, CALCULATE_BUMP_STEP_ID } from './calculate-bump'

function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

function createMockTree(): Tree {
  return {
    root: '/workspace',
    read: () => null,
    write: jest.fn(),
    exists: () => false,
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: () => false,
    children: () => [],
    listChanges: () => [],
  } as unknown as Tree
}

interface MockRegistryOptions {
  publishedVersions?: string[]
}

function createMockRegistry(options: MockRegistryOptions = {}): Registry {
  const { publishedVersions = [] } = options

  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      return publishedVersions.length > 0 ? <string>publishedVersions[publishedVersions.length - 1] : null
    },
    async isVersionPublished(_packageName: string, version: string) {
      return publishedVersions.includes(version)
    },
    async getPackageInfo() {
      return null
    },
    async getVersionInfo() {
      return null
    },
    async listVersions() {
      return publishedVersions
    },
  }
}

function createMockGitClient(): GitClient {
  return {
    cwd: '/workspace',
    timeout: 30000,
    getCommitLog: () => [],
    getCommitsBetween: () => [],
    getCommitsSince: () => [],
    getCommit: () => null,
    commitExists: () => true,
    getTags: () => [],
    getTag: () => null,
    createTag: jest.fn(),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: () => [],
    pushTag: () => true,
    createCommit: jest.fn(),
    stage: jest.fn(),
    unstage: () => true,
    stageAll: jest.fn(),
    amendCommit: jest.fn(),
    createEmptyCommit: jest.fn(),
    getHead: () => 'abc123',
    getCurrentBranch: () => 'main',
    hasStagedChanges: () => false,
    hasUnstagedChanges: () => false,
    hasUntrackedFiles: () => false,
    getStatus: () => ({
      clean: true,
      entries: [],
      staged: [],
      unstaged: [],
      untracked: [],
    }),
    isClean: () => true,
    getRepositoryRoot: () => '/workspace',
    getHeadHash: () => 'abc123',
    getHeadShortHash: () => 'abc123',
    getModifiedFiles: () => [],
    getUntrackedFiles: () => [],
    getStagedFiles: () => [],
  } as unknown as GitClient
}

function createMockCommit(overrides: Partial<ConventionalCommit> = {}): ConventionalCommit {
  return {
    type: 'feat',
    scope: [],
    subject: 'test commit',
    breaking: false,
    breakingDescription: undefined,
    body: undefined,
    footers: [],
    raw: 'feat: test commit',
    ...overrides,
  }
}

function createMockContext(state: Partial<FlowState> = {}, config: Partial<FlowConfig> = {}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: createMockTree(),
    registry: createMockRegistry(),
    git: createMockGitClient(),
    logger: createMockLogger(),
    config: { preset: 'conventional', ...config },
    state: { ...state },
  }
}

describe('Calculate Bump Step', () => {
  describe('createCalculateBumpStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createCalculateBumpStep()

      expect(step.id).toBe(CALCULATE_BUMP_STEP_ID)
      expect(step.name).toBe('Calculate Version Bump')
    })

    it('depends on analyze-commits step', () => {
      const step = createCalculateBumpStep()

      expect(step.dependsOn).toContain('analyze-commits')
    })
  })

  describe('execute - first release', () => {
    it('handles first release with default version', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ isFirstRelease: true })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
            nextVersion: '0.1.0',
            isPendingPublication: false,
          }),
          message: expect.stringContaining('First release'),
        })
      )
    })

    it('handles first release with custom version', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ isFirstRelease: true }, { firstReleaseVersion: '1.0.0' })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            nextVersion: '1.0.0',
          }),
        })
      )
    })

    it('marks pending publication when package.json already bumped to first version', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ isFirstRelease: true, currentVersion: '0.1.0' })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            nextVersion: '0.1.0',
            isPendingPublication: true,
          }),
        })
      )
    })
  })

  describe('execute - no commits', () => {
    it('skips when no commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ commits: [] })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'skipped',
          message: expect.stringContaining('No releasable commits'),
        })
      )
    })

    it('skips when commits is undefined', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({})

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'skipped',
        })
      )
    })
  })

  describe('execute - breaking changes', () => {
    it('calculates major bump for breaking changes (post-1.0.0)', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        commits: [createMockCommit({ type: 'feat', subject: 'add feature', breaking: true })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'major',
            nextVersion: '2.0.0',
          }),
        })
      )
    })

    it('calculates minor bump for breaking changes (pre-1.0.0)', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.5.0',
        commits: [createMockCommit({ type: 'feat', subject: 'breaking change', breaking: true })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
            nextVersion: '0.6.0',
          }),
        })
      )
    })
  })

  describe('execute - minor bumps', () => {
    it('calculates minor bump for feat commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.2.3',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
            nextVersion: '1.3.0',
          }),
        })
      )
    })

    it('uses custom minorTypes from config', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext(
        {
          currentVersion: '1.0.0',
          commits: [createMockCommit({ type: 'enhancement', subject: 'something', breaking: false })],
        },
        { minorTypes: ['feat', 'enhancement'] }
      )

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
          }),
        })
      )
    })
  })

  describe('execute - patch bumps', () => {
    it('calculates patch bump for fix commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.2.3',
        commits: [createMockCommit({ type: 'fix', subject: 'bug fix', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'patch',
            nextVersion: '1.2.4',
          }),
        })
      )
    })

    it('calculates patch bump for perf commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        commits: [createMockCommit({ type: 'perf', subject: 'performance improvement', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          stateUpdates: expect.objectContaining({
            bumpType: 'patch',
          }),
        })
      )
    })

    it('calculates patch bump for revert commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        commits: [createMockCommit({ type: 'revert', subject: 'revert something', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          stateUpdates: expect.objectContaining({
            bumpType: 'patch',
          }),
        })
      )
    })

    it('uses custom patchTypes from config', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext(
        {
          currentVersion: '1.0.0',
          commits: [createMockCommit({ type: 'bugfix', subject: 'fix', breaking: false })],
        },
        { patchTypes: ['fix', 'bugfix'] }
      )

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          stateUpdates: expect.objectContaining({
            bumpType: 'patch',
          }),
        })
      )
    })
  })

  describe('execute - no bump needed', () => {
    it('returns none for non-releasable commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        commits: [
          createMockCommit({ type: 'chore', subject: 'update deps', breaking: false }),
          createMockCommit({ type: 'docs', subject: 'fix typo', breaking: false }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'none',
            nextVersion: undefined,
          }),
        })
      )
    })
  })

  describe('execute - multiple commits', () => {
    it('takes highest priority bump (breaking > feat > fix)', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        commits: [
          createMockCommit({ type: 'fix', subject: 'fix1', breaking: false }),
          createMockCommit({ type: 'feat', subject: 'feat1', breaking: false }),
          createMockCommit({ type: 'feat', subject: 'breaking feat', breaking: true }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          stateUpdates: expect.objectContaining({
            bumpType: 'major',
          }),
        })
      )
    })

    it('takes feat over fix', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        commits: [
          createMockCommit({ type: 'fix', subject: 'fix1', breaking: false }),
          createMockCommit({ type: 'fix', subject: 'fix2', breaking: false }),
          createMockCommit({ type: 'feat', subject: 'feat1', breaking: false }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
          }),
        })
      )
    })
  })

  describe('execute - invalid version', () => {
    it('fails when current version is invalid', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: 'not-a-version',
        commits: [createMockCommit({ type: 'feat', subject: 'new', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'failed',
          error: expect.anything(),
          message: expect.stringContaining('Could not parse'),
        })
      )
    })
  })

  describe('execute - releaseAs (forced bump)', () => {
    it('forces major bump via releaseAs, ignoring commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext(
        {
          currentVersion: '1.2.3',
          commits: [createMockCommit({ type: 'fix', subject: 'minor fix', breaking: false })],
        },
        { releaseAs: 'major' }
      )

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'major',
            nextVersion: '2.0.0',
          }),
          message: expect.stringContaining('forced'),
        })
      )
    })

    it('forces minor bump via releaseAs', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext(
        {
          currentVersion: '1.2.3',
          commits: [createMockCommit({ type: 'chore', subject: 'cleanup', breaking: false })],
        },
        { releaseAs: 'minor' }
      )

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
            nextVersion: '1.3.0',
          }),
        })
      )
    })

    it('forces patch bump via releaseAs', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext(
        {
          currentVersion: '1.2.3',
          commits: [createMockCommit({ type: 'feat', subject: 'new feature', breaking: true })],
        },
        { releaseAs: 'patch' }
      )

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'patch',
            nextVersion: '1.2.4',
          }),
        })
      )
    })

    it('releaseAs works even with no commits', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: '2.0.0', commits: [] }, { releaseAs: 'minor' })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
            nextVersion: '2.1.0',
          }),
        })
      )
    })

    it('realigns a derived bump onto the published version when the branch is behind', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.1.0',
        publishedVersion: '0.2.1',
        commits: [createMockCommit({ type: 'fix', subject: 'a fix', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.nextVersion).toBe('0.2.2')
      expect(result.stateUpdates?.isPendingPublication).toBe(false)
    })

    it('keeps recalculating from the published version when the branch is ahead', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.3.0',
        publishedVersion: '0.2.1',
        commits: [createMockCommit({ type: 'fix', subject: 'a fix', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.nextVersion).toBe('0.2.2')
      expect(result.stateUpdates?.isPendingPublication).toBe(true)
    })

    it('forces the bump from the published version rather than the local one', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: '0.1.1', publishedVersion: '0.1.1', commits: [] }, { releaseAs: 'major' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.nextVersion).toBe('1.0.0')
    })

    it('refuses when the local version has already run ahead of the published one', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: '1.0.0', publishedVersion: '0.1.1', commits: [] }, { releaseAs: 'major' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.message).toContain('disagrees with published')
    })

    it('refuses when the local version is behind the published one', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: '0.0.9', publishedVersion: '0.1.1', commits: [] }, { releaseAs: 'major' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.message).toContain('disagrees with published')
    })

    it('forces the bump from the local version when nothing has been published yet', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: '0.4.0', publishedVersion: null, commits: [] }, { releaseAs: 'minor' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.nextVersion).toBe('0.5.0')
    })

    it('fails when the published version cannot be parsed', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: '1.0.0', publishedVersion: 'not-a-version', commits: [] }, { releaseAs: 'patch' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.message).toContain('Could not parse published version')
    })

    it('releaseAs fails with invalid current version', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ currentVersion: 'invalid', commits: [] }, { releaseAs: 'patch' })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'failed',
          error: expect.anything(),
          message: expect.stringContaining('Could not parse'),
        })
      )
    })

    it('first release takes priority over releaseAs', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({ isFirstRelease: true, currentVersion: '0.0.0' }, { releaseAs: 'major', firstReleaseVersion: '0.1.0' })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            nextVersion: '0.1.0',
          }),
          message: expect.stringContaining('First release'),
        })
      )
    })
  })

  describe('execute - message formatting', () => {
    it('includes version transition in message', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '2.3.4',
        commits: [createMockCommit({ type: 'feat', subject: 'feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            bumpType: 'minor',
            nextVersion: '2.4.0',
          }),
          message: expect.stringContaining('minor bump'),
        })
      )
    })
  })

  describe('execute - pending publication detection', () => {
    it('detects pending publication when currentVersion > publishedVersion', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.2.0',
        publishedVersion: '0.1.0',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: true,
            bumpType: 'minor',
            nextVersion: '0.2.0',
          }),
          message: expect.stringContaining('pending'),
        })
      )
    })

    it('recalculates version from publishedVersion when pending (same result)', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.2.0',
        publishedVersion: '0.1.0',
        commits: [createMockCommit({ type: 'feat', subject: 'feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            nextVersion: '0.2.0',
            isPendingPublication: true,
          }),
        })
      )
    })

    it('escalates version when pending publication needs higher bump', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.1.1',
        publishedVersion: '0.1.0',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: true,
            bumpType: 'minor',
            nextVersion: '0.2.0',
          }),
        })
      )
    })

    it('de-escalates version when pending publication needs lower bump', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.2.0',
        publishedVersion: '0.1.0',
        commits: [createMockCommit({ type: 'fix', subject: 'bug fix', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: true,
            bumpType: 'patch',
            nextVersion: '0.1.1',
          }),
        })
      )
    })

    it('handles pending publication with major bump (post-1.0.0)', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.1.0',
        publishedVersion: '1.0.0',
        commits: [createMockCommit({ type: 'feat', subject: 'breaking', breaking: true })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: true,
            bumpType: 'major',
            nextVersion: '2.0.0',
          }),
        })
      )
    })

    it('does not detect pending publication when versions are equal', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '1.0.0',
        publishedVersion: '1.0.0',
        commits: [createMockCommit({ type: 'feat', subject: 'feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: false,
            nextVersion: '1.1.0',
          }),
          message: expect.not.stringContaining('pending'),
        })
      )
    })

    it('does not detect pending publication when publishedVersion is null', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.1.0',
        publishedVersion: null,
        commits: [createMockCommit({ type: 'feat', subject: 'feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: false,
            nextVersion: '0.2.0',
          }),
        })
      )
    })

    it('does not detect pending publication when publishedVersion is undefined', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.1.0',
        commits: [createMockCommit({ type: 'feat', subject: 'feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: false,
          }),
        })
      )
    })

    it('handles multiple stacked pending versions correctly', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.3.0',
        publishedVersion: '0.1.0',
        commits: [createMockCommit({ type: 'feat', subject: 'feature', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          stateUpdates: expect.objectContaining({
            isPendingPublication: true,
            nextVersion: '0.2.0',
          }),
        })
      )
    })

    it('pending publication message shows correct version transition', async () => {
      const step = createCalculateBumpStep()
      const ctx = createMockContext({
        currentVersion: '0.2.0',
        publishedVersion: '0.1.0',
        commits: [createMockCommit({ type: 'fix', subject: 'bug fix', breaking: false })],
      })

      const result = await step.execute(ctx)

      expect(result.message).toContain('0.1.0')
      expect(result.message).toContain('0.1.1')
      expect(result.message).toContain('pending')
    })
  })
})

describe('Check Idempotency Step', () => {
  describe('createCheckIdempotencyStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createCheckIdempotencyStep()

      expect(step.id).toBe('check-idempotency')
      expect(step.name).toBe('Check Idempotency')
    })

    it('depends on calculate-bump step', () => {
      const step = createCheckIdempotencyStep()

      expect(step.dependsOn).toContain('calculate-bump')
    })
  })

  describe('execute - no bump needed', () => {
    it('succeeds when no bump needed (no nextVersion)', async () => {
      const step = createCheckIdempotencyStep()
      const ctx = createMockContext({ bumpType: 'none', nextVersion: undefined })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('No version to check')
    })

    it('succeeds when bumpType is none', async () => {
      const step = createCheckIdempotencyStep()
      const ctx = createMockContext({ bumpType: 'none' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
    })
  })

  describe('execute - version not published', () => {
    it('succeeds when version is not published', async () => {
      const step = createCheckIdempotencyStep()
      const ctx: FlowContext = {
        ...createMockContext({ bumpType: 'minor', nextVersion: '1.1.0' }),
        registry: createMockRegistry({ publishedVersions: ['1.0.0'] }),
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('not yet published')
    })
  })

  describe('execute - version already published', () => {
    it('skips and resets state when version is already published', async () => {
      const step = createCheckIdempotencyStep()
      const ctx: FlowContext = {
        ...createMockContext({ bumpType: 'minor', nextVersion: '1.1.0' }),
        registry: createMockRegistry({ publishedVersions: ['1.0.0', '1.1.0'] }),
      }

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'skipped',
          stateUpdates: expect.objectContaining({
            bumpType: 'none',
            nextVersion: undefined,
          }),
          message: expect.stringContaining('already published'),
        })
      )
    })
  })
})
