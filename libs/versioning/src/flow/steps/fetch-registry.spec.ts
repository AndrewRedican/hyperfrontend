import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFetchRegistryStep, FETCH_REGISTRY_STEP_ID } from './fetch-registry'

function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

function createMockTree(files: Record<string, string> = {}, throwOnRead = false): Tree {
  // why: the real tree keys every path portably, so the native joins the step hands it must land on the POSIX seeds.
  const fileSystem = new Map(Object.entries(files).map(([filePath, content]) => [normalizePath(filePath), content]))

  return {
    root: '/workspace',
    read(filePath: string, encoding?: string) {
      if (throwOnRead) {
        throw new Error('Simulated read error')
      }
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

function createMockRegistry(
  options: {
    version?: string | null
    gitHead?: string | null
    throwOnQuery?: boolean
    throwOnVersionInfo?: boolean
  } = {}
): Registry {
  const { version = null, gitHead = null, throwOnQuery = false, throwOnVersionInfo = false } = options

  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      if (throwOnQuery) {
        throw new Error('Registry query failed')
      }
      return version
    },
    async isVersionPublished(_pkg: string, v: string) {
      return v === version
    },
    async getPackageInfo() {
      return null
    },
    async getVersionInfo(_pkg: string, v: string) {
      if (throwOnVersionInfo) {
        throw new Error('Version info query failed')
      }
      if (v === version && version !== null) {
        return {
          version: v,
          publishedAt: '2026-03-18T00:00:00.000Z',
          tarball: `https://mock.registry.com/${v}.tgz`,
          gitHead: gitHead ?? undefined,
        }
      }
      return null
    },
    async listVersions() {
      return version ? [version] : []
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
  } as unknown as GitClient
}

function createMockContext(overrides?: {
  tree?: Tree
  registry?: Registry
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
    git: createMockGitClient(),
    logger: overrides?.logger ?? createMockLogger(),
    config: { preset: 'conventional', ...overrides?.config },
    state: overrides?.state ?? {},
  }
}

describe('fetch-registry step', () => {
  describe('FETCH_REGISTRY_STEP_ID', () => {
    it('has the correct ID', () => {
      expect(FETCH_REGISTRY_STEP_ID).toBe('fetch-registry')
    })
  })

  describe('createFetchRegistryStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createFetchRegistryStep()

      expect(step).toEqual(expect.objectContaining({ id: 'fetch-registry', name: 'Fetch Registry Version', execute: expect.any(Function) }))
    })

    describe('execute', () => {
      it('reads current version from package.json', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.2.3',
          }),
        })
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ currentVersion: '1.2.3' }) })
        )
      })

      it('defaults to 0.0.0 when package.json has no version', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
          }),
        })
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ currentVersion: '0.0.0' }) })
        )
      })

      it('defaults to 0.0.0 when package.json does not exist', async () => {
        const tree = createMockTree({})
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ currentVersion: '0.0.0' }) })
        )
      })

      it('defaults to 0.0.0 when package.json read throws', async () => {
        const tree = createMockTree({}, true)
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ currentVersion: '0.0.0' }) })
        )
      })

      it('logs a warning when package.json read throws', async () => {
        const tree = createMockTree({}, true)
        const logger = createMockLogger()
        const context = createMockContext({ tree, logger })
        const step = createFetchRegistryStep()

        await step.execute(context)

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read package.json'))
      })

      it('fetches published version from registry', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.0.0',
          }),
        })
        const registry = createMockRegistry({ version: '1.0.0' })
        const context = createMockContext({ tree, registry })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({ publishedVersion: '1.0.0', isFirstRelease: false }),
          })
        )
      })

      it('handles first release when no published version exists', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '0.0.0',
          }),
        })
        const registry = createMockRegistry({ version: null })
        const context = createMockContext({ tree, registry })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({
            status: 'success',
            stateUpdates: expect.objectContaining({ publishedVersion: null, isFirstRelease: true }),
            message: expect.stringContaining('First release'),
          })
        )
      })

      it('surfaces a registry query failure instead of assuming a first release', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.0.0',
          }),
        })
        const registry = createMockRegistry({ throwOnQuery: true })
        const logger = createMockLogger()
        const context = createMockContext({ tree, registry, logger })
        const step = createFetchRegistryStep()

        await expect(step.execute(context)).rejects.toThrow()
      })

      it('returns appropriate message for published package', async () => {
        const tree = createMockTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '2.0.0',
          }),
        })
        const registry = createMockRegistry({ version: '1.5.0' })
        const context = createMockContext({ tree, registry })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(expect.objectContaining({ status: 'success', message: 'Published: 1.5.0, Local: 2.0.0' }))
      })

      describe('publishedCommit extraction', () => {
        it('extracts gitHead as publishedCommit when available', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            gitHead: 'abc1234567890def',
          })
          const context = createMockContext({ tree, registry })
          const step = createFetchRegistryStep()

          const result = await step.execute(context)

          expect(result).toEqual(
            expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ publishedCommit: 'abc1234567890def' }) })
          )
        })

        it('logs the published commit when gitHead is available', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            gitHead: 'abc1234567890def',
          })
          const logger = createMockLogger()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Published 1.0.0 at commit abc1234'))
        })

        it('sets publishedCommit to null when gitHead is missing', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            gitHead: null,
          })
          const context = createMockContext({ tree, registry })
          const step = createFetchRegistryStep()

          const result = await step.execute(context)

          expect(result).toEqual(
            expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ publishedCommit: null }) })
          )
        })

        it('logs that the published version has no gitHead when it is missing', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            gitHead: null,
          })
          const logger = createMockLogger()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('has no gitHead'))
        })

        it('surfaces a version-info failure instead of releasing without a base commit', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            throwOnVersionInfo: true,
          })
          const logger = createMockLogger()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          await expect(step.execute(context)).rejects.toThrow()
        })

        it('includes commit hash in message when available', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '2.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.5.0',
            gitHead: 'def4567890abcdef',
          })
          const context = createMockContext({ tree, registry })
          const step = createFetchRegistryStep()

          const result = await step.execute(context)

          expect(result).toEqual(expect.objectContaining({ status: 'success', message: 'Published: 1.5.0 @ def4567, Local: 2.0.0' }))
        })

        it('sets publishedCommit to null for first release', async () => {
          const tree = createMockTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '0.0.0',
            }),
          })
          const registry = createMockRegistry({ version: null })
          const context = createMockContext({ tree, registry })
          const step = createFetchRegistryStep()

          const result = await step.execute(context)

          expect(result).toEqual(
            expect.objectContaining({
              status: 'success',
              stateUpdates: expect.objectContaining({ publishedCommit: null, isFirstRelease: true }),
            })
          )
        })
      })
    })
  })
})
