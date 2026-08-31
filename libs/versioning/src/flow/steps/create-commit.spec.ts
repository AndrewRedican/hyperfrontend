import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createGitCommitStep, CREATE_COMMIT_STEP_ID } from './create-commit'

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

function createMockRegistry(): Registry {
  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      return null
    },
    async isVersionPublished() {
      return false
    },
    async getPackageInfo() {
      return null
    },
    async getVersionInfo() {
      return null
    },
    async listVersions() {
      return []
    },
  }
}

interface MockGitClientOptions {
  stageFails?: boolean
  commitFails?: boolean
}

function createMockGitClient(options: MockGitClientOptions = {}): GitClient {
  const { stageFails = false, commitFails = false } = options

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
    createCommit: jest.fn((message: string) => {
      if (commitFails) {
        throw new Error('Mock commit failed')
      }
      return {
        hash: 'abc123def456',
        message,
        author: 'Test User',
        email: 'test@test.com',
        date: new Date().toISOString(),
        parents: [],
      }
    }),
    stage: jest.fn(() => {
      if (stageFails) {
        throw new Error('Mock stage failed')
      }
      return true
    }),
    unstage: () => true,
    stageAll: jest.fn(() => {
      if (stageFails) {
        throw new Error('Mock stage all failed')
      }
      return true
    }),
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

describe('Create Commit Step', () => {
  describe('createGitCommitStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createGitCommitStep()

      expect(step.id).toBe(CREATE_COMMIT_STEP_ID)
      expect(step.id).toBe('create-commit')
      expect(step.name).toBe('Create Version Commit')
    })

    it('depends on update-packages and write-changelog', () => {
      const step = createGitCommitStep()

      expect(step.dependsOn).toContain('update-packages')
      expect(step.dependsOn).toContain('write-changelog')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when skipGit is enabled', async () => {
      const step = createGitCommitStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { skipGit: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('Git operations disabled')
    })

    it('skips when no bump needed (no nextVersion)', async () => {
      const step = createGitCommitStep()
      const ctx = createMockContext({ bumpType: 'none', nextVersion: undefined })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('No version bump')
    })

    it('skips when bumpType is none', async () => {
      const step = createGitCommitStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'none' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })
  })

  describe('execute - dry run', () => {
    it('returns success without creating commit in dry run', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.1.0', bumpType: 'minor' }, { dryRun: true }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('Would commit')
      expect(git.createCommit).not.toHaveBeenCalled()
    })

    it('includes commit message in dry run output', async () => {
      const step = createGitCommitStep()
      const ctx = createMockContext({ nextVersion: '2.0.0', bumpType: 'major' }, { dryRun: true })

      const result = await step.execute(ctx)

      expect(result.message).toContain('lib-test')
      expect(result.message).toContain('2.0.0')
    })
  })

  describe('execute - commit message interpolation', () => {
    it('uses default commit message with project name', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      await step.execute(ctx)

      expect(git.createCommit).toHaveBeenCalledWith(expect.stringContaining('lib-test'))
    })

    it('uses custom commit message template', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '3.0.0', bumpType: 'major' }, { commitMessage: 'release(${packageName}): v${version}' }),
        git,
      }

      await step.execute(ctx)

      expect(git.createCommit).toHaveBeenCalledWith('release(@test/pkg): v3.0.0')
    })

    it('interpolates projectName in message', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { commitMessage: 'release ${projectName} ${version}' }),
        git,
        projectName: 'my-library',
      }

      await step.execute(ctx)

      expect(git.createCommit).toHaveBeenCalledWith('release my-library 1.0.0')
    })
  })

  describe('execute - file staging', () => {
    it('stages specific modified files when provided', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          modifiedFiles: ['/workspace/libs/test/package.json', '/workspace/libs/test/CHANGELOG.md'],
        }),
        git,
      }

      await step.execute(ctx)

      expect(git.stage).toHaveBeenCalledWith(['/workspace/libs/test/package.json', '/workspace/libs/test/CHANGELOG.md'])
      expect(git.stageAll).not.toHaveBeenCalled()
    })

    it('stages all files when no modified files tracked', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      await step.execute(ctx)

      expect(git.stageAll).toHaveBeenCalled()
    })

    it('stages all files when modified files is empty', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor', modifiedFiles: [] }),
        git,
      }

      await step.execute(ctx)

      expect(git.stageAll).toHaveBeenCalled()
    })
  })

  describe('execute - success', () => {
    it('creates commit and returns commit hash', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.commitHash).toBe('abc123def456')
      expect(result.message).toContain('Created commit')
      expect(result.message).toContain('abc123d')
    })

    it('logs commit creation', async () => {
      const step = createGitCommitStep()
      const logger = createMockLogger()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        logger,
      }

      await step.execute(ctx)

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Created commit'))
    })
  })

  describe('execute - error handling', () => {
    it('fails when staging files fails', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient({ stageFails: true })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          modifiedFiles: ['some-file.txt'],
        }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.error).toBeDefined()
      expect(result.message).toContain('Failed to stage')
    })

    it('fails when commit creation fails', async () => {
      const step = createGitCommitStep()
      const git = createMockGitClient({ commitFails: true })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.error).toBeDefined()
      expect(result.message).toContain('Failed to create commit')
    })

    it('wraps non-Error throws in Error objects', async () => {
      const step = createGitCommitStep()
      const git = {
        ...createMockGitClient(),
        stageAll: jest.fn(() => {
          throw 'string error'
        }),
      } as unknown as GitClient
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.error).toBeInstanceOf(Error)
    })
  })
})
