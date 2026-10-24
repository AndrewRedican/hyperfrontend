import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
import { createUpdatePackageStep, createCascadeDependenciesStep, UPDATE_PACKAGES_STEP_ID } from './update-packages'

/**
 * Builds an empty tree whose every read throws, standing in for an unreadable manifest.
 *
 * @returns Tree that fails each read with a simulated error
 */
function createUnreadableTree(): Tree {
  const tree = createMemoryTree()
  jest.spyOn(tree, 'read').mockImplementation(() => {
    throw new Error('Mock read failed')
  })
  return tree
}

function createMockContext(state: Partial<FlowState> = {}, config: Partial<FlowConfig> = {}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: createMemoryTree(),
    registry: createMock<Registry>(),
    git: createMock<GitClient>(),
    logger: createMock<Logger>(),
    config: { preset: 'conventional', ...config },
    state: { ...state },
  }
}

describe('Update Packages Step', () => {
  describe('createUpdatePackageStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createUpdatePackageStep()

      expect(step).toEqual(expect.objectContaining({ id: UPDATE_PACKAGES_STEP_ID, name: 'Update Package Version' }))
    })

    it('exposes update-packages as the step ID constant', () => {
      expect(UPDATE_PACKAGES_STEP_ID).toBe('update-packages')
    })

    it('depends on calculate-bump step', () => {
      const step = createUpdatePackageStep()

      expect(step.dependsOn).toContain('calculate-bump')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when no nextVersion', async () => {
      const step = createUpdatePackageStep()
      const ctx = createMockContext({ bumpType: 'minor', nextVersion: undefined })

      const result = await step.execute(ctx)

      expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: expect.stringContaining('No version bump') }))
    })

    it('skips when bumpType is none', async () => {
      const step = createUpdatePackageStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'none' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })
  })

  describe('execute - package.json not found', () => {
    it('fails when package.json does not exist', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({ status: 'failed', error: expect.any(Error), message: expect.stringContaining('File not found') })
      )
    })

    it('fails when reading package.json throws', async () => {
      const step = createUpdatePackageStep()
      const tree = createUnreadableTree()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({ status: 'failed', message: expect.stringMatching(/Failed to update package\.json.*Mock read failed/) })
      )
    })
  })

  describe('execute - invalid package.json', () => {
    it('fails when package.json is invalid JSON', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': 'not valid json {{{',
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({ status: 'failed', message: expect.stringContaining('Failed to update package.json') })
      )
    })
  })

  describe('execute - success', () => {
    it('succeeds when updating the version in package.json', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })
      const ctx: FlowContext = {
        ...createMockContext({
          currentVersion: '1.0.0',
          nextVersion: '1.1.0',
          bumpType: 'minor',
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
    })

    it('updates version in package.json', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })
      const ctx: FlowContext = {
        ...createMockContext({
          currentVersion: '1.0.0',
          nextVersion: '1.1.0',
          bumpType: 'minor',
        }),
        tree,
      }

      await step.execute(ctx)

      expect(tree.read('/workspace/libs/test/package.json', 'utf-8')).toContain('"version": "1.1.0"')
    })

    it('preserves other package.json fields', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
          description: 'My package',
          dependencies: { foo: '^1.0.0' },
        }),
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '2.0.0', bumpType: 'major' }),
        tree,
      }

      await step.execute(ctx)

      const written = JSON.parse(tree.read('/workspace/libs/test/package.json', 'utf-8') ?? '')

      expect(written).toEqual(expect.objectContaining({ name: '@test/pkg', description: 'My package', dependencies: { foo: '^1.0.0' } }))
    })

    it('adds package.json to modified files', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.1.0',
          bumpType: 'minor',
          modifiedFiles: [],
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.modifiedFiles).toContain(normalizeToNative('/workspace/libs/test/package.json'))
    })

    it('preserves existing modified files', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.1.0',
          bumpType: 'minor',
          modifiedFiles: ['/workspace/libs/test/CHANGELOG.md'],
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.modifiedFiles).toEqual(
        expect.arrayContaining(['/workspace/libs/test/CHANGELOG.md', normalizeToNative('/workspace/libs/test/package.json')])
      )
    })

    it('logs version update', async () => {
      const step = createUpdatePackageStep()
      const logger = createMock<Logger>()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
      })
      const ctx: FlowContext = {
        ...createMockContext({
          currentVersion: '1.0.0',
          nextVersion: '1.1.0',
          bumpType: 'minor',
        }),
        tree,
        logger,
      }

      await step.execute(ctx)

      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/1\.0\.0.*1\.1\.0/))
    })

    it('includes version in success message', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '2.0.0', bumpType: 'major' }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.message).toContain('2.0.0')
    })
  })

  describe('execute - JSON formatting', () => {
    it('outputs formatted JSON with 2-space indentation', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': '{"name":"@test/pkg","version":"1.0.0"}',
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.1.0', bumpType: 'minor' }),
        tree,
      }

      await step.execute(ctx)

      const written = tree.read('/workspace/libs/test/package.json', 'utf-8')

      expect(written).toContain('  "')
    })

    it('ends the formatted JSON with a trailing newline', async () => {
      const step = createUpdatePackageStep()
      const tree = createMemoryTree({
        '/workspace/libs/test/package.json': '{"name":"@test/pkg","version":"1.0.0"}',
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.1.0', bumpType: 'minor' }),
        tree,
      }

      await step.execute(ctx)

      const written = tree.read('/workspace/libs/test/package.json', 'utf-8')

      expect(written).toMatch(/\n$/)
    })
  })
})

describe('Cascade Dependencies Step', () => {
  describe('createCascadeDependenciesStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createCascadeDependenciesStep()

      expect(step).toEqual(expect.objectContaining({ id: 'cascade-dependencies', name: 'Cascade Dependency Updates' }))
    })

    it('depends on update-packages step', () => {
      const step = createCascadeDependenciesStep()

      expect(step.dependsOn).toContain('update-packages')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when trackDeps is not enabled', async () => {
      const step = createCascadeDependenciesStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { trackDeps: false })

      const result = await step.execute(ctx)

      expect(result).toEqual(
        expect.objectContaining({ status: 'skipped', message: expect.stringContaining('Dependency tracking not enabled') })
      )
    })

    it('skips when trackDeps is undefined', async () => {
      const step = createCascadeDependenciesStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when no nextVersion', async () => {
      const step = createCascadeDependenciesStep()
      const ctx = createMockContext({ bumpType: 'minor', nextVersion: undefined }, { trackDeps: true })

      const result = await step.execute(ctx)

      expect(result).toEqual(expect.objectContaining({ status: 'skipped', message: expect.stringContaining('No version bump to cascade') }))
    })

    it('skips when bumpType is none', async () => {
      const step = createCascadeDependenciesStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'none' }, { trackDeps: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })
  })

  describe('execute - success (placeholder)', () => {
    it('succeeds when enabled', async () => {
      const step = createCascadeDependenciesStep()
      const logger = createMock<Logger>()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { trackDeps: true }),
        logger,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
    })

    it('logs a not fully implemented warning when enabled', async () => {
      const step = createCascadeDependenciesStep()
      const logger = createMock<Logger>()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { trackDeps: true }),
        logger,
      }

      await step.execute(ctx)

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not fully implemented'))
    })

    it('returns informative message', async () => {
      const step = createCascadeDependenciesStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { trackDeps: true })

      const result = await step.execute(ctx)

      expect(result.message).toContain('cascade')
    })
  })
})
