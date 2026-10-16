import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { RepositoryConfig } from '../../repository/models/repository-config'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createResolveRepositoryStep } from './resolve-repository'

function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

function createMockTree(files: Record<string, string> = {}): Tree {
  // why: the real tree keys every path portably, so the native joins the step hands it must land on the POSIX seeds.
  const fileSystem = new Map(Object.entries(files).map(([filePath, content]) => [normalizePath(filePath), content]))

  return {
    root: '/workspace',
    read(filePath: string, encoding?: string) {
      const content = fileSystem.get(normalizePath(filePath))
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write: jest.fn(),
    exists: (path: string) => fileSystem.has(normalizePath(path)),
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: (path: string) => fileSystem.has(normalizePath(path)),
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

function createMockGitClient(options: { remoteUrl?: string | null } = {}): GitClient {
  const { remoteUrl = null } = options

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
    stage: () => true,
    unstage: () => true,
    stageAll: () => true,
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
    getRemoteUrl: jest.fn().mockResolvedValue(remoteUrl),
  } as unknown as GitClient
}

function createMockContext(overrides?: {
  tree?: Tree
  registry?: Registry
  git?: GitClient
  logger?: Logger
  state?: FlowState
  config?: Partial<FlowConfig>
}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: overrides?.tree ?? createMockTree(),
    registry: overrides?.registry ?? createMockRegistry(),
    git: overrides?.git ?? createMockGitClient(),
    logger: overrides?.logger ?? createMockLogger(),
    config: { preset: 'conventional', ...overrides?.config },
    state: overrides?.state ?? {},
  }
}

function resolvedTo(repositoryConfig: Partial<RepositoryConfig>) {
  return expect.objectContaining({
    status: 'success',
    stateUpdates: expect.objectContaining({ repositoryConfig: expect.objectContaining(repositoryConfig) }),
  })
}

describe('resolve-repository step', () => {
  describe('createResolveRepositoryStep', () => {
    describe('platform detection', () => {
      it('detects GitHub', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://github.com/owner/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.stateUpdates?.repositoryConfig?.platform).toBe('github')
      })

      it('detects GitLab', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://gitlab.com/group/project',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.stateUpdates?.repositoryConfig?.platform).toBe('gitlab')
      })

      it('detects Bitbucket', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://bitbucket.org/team/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.stateUpdates?.repositoryConfig?.platform).toBe('bitbucket')
      })
    })

    describe('shorthand formats', () => {
      it('handles github shorthand', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'github:owner/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })

      it('handles object format with url', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: {
              type: 'git',
              url: 'https://github.com/owner/repo.git',
            },
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })
    })

    describe('git remote formats', () => {
      it('handles HTTPS remote', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient({
          remoteUrl: 'https://github.com/owner/repo.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/owner/repo' }))
      })

      it('handles SSH remote', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient({
          remoteUrl: 'git@github.com:owner/repo.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })
    })

    describe('additional platform detection', () => {
      it('detects Azure DevOps', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://dev.azure.com/org/project/_git/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'azure-devops' }))
      })

      it('detects Azure DevOps visualstudio.com format', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://org.visualstudio.com/project/_git/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'azure-devops' }))
      })
    })

    describe('additional shorthand formats', () => {
      it('handles gitlab shorthand', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'gitlab:group/project',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' }))
      })

      it('handles bitbucket shorthand', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'bitbucket:team/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'bitbucket', baseUrl: 'https://bitbucket.org/team/repo' }))
      })

      it('handles git+https URL format', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: {
              type: 'git',
              url: 'git+https://github.com/owner/repo.git',
            },
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })
    })

    describe('additional git remote formats', () => {
      it('handles SSH remote for GitLab', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient({
          remoteUrl: 'git@gitlab.com:group/project.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' }))
      })

      it('handles SSH remote for Bitbucket', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient({
          remoteUrl: 'git@bitbucket.org:team/repo.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'bitbucket', baseUrl: 'https://bitbucket.org/team/repo' }))
      })

      it('handles HTTPS remote without .git extension', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient({
          remoteUrl: 'https://github.com/owner/repo',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/owner/repo' }))
      })
    })
  })
})
