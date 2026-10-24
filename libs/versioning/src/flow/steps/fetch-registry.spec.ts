import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFetchRegistryStep, FETCH_REGISTRY_STEP_ID } from './fetch-registry'

/**
 * Builds an empty tree whose every read throws, standing in for an unreadable manifest.
 *
 * @returns Tree that fails each read with a simulated error
 */
function createUnreadableTree(): Tree {
  const tree = createMemoryTree()
  jest.spyOn(tree, 'read').mockImplementation(() => {
    throw new Error('Simulated read error')
  })
  return tree
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
    tree: overrides?.tree ?? createMemoryTree(),
    registry: overrides?.registry ?? createMockRegistry(),
    git: createMock<GitClient>(),
    logger: overrides?.logger ?? createMock<Logger>(),
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
        const tree = createMemoryTree({
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
        const tree = createMemoryTree({
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
        const tree = createMemoryTree({})
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ currentVersion: '0.0.0' }) })
        )
      })

      it('defaults to 0.0.0 when package.json read throws', async () => {
        const tree = createUnreadableTree()
        const context = createMockContext({ tree })
        const step = createFetchRegistryStep()

        const result = await step.execute(context)

        expect(result).toEqual(
          expect.objectContaining({ status: 'success', stateUpdates: expect.objectContaining({ currentVersion: '0.0.0' }) })
        )
      })

      it('logs a warning when package.json read throws', async () => {
        const tree = createUnreadableTree()
        const logger = createMock<Logger>()
        const context = createMockContext({ tree, logger })
        const step = createFetchRegistryStep()

        await step.execute(context)

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read package.json'))
      })

      it('fetches published version from registry', async () => {
        const tree = createMemoryTree({
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
        const tree = createMemoryTree({
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
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.0.0',
          }),
        })
        const registry = createMockRegistry({ throwOnQuery: true })
        const logger = createMock<Logger>()
        const context = createMockContext({ tree, registry, logger })
        const step = createFetchRegistryStep()

        await expect(step.execute(context)).rejects.toThrow()
      })

      it('returns appropriate message for published package', async () => {
        const tree = createMemoryTree({
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
          const tree = createMemoryTree({
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
          const tree = createMemoryTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            gitHead: 'abc1234567890def',
          })
          const logger = createMock<Logger>()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Published 1.0.0 at commit abc1234'))
        })

        it('sets publishedCommit to null when gitHead is missing', async () => {
          const tree = createMemoryTree({
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
          const tree = createMemoryTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            gitHead: null,
          })
          const logger = createMock<Logger>()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('has no gitHead'))
        })

        it('surfaces a version-info failure instead of releasing without a base commit', async () => {
          const tree = createMemoryTree({
            '/workspace/libs/test/package.json': JSON.stringify({
              name: '@test/pkg',
              version: '1.0.0',
            }),
          })
          const registry = createMockRegistry({
            version: '1.0.0',
            throwOnVersionInfo: true,
          })
          const logger = createMock<Logger>()
          const context = createMockContext({ tree, registry, logger })
          const step = createFetchRegistryStep()

          await expect(step.execute(context)).rejects.toThrow()
        })

        it('includes commit hash in message when available', async () => {
          const tree = createMemoryTree({
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
          const tree = createMemoryTree({
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
