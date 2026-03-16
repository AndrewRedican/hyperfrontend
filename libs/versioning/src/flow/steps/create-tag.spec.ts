import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'

import type { ChangelogEntry } from '../../changelog/models/entry'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'

import { createTagStep, createPushTagStep, CREATE_TAG_STEP_ID } from './create-tag'

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
  createTagFails?: boolean
  pushTagFails?: boolean
}

function createMockGitClient(options: MockGitClientOptions = {}): GitClient {
  const { createTagFails = false, pushTagFails = false } = options

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
    createTag: jest.fn((name: string, opts?: { message?: string }) => {
      if (createTagFails) {
        throw new Error('Mock tag creation failed')
      }
      return {
        name,
        hash: 'abc123',
        type: 'annotated' as const,
        message: opts?.message ?? 'Release',
        tagger: { name: 'Test', email: 'test@test.com', date: new Date() },
      }
    }),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: () => [],
    pushTag: jest.fn(() => {
      if (pushTagFails) {
        throw new Error('Mock push failed')
      }
      return true
    }),
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

function createMockChangelogItem(description: string): {
  description: string
  commits: readonly []
  references: readonly []
  breaking: boolean
} {
  return { description, commits: [], references: [], breaking: false }
}

function createMockChangelogEntry(): ChangelogEntry {
  return {
    version: '1.0.0',
    date: '2024-01-15',
    unreleased: false,
    sections: [
      {
        type: 'features',
        heading: 'Features',
        items: [createMockChangelogItem('Feature 1'), createMockChangelogItem('Feature 2')],
      },
      {
        type: 'fixes',
        heading: 'Bug Fixes',
        items: [createMockChangelogItem('Fix 1')],
      },
    ],
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

// ============================================================================
// Tests: createTagStep
// ============================================================================

describe('Create Tag Step', () => {
  describe('createTagStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createTagStep()

      expect(step.id).toBe(CREATE_TAG_STEP_ID)
      expect(step.id).toBe('create-tag')
      expect(step.name).toBe('Create Git Tag')
    })

    it('depends on create-commit step', () => {
      const step = createTagStep()

      expect(step.dependsOn).toContain('create-commit')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when skipGit is enabled', async () => {
      const step = createTagStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { skipGit: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('Git operations disabled')
    })

    it('skips when skipTag is enabled', async () => {
      const step = createTagStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { skipTag: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('Tag creation disabled')
    })

    it('skips when no bump needed (no nextVersion)', async () => {
      const step = createTagStep()
      const ctx = createMockContext({ bumpType: 'none', nextVersion: undefined })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('No version bump')
    })

    it('skips when bumpType is none', async () => {
      const step = createTagStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'none' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })
  })

  describe('execute - dry run', () => {
    it('returns success without creating tag in dry run', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { dryRun: true }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('Would create tag')
      expect(git.createTag).not.toHaveBeenCalled()
    })

    it('sets tagName in state during dry run', async () => {
      const step = createTagStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { dryRun: true })

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.tagName).toBeDefined()
    })
  })

  describe('execute - tag name interpolation', () => {
    it('uses default tag format with project name', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
        projectName: 'my-lib',
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.tagName).toBe('my-lib@1.0.0')
    })

    it('uses custom tag format', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '2.0.0', bumpType: 'major' }, { tagFormat: 'v${version}' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.tagName).toBe('v2.0.0')
    })

    it('interpolates packageName in tag format', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { tagFormat: '${packageName}@${version}' }),
        git,
        packageName: '@scope/my-pkg',
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.tagName).toBe('@scope/my-pkg@1.0.0')
    })
  })

  describe('execute - tag message', () => {
    it('creates tag with default message', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      await step.execute(ctx)

      expect(git.createTag).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringMatching(/Release 1\.0\.0/),
        })
      )
    })

    it('includes changelog highlights in tag message', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry(),
        }),
        git,
      }

      await step.execute(ctx)

      expect(git.createTag).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringMatching(/features.*2 changes/i),
        })
      )
    })
  })

  describe('execute - success', () => {
    it('creates tag and returns tag name', async () => {
      const step = createTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.tagName).toBeDefined()
      expect(result.message).toContain('Created tag')
    })

    it('logs tag creation', async () => {
      const step = createTagStep()
      const logger = createMockLogger()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        logger,
      }

      await step.execute(ctx)

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Created tag'))
    })
  })

  describe('execute - error handling', () => {
    it('fails when tag creation fails', async () => {
      const step = createTagStep()
      const git = createMockGitClient({ createTagFails: true })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.error).toBeDefined()
      expect(result.message).toContain('Failed to create tag')
    })

    it('wraps non-Error throws in Error objects', async () => {
      const step = createTagStep()
      const git = {
        ...createMockGitClient(),
        createTag: jest.fn(() => {
          throw 'string error' // Non-Error throw
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

// ============================================================================
// Tests: createPushTagStep
// ============================================================================

describe('Push Tag Step', () => {
  describe('createPushTagStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createPushTagStep()

      expect(step.id).toBe('push-tag')
      expect(step.name).toBe('Push Git Tag')
    })

    it('depends on create-tag step', () => {
      const step = createPushTagStep()

      expect(step.dependsOn).toContain('create-tag')
    })

    it('continues on error', () => {
      const step = createPushTagStep()

      expect(step.continueOnError).toBe(true)
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when skipGit is enabled', async () => {
      const step = createPushTagStep()
      const ctx = createMockContext({ tagName: 'v1.0.0' }, { skipGit: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('Git/tag operations disabled')
    })

    it('skips when skipTag is enabled', async () => {
      const step = createPushTagStep()
      const ctx = createMockContext({ tagName: 'v1.0.0' }, { skipTag: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when no tag name in state', async () => {
      const step = createPushTagStep()
      const ctx = createMockContext({})

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('No tag to push')
    })
  })

  describe('execute - dry run', () => {
    it('returns success without pushing in dry run', async () => {
      const step = createPushTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ tagName: 'v1.0.0' }, { dryRun: true }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('Would push tag')
      expect(git.pushTag).not.toHaveBeenCalled()
    })
  })

  describe('execute - success', () => {
    it('pushes tag successfully', async () => {
      const step = createPushTagStep()
      const git = createMockGitClient()
      const ctx: FlowContext = {
        ...createMockContext({ tagName: 'v1.0.0' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(git.pushTag).toHaveBeenCalledWith('v1.0.0')
      expect(result.message).toContain('Pushed tag')
    })

    it('logs push success', async () => {
      const step = createPushTagStep()
      const logger = createMockLogger()
      const ctx: FlowContext = {
        ...createMockContext({ tagName: 'v1.0.0' }),
        logger,
      }

      await step.execute(ctx)

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Pushed tag'))
    })
  })

  describe('execute - error handling', () => {
    it('fails when push fails', async () => {
      const step = createPushTagStep()
      const git = createMockGitClient({ pushTagFails: true })
      const ctx: FlowContext = {
        ...createMockContext({ tagName: 'v1.0.0' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.error).toBeDefined()
      expect(result.message).toContain('Failed to push tag')
    })

    it('wraps non-Error throws in Error objects', async () => {
      const step = createPushTagStep()
      const git = {
        ...createMockGitClient(),
        pushTag: jest.fn(() => {
          throw 'string error'
        }),
      } as unknown as GitClient
      const ctx: FlowContext = {
        ...createMockContext({ tagName: 'v1.0.0' }),
        git,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('failed')
      expect(result.error).toBeInstanceOf(Error)
    })
  })
})
