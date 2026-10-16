import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { RepositoryConfig } from '../../repository/models/repository-config'
import type { RepositoryResolution } from '../../repository/models/resolution'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { normalizePath, normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createResolveRepositoryStep, RESOLVE_REPOSITORY_STEP_ID } from './resolve-repository'

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
  describe('RESOLVE_REPOSITORY_STEP_ID', () => {
    it('has the correct ID', () => {
      expect(RESOLVE_REPOSITORY_STEP_ID).toBe('resolve-repository')
    })
  })

  describe('createResolveRepositoryStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createResolveRepositoryStep()

      expect(step).toEqual(expect.objectContaining({ id: 'resolve-repository', name: 'Resolve Repository' }))
    })

    describe('when repository is undefined', () => {
      it('skips with backward-compatible message', async () => {
        const ctx = createMockContext({
          config: { repository: undefined },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect({ status: result.status, message: result.message, stateUpdates: result.stateUpdates }).toEqual({
          status: 'skipped',
          message: 'Repository resolution disabled',
          stateUpdates: undefined,
        })
      })
    })

    describe('when repository is "disabled"', () => {
      it('skips with disabled message', async () => {
        const ctx = createMockContext({
          config: { repository: 'disabled' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect({ status: result.status, message: result.message, stateUpdates: result.stateUpdates }).toEqual({
          status: 'skipped',
          message: 'Repository resolution disabled',
          stateUpdates: undefined,
        })
      })
    })

    describe('when repository is a direct RepositoryConfig', () => {
      it('uses the provided config', async () => {
        const repoConfig: RepositoryConfig = {
          platform: 'github',
          baseUrl: 'https://github.com/owner/repo',
        }

        const ctx = createMockContext({
          config: { repository: repoConfig },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({ repositoryConfig: repoConfig }),
            message: expect.stringMatching(/explicit.*github/),
          })
        )
      })
    })

    describe('when repository is "inferred"', () => {
      it('infers from package.json repository field', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            repository: 'https://github.com/owner/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({
              repositoryConfig: { platform: 'github', baseUrl: 'https://github.com/owner/repo' },
            }),
          })
        )
      })

      it('infers from git remote when package.json has no repository', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
          }),
        })

        const git = createMockGitClient({
          remoteUrl: 'https://github.com/git-owner/git-repo.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({
              repositoryConfig: { platform: 'github', baseUrl: 'https://github.com/git-owner/git-repo' },
            }),
          })
        )
      })

      it('skips gracefully when neither source has repository info', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
          }),
        })

        const git = createMockGitClient({ remoteUrl: null })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect({ status: result.status, message: result.message, stateUpdates: result.stateUpdates }).toEqual({
          status: 'skipped',
          message: expect.stringContaining('Could not infer'),
          stateUpdates: undefined,
        })
      })

      it('skips gracefully when package.json does not exist', async () => {
        const tree = createMockTree({})
        const git = createMockGitClient({ remoteUrl: null })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: expect.stringContaining('Could not infer') }))
      })
    })

    describe('when repository is a RepositoryResolution', () => {
      describe('with mode "disabled"', () => {
        it('skips resolution', async () => {
          const resolution: RepositoryResolution = {
            mode: 'disabled',
          }

          const ctx = createMockContext({
            config: { repository: resolution },
          })

          const step = createResolveRepositoryStep()
          const result = await step.execute(ctx)

          expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: 'Repository resolution disabled' }))
        })
      })

      describe('with mode "explicit"', () => {
        it('uses provided repository', async () => {
          const resolution: RepositoryResolution = {
            mode: 'explicit',
            repository: {
              platform: 'gitlab',
              baseUrl: 'https://gitlab.com/group/project',
            },
          }

          const ctx = createMockContext({
            config: { repository: resolution },
          })

          const step = createResolveRepositoryStep()
          const result = await step.execute(ctx)

          expect(result).toEqual(
            expect.objectContaining({
              status: 'success',
              stateUpdates: expect.objectContaining({
                repositoryConfig: { platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' },
              }),
            })
          )
        })

        it('fails when repository is not provided', async () => {
          const resolution: RepositoryResolution = {
            mode: 'explicit',
          }

          const ctx = createMockContext({
            config: { repository: resolution },
          })

          const step = createResolveRepositoryStep()
          const result = await step.execute(ctx)

          expect(result).toEqual(
            expect.objectContaining({ status: 'failed', error: expect.any(Error), message: expect.stringContaining('required') })
          )
        })
      })

      describe('with mode "inferred"', () => {
        it('uses default inference order (package-json first)', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              repository: 'https://github.com/pkg-owner/pkg-repo',
            }),
          })

          const git = createMockGitClient({
            remoteUrl: 'https://github.com/git-owner/git-repo.git',
          })

          const resolution: RepositoryResolution = {
            mode: 'inferred',
          }

          const ctx = createMockContext({
            tree,
            git,
            config: { repository: resolution },
          })

          const step = createResolveRepositoryStep()
          const result = await step.execute(ctx)

          expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/pkg-owner/pkg-repo' }))
        })

        it('respects custom inference order', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              repository: 'https://github.com/pkg-owner/pkg-repo',
            }),
          })

          const git = createMockGitClient({
            remoteUrl: 'https://github.com/git-owner/git-repo.git',
          })

          const resolution: RepositoryResolution = {
            mode: 'inferred',
            inferenceOrder: ['git-remote', 'package-json'],
          }

          const ctx = createMockContext({
            tree,
            git,
            config: { repository: resolution },
          })

          const step = createResolveRepositoryStep()
          const result = await step.execute(ctx)

          expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/git-owner/git-repo' }))
        })

        it('falls back to next source when first fails', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
            }),
          })

          const git = createMockGitClient({
            remoteUrl: 'https://github.com/git-owner/git-repo.git',
          })

          const resolution: RepositoryResolution = {
            mode: 'inferred',
            inferenceOrder: ['package-json', 'git-remote'],
          }

          const ctx = createMockContext({
            tree,
            git,
            config: { repository: resolution },
          })

          const step = createResolveRepositoryStep()
          const result = await step.execute(ctx)

          expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/git-owner/git-repo' }))
        })
      })
    })

    describe('step metadata', () => {
      it('has a description', () => {
        const step = createResolveRepositoryStep()

        expect(step.description).toBe('Resolves repository configuration for compare URL generation')
      })
    })

    describe('logger calls', () => {
      it('logs debug when repository is undefined', async () => {
        const logger = createMockLogger()
        const ctx = createMockContext({
          logger,
          config: { repository: undefined },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.debug).toHaveBeenCalledWith('Repository resolution disabled')
      })

      it('logs debug when using explicit config', async () => {
        const logger = createMockLogger()
        const ctx = createMockContext({
          logger,
          config: {
            repository: {
              platform: 'github',
              baseUrl: 'https://github.com/owner/repo',
            },
          },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.debug).toHaveBeenCalledWith('Using explicit repository config: github')
      })

      it('logs debug when inference fails', async () => {
        const logger = createMockLogger()
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })
        const git = createMockGitClient({ remoteUrl: null })

        const ctx = createMockContext({
          logger,
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.debug).toHaveBeenCalledWith('Could not infer repository from package.json or git remote')
      })

      it('logs debug when package.json not found', async () => {
        const logger = createMockLogger()
        const tree = createMockTree({})
        const git = createMockGitClient({ remoteUrl: 'https://github.com/owner/repo.git' })

        const ctx = createMockContext({
          logger,
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.debug).toHaveBeenCalledWith(
          `package.json not found or not a file at ${normalizeToNative('/workspace/libs/test/package.json')}`
        )
      })

      it('logs debug when successfully inferring from source', async () => {
        const logger = createMockLogger()
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://github.com/owner/repo',
          }),
        })

        const ctx = createMockContext({
          logger,
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.debug).toHaveBeenCalledWith('Inferred repository from package-json: github')
      })
    })

    describe('RepositoryResolution with mode "inferred" graceful degradation', () => {
      it('skips when all inference sources fail', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })
        const git = createMockGitClient({ remoteUrl: null })

        const resolution: RepositoryResolution = {
          mode: 'inferred',
          inferenceOrder: ['package-json', 'git-remote'],
        }

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: resolution },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: expect.stringContaining('Could not infer') }))
      })

      it('handles empty inferenceOrder array', async () => {
        const resolution: RepositoryResolution = {
          mode: 'inferred',
          inferenceOrder: [],
        }

        const ctx = createMockContext({
          config: { repository: resolution },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: expect.stringContaining('Could not infer') }))
      })
    })

    describe('edge cases', () => {
      it('handles tree.read returning null for existing file', async () => {
        const tree = {
          root: '/workspace',
          read: () => null,
          write: jest.fn(),
          exists: () => true,
          delete: jest.fn(),
          rename: jest.fn(),
          isFile: () => true,
          children: () => [],
          listChanges: () => [],
        } as unknown as Tree

        const git = createMockGitClient({
          remoteUrl: 'https://github.com/git-owner/git-repo.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/git-owner/git-repo' }))
      })

      it('logs debug when tree.read returns null', async () => {
        const logger = createMockLogger()
        const tree = {
          root: '/workspace',
          read: () => null,
          write: jest.fn(),
          exists: () => true,
          delete: jest.fn(),
          rename: jest.fn(),
          isFile: () => true,
          children: () => [],
          listChanges: () => [],
        } as unknown as Tree

        const git = createMockGitClient({ remoteUrl: null })

        const ctx = createMockContext({
          logger,
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.debug).toHaveBeenCalledWith('Could not read package.json')
      })

      it('handles invalid JSON in package.json', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': 'not valid json',
        })

        const git = createMockGitClient({
          remoteUrl: 'https://github.com/git-owner/git-repo.git',
        })

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/git-owner/git-repo' }))
      })

      it('handles unknown repository configuration format', async () => {
        const logger = createMockLogger()
        const ctx = createMockContext({
          logger,
          config: { repository: { unknownKey: 'unknownValue' } as unknown as RepositoryConfig },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: 'Unknown repository configuration format' }))
      })

      it('warns about an unknown repository configuration format', async () => {
        const logger = createMockLogger()
        const ctx = createMockContext({
          logger,
          config: { repository: { unknownKey: 'unknownValue' } as unknown as RepositoryConfig },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.warn).toHaveBeenCalledWith('Unknown repository configuration format')
      })

      it('handles unknown inference source', async () => {
        const logger = createMockLogger()
        const resolution: RepositoryResolution = {
          mode: 'inferred',
          inferenceOrder: ['unknown-source' as 'package-json'],
        }

        const ctx = createMockContext({
          logger,
          config: { repository: resolution },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.status).toBe('skipped')
      })

      it('warns about the unknown inference source', async () => {
        const logger = createMockLogger()
        const resolution: RepositoryResolution = {
          mode: 'inferred',
          inferenceOrder: ['unknown-source' as 'package-json'],
        }

        const ctx = createMockContext({
          logger,
          config: { repository: resolution },
        })

        const step = createResolveRepositoryStep()
        await step.execute(ctx)

        expect(logger.warn).toHaveBeenCalledWith('Unknown inference source: unknown-source')
      })
    })

    describe('RepositoryConfig with all platforms', () => {
      it('handles azure-devops platform', async () => {
        const repoConfig: RepositoryConfig = {
          platform: 'azure-devops',
          baseUrl: 'https://dev.azure.com/org/project/_git/repo',
        }

        const ctx = createMockContext({
          config: { repository: repoConfig },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({ repositoryConfig: expect.objectContaining({ platform: 'azure-devops' }) }),
            message: expect.stringContaining('azure-devops'),
          })
        )
      })

      it('handles bitbucket platform', async () => {
        const repoConfig: RepositoryConfig = {
          platform: 'bitbucket',
          baseUrl: 'https://bitbucket.org/team/repo',
        }

        const ctx = createMockContext({
          config: { repository: repoConfig },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({ repositoryConfig: expect.objectContaining({ platform: 'bitbucket' }) }),
            message: expect.stringContaining('bitbucket'),
          })
        )
      })
    })
  })
})
