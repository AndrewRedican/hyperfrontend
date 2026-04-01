import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'

import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'

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
  const fileSystem = new Map(Object.entries(files))

  return {
    root: '/workspace',
    read(filePath: string, encoding?: string) {
      if (throwOnRead) {
        throw new Error('Simulated read error')
      }
      const content = fileSystem.get(filePath)
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write: jest.fn(),
    exists: (path: string) => fileSystem.has(path),
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: (path: string) => fileSystem.has(path),
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

      expect(step.id).toBe('fetch-registry')
      expect(step.name).toBe('Fetch Registry Version')
      expect(typeof step.execute).toBe('function')
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

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.currentVersion).toBe('1.2.3')
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

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.currentVersion).toBe('0.0.0')
      })

      it('defaults to 0.0.0 when package.json does not exist', async () => {
        const tree = createMockTree({})
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.currentVersion).toBe('0.0.0')
      })

      it('logs warning and defaults to 0.0.0 when package.json read throws', async () => {
        const tree = createMockTree({}, true)
        const logger = createMockLogger()
        const context = createMockContext({ tree, logger })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.currentVersion).toBe('0.0.0')
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

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.publishedVersion).toBe('1.0.0')
        expect(result.stateUpdates?.isFirstRelease).toBe(false)
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

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.publishedVersion).toBe(null)
        expect(result.stateUpdates?.isFirstRelease).toBe(true)
        expect(result.message).toContain('First release')
      })

      it('handles registry query failure gracefully', async () => {
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

        const result = await step.execute(context)

        expect(result.status).toBe('success')
        expect(result.stateUpdates?.publishedVersion).toBe(null)
        expect(result.stateUpdates?.isFirstRelease).toBe(true)
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Registry query failed'))
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

        expect(result.status).toBe('success')
        expect(result.message).toContain('Published: 1.5.0')
        expect(result.message).toContain('Local: 2.0.0')
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
          const logger = createMockLogger()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.publishedCommit).toBe('abc1234567890def')
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
          const logger = createMockLogger()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.publishedCommit).toBe(null)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('has no gitHead'))
        })

        it('sets publishedCommit to null when getVersionInfo fails', async () => {
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

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.publishedVersion).toBe('1.0.0')
          expect(result.stateUpdates?.publishedCommit).toBe(null)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Could not fetch version info'))
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

          expect(result.status).toBe('success')
          expect(result.message).toContain('Published: 1.5.0 @ def4567')
          expect(result.message).toContain('Local: 2.0.0')
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

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.publishedCommit).toBe(null)
          expect(result.stateUpdates?.isFirstRelease).toBe(true)
        })
      })
    })
  })
})
