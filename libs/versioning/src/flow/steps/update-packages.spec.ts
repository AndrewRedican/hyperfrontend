import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { Mock } from '@hyperfrontend/testing'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { normalizePath, normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createUpdatePackageStep, createCascadeDependenciesStep, UPDATE_PACKAGES_STEP_ID } from './update-packages'

function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

interface MockTreeOptions {
  files?: Record<string, string>
  readFails?: boolean
}

function createMockTree(options: MockTreeOptions = {}): Tree {
  const { readFails = false } = options
  // why: the real tree keys every path portably, so the native joins the step hands it must land on the POSIX seeds.
  const files = new Map(Object.entries(options.files ?? {}).map(([path, content]) => [normalizePath(path), content]))

  const tree = {
    root: '/workspace',
    read(path: string, encoding?: string) {
      if (readFails) {
        throw new Error('Mock read failed')
      }
      const content = files.get(normalizePath(path))
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write: jest.fn((path: string, content: string) => {
      files.set(normalizePath(path), content)
    }),
    exists: (path: string) => files.has(normalizePath(path)),
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: (path: string) => files.has(normalizePath(path)),
    children: () => [],
    listChanges: () => [],
    changeFile: (path: string, transform: (content: Buffer) => Buffer) => {
      const content = tree.read(path, undefined)
      if (content === null) {
        throw new Error(`File not found: ${path}`)
      }
      const buffer = typeof content === 'string' ? Buffer.from(content) : (content as Buffer)
      const result = transform(buffer)
      tree.write(path, result.toString())
    },
  }

  return tree as unknown as Tree
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
      const tree = createMockTree({ files: {} })
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
      const tree = createMockTree({ readFails: true })
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
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': 'not valid json {{{',
        },
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
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.0.0',
          }),
        },
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
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.0.0',
          }),
        },
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

      expect(tree.write).toHaveBeenCalledWith(
        normalizeToNative('/workspace/libs/test/package.json'),
        expect.stringContaining('"version": "1.1.0"')
      )
    })

    it('preserves other package.json fields', async () => {
      const step = createUpdatePackageStep()
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({
            name: '@test/pkg',
            version: '1.0.0',
            description: 'My package',
            dependencies: { foo: '^1.0.0' },
          }),
        },
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '2.0.0', bumpType: 'major' }),
        tree,
      }

      await step.execute(ctx)

      const writeCall = (tree.write as Mock).mock.calls[0]
      const written = JSON.parse(writeCall[1])

      expect(written).toEqual(expect.objectContaining({ name: '@test/pkg', description: 'My package', dependencies: { foo: '^1.0.0' } }))
    })

    it('adds package.json to modified files', async () => {
      const step = createUpdatePackageStep()
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
        },
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
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
        },
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
      const logger = createMockLogger()
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
        },
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
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg', version: '1.0.0' }),
        },
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
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': '{"name":"@test/pkg","version":"1.0.0"}',
        },
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.1.0', bumpType: 'minor' }),
        tree,
      }

      await step.execute(ctx)

      const writeCall = (tree.write as Mock).mock.calls[0]
      const written = writeCall[1]

      expect(written).toContain('  "')
    })

    it('ends the formatted JSON with a trailing newline', async () => {
      const step = createUpdatePackageStep()
      const tree = createMockTree({
        files: {
          '/workspace/libs/test/package.json': '{"name":"@test/pkg","version":"1.0.0"}',
        },
      })
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.1.0', bumpType: 'minor' }),
        tree,
      }

      await step.execute(ctx)

      const writeCall = (tree.write as Mock).mock.calls[0]
      const written = writeCall[1]

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
      const logger = createMockLogger()
      const ctx: FlowContext = {
        ...createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { trackDeps: true }),
        logger,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
    })

    it('logs a not fully implemented warning when enabled', async () => {
      const step = createCascadeDependenciesStep()
      const logger = createMockLogger()
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
