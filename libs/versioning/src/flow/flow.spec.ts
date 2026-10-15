import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { ConventionalCommit } from '../commits/models/conventional'
import type { GitClient } from '../git/factory'
import type { Registry } from '../registry/models/registry'
import type { FlowPreset } from './factory'
import { normalizePath, normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { executeFlow, dryRun, validateFlow } from './executor/execute'
import { createVersionFlow, createDryRunFlow, getAvailablePresets, getPresetDescription } from './factory'
import { addStep, removeStep } from './models/flow'
import { createStep, createSuccessResult } from './models/step'
import { createConventionalFlow, createMinimalFlow, createChangelogOnlyFlow } from './presets/conventional'
import {
  createIndependentFlow,
  createCheckDependentBumpsStep,
  createBatchReleaseFlow,
  INDEPENDENT_FLOW_CONFIG,
} from './presets/independent'
import { createSyncedFlow, createSyncAllPackagesStep, createCombinedChangelogStep, createFixedVersionFlow } from './presets/synced'

function createMockTree(files: Record<string, string> = {}): Tree {
  // why: the real tree keys every path portably, so the native joins the flow hands it must land on the POSIX seeds.
  const fileSystem = new Map(Object.entries(files).map(([filePath, content]) => [normalizePath(filePath), content]))

  const tree = {
    root: '/workspace',
    read(filePath: string, encoding?: string) {
      const content = fileSystem.get(normalizePath(filePath))
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write(filePath: string, content: string | Buffer) {
      fileSystem.set(normalizePath(filePath), typeof content === 'string' ? content : content.toString())
    },
    exists(filePath: string) {
      return fileSystem.has(normalizePath(filePath))
    },
    delete(filePath: string) {
      fileSystem.delete(normalizePath(filePath))
    },
    rename(from: string, to: string) {
      const content = fileSystem.get(normalizePath(from))
      if (content !== undefined) {
        fileSystem.set(normalizePath(to), content)
        fileSystem.delete(normalizePath(from))
      }
    },
    isFile(filePath: string) {
      return fileSystem.has(normalizePath(filePath))
    },
    children() {
      return []
    },
    listChanges() {
      return []
    },
    changeFile(filePath: string, transform: (content: Buffer) => Buffer) {
      const content = tree.read(filePath, undefined)
      if (content === null) {
        throw new Error(`File not found: ${filePath}`)
      }
      const buffer = typeof content === 'string' ? Buffer.from(content) : (content as Buffer)
      const result = transform(buffer)
      tree.write(filePath, result)
    },
  }

  return tree as unknown as Tree
}

function createMockRegistry(publishedVersion: string | null = null): Registry {
  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      return publishedVersion
    },
    async isVersionPublished(_packageName: string, version: string) {
      return version === publishedVersion
    },
    async getPackageInfo() {
      return null
    },
    async getVersionInfo() {
      return null
    },
    async listVersions() {
      if (publishedVersion) {
        return [publishedVersion]
      }
      return []
    },
  }
}

function createMockGitClient(commits: readonly Partial<ConventionalCommit>[] = []): GitClient {
  const mockCommits = commits.map((c, i) => ({
    hash: `abc${i}`,
    message: `${c.type ?? 'feat'}${c.scope && c.scope.length > 0 ? `(${c.scope.join(',')})` : ''}: ${c.subject ?? 'test commit'}`,
    author: 'Test User',
    email: 'test@example.com',
    date: new Date().toISOString(),
    ...c,
  }))

  return {
    cwd: '/workspace',
    timeout: 30000,
    getCommitLog: () => mockCommits,
    getCommitsBetween: () => mockCommits,
    getCommitsSince: () => mockCommits,
    getCommit: () => mockCommits[0] ?? null,
    commitExists: () => true,
    getTags: () => [],
    getTag: () => null,
    createTag: (name: string) => ({
      name,
      hash: 'abc123',
      type: 'annotated' as const,
      message: 'Release',
      tagger: { name: 'Test', email: 'test@test.com', date: new Date() },
    }),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: () => [],
    pushTag: () => true,
    createCommit: (message: string) => ({
      hash: 'newcommit123',
      message,
      author: 'Test',
      email: 'test@test.com',
      date: new Date().toISOString(),
      parents: [],
    }),
    stage: () => true,
    unstage: () => true,
    stageAll: () => true,
    amendCommit: (message: string) => ({
      hash: 'amended123',
      message,
      author: 'Test',
      email: 'test@test.com',
      date: new Date().toISOString(),
      parents: [],
    }),
    createEmptyCommit: (message: string) => ({
      hash: 'empty123',
      message,
      author: 'Test',
      email: 'test@test.com',
      date: new Date().toISOString(),
      parents: [],
    }),
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

describe('Flow System', () => {
  describe('createVersionFlow', () => {
    it('creates a conventional flow by default', () => {
      const flow = createVersionFlow()
      expect(flow.id).toBe('conventional')
    })

    it('populates the default flow with steps', () => {
      const flow = createVersionFlow()
      expect(flow.steps.length).toBeGreaterThan(0)
    })

    it('creates an independent flow', () => {
      const flow = createVersionFlow('independent')
      expect(flow).toEqual(expect.objectContaining({ id: 'independent', config: expect.objectContaining({ trackDeps: true }) }))
    })

    it('creates a synced flow', () => {
      const flow = createVersionFlow('synced')
      expect(flow.id).toBe('synced')
    })

    it('applies custom config', () => {
      const flow = createVersionFlow('conventional', {
        skipTag: true,
        dryRun: true,
      })
      expect(flow.config).toEqual(expect.objectContaining({ skipTag: true, dryRun: true }))
    })
  })

  describe('getAvailablePresets', () => {
    it('returns all available presets', () => {
      const presets = getAvailablePresets()
      expect(presets).toEqual(expect.arrayContaining(['conventional', 'independent', 'synced']))
    })
  })

  describe('validateFlow', () => {
    it('validates a valid flow', () => {
      const flow = createConventionalFlow()
      const errors = validateFlow(flow)
      expect(errors).toHaveLength(0)
    })

    it('detects duplicate step IDs', () => {
      const step = createStep('duplicate', 'Duplicate', async () => createSuccessResult('OK'))
      let flow = createConventionalFlow()
      flow = addStep(flow, step)
      flow = addStep(flow, step)

      const errors = validateFlow(flow)
      expect(errors.some((e) => e.includes('Duplicate step ID'))).toBe(true)
    })
  })

  describe('executeFlow', () => {
    it('executes a dry run successfully', async () => {
      const flow = createConventionalFlow({ dryRun: true })
      const tree = createMockTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })
      const registry = createMockRegistry('1.0.0')
      const git = createMockGitClient([{ type: 'feat', subject: 'new feature' }])

      const result = await executeFlow(flow, 'lib-test', '/workspace', {
        dryRun: true,
        tree,
        registry,
        git,
        projectRoot: 'libs/test',
      })

      expect(result.status).toBe('success')
    })

    it('records step results for a dry run', async () => {
      const flow = createConventionalFlow({ dryRun: true })
      const tree = createMockTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })
      const registry = createMockRegistry('1.0.0')
      const git = createMockGitClient([{ type: 'feat', subject: 'new feature' }])

      const result = await executeFlow(flow, 'lib-test', '/workspace', {
        dryRun: true,
        tree,
        registry,
        git,
        projectRoot: 'libs/test',
      })

      expect(result.steps.length).toBeGreaterThan(0)
    })

    it('calculates version bump from commits', async () => {
      const flow = createConventionalFlow({ skipGit: true, skipChangelog: true })
      const tree = createMockTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })
      const registry = createMockRegistry('1.0.0')
      const git = createMockGitClient([
        { type: 'feat', subject: 'new feature' },
        { type: 'fix', subject: 'bug fix' },
      ])

      const result = await dryRun(flow, 'lib-test', '/workspace', {
        tree,
        registry,
        git,
        projectRoot: 'libs/test',
      })

      expect(result.state).toEqual(expect.objectContaining({ bumpType: 'minor', nextVersion: '1.1.0' }))
    })

    it('handles first release', async () => {
      const flow = createConventionalFlow({ skipGit: true })
      const tree = createMockTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '0.0.0',
        }),
      })
      const registry = createMockRegistry(null)
      const git = createMockGitClient([{ type: 'feat', subject: 'initial' }])

      const result = await dryRun(flow, 'lib-test', '/workspace', {
        tree,
        registry,
        git,
        projectRoot: 'libs/test',
      })

      expect(result.state).toEqual(expect.objectContaining({ isFirstRelease: true, nextVersion: '0.1.0' }))
    })

    it('skips step when skipIf returns true', async () => {
      const skipStep = createStep('always-skip', 'Always Skip', async () => createSuccessResult('Should not run'), {
        skipIf: () => true,
      })

      let flow = createConventionalFlow({ dryRun: true })
      flow = addStep(flow, skipStep)

      const tree = createMockTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })

      const result = await executeFlow(flow, 'lib-test', '/workspace', {
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        projectRoot: 'libs/test',
      })

      const skipResult = result.steps.find((s) => s.stepId === 'always-skip')
      expect(skipResult?.status).toBe('skipped')
    })

    it('continues on error when continueOnError is true', async () => {
      const errorStep = createStep(
        'fail-step',
        'Failing Step',
        async () => {
          throw new Error('Intentional failure')
        },
        {
          continueOnError: true,
        }
      )

      const afterStep = createStep('after-fail', 'After Fail', async () => createSuccessResult('Continued'))

      let flow = createMinimalFlow({ dryRun: true, skipGit: true })
      flow = addStep(flow, errorStep)
      flow = addStep(flow, afterStep)

      const tree = createMockTree({
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      })

      const result = await executeFlow(flow, 'lib-test', '/workspace', {
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        projectRoot: 'libs/test',
      })

      expect(result).toEqual(
        expect.objectContaining({
          status: 'partial',
          steps: expect.arrayContaining([expect.objectContaining({ stepId: 'after-fail', status: 'success' })]),
        })
      )
    })
  })

  describe('Flow manipulation', () => {
    it('adds a step to a flow', () => {
      const flow = createConventionalFlow()
      const customStep = createStep('custom', 'Custom Step', async () => createSuccessResult('OK'))
      const modified = addStep(flow, customStep)

      expect(modified.steps.map((s) => s.id)).toEqual([...flow.steps.map((s) => s.id), 'custom'])
    })

    it('removes a step from a flow', () => {
      const flow = createConventionalFlow()
      const modified = removeStep(flow, 'create-tag')

      expect(modified.steps.map((s) => s.id)).toEqual([
        'fetch-registry',
        'resolve-repository',
        'analyze-commits',
        'calculate-bump',
        'check-idempotency',
        'generate-changelog',
        'update-packages',
        'write-changelog',
        'create-commit',
      ])
    })
  })
})

describe('Flow Presets', () => {
  describe('createConventionalFlow', () => {
    it('has all required steps', () => {
      const flow = createConventionalFlow()

      expect(flow.steps.map((s) => s.id)).toEqual(
        expect.arrayContaining([
          'fetch-registry',
          'analyze-commits',
          'calculate-bump',
          'check-idempotency',
          'generate-changelog',
          'update-packages',
          'write-changelog',
          'create-commit',
          'create-tag',
        ])
      )
    })
  })

  describe('createIndependentFlow', () => {
    it('enables dependency tracking', () => {
      const flow = createIndependentFlow()
      expect(flow.config.trackDeps).toBe(true)
    })

    it('includes cascade steps', () => {
      const flow = createIndependentFlow()
      expect(flow.steps.map((s) => s.id)).toEqual(expect.arrayContaining(['check-dependent-bumps', 'cascade-dependencies']))
    })
  })

  describe('INDEPENDENT_FLOW_CONFIG', () => {
    it('has correct preset identifier', () => {
      expect(INDEPENDENT_FLOW_CONFIG.preset).toBe('independent')
    })

    it('enables dependency tracking', () => {
      expect(INDEPENDENT_FLOW_CONFIG.trackDeps).toBe(true)
    })
  })

  describe('createBatchReleaseFlow', () => {
    it('creates a flow with batch-release identifier', () => {
      const flow = createBatchReleaseFlow()
      expect(flow).toEqual(expect.objectContaining({ id: 'batch-release', name: 'Batch Release Flow' }))
    })

    it('excludes git commit and tag steps', () => {
      const flow = createBatchReleaseFlow()
      const stepIds = flow.steps.map((s) => s.id)
      expect(stepIds.filter((id) => id === 'git-commit' || id === 'create-tag')).toEqual([])
    })

    it('includes core release steps', () => {
      const flow = createBatchReleaseFlow()
      const stepIds = flow.steps.map((s) => s.id)
      expect(stepIds).toEqual(
        expect.arrayContaining([
          'fetch-registry',
          'analyze-commits',
          'calculate-bump',
          'generate-changelog',
          'update-packages',
          'write-changelog',
        ])
      )
    })

    it('has skipGit and skipTag in config', () => {
      const flow = createBatchReleaseFlow()
      expect(flow.config).toEqual(expect.objectContaining({ skipGit: true, skipTag: true }))
    })

    it('applies config overrides', () => {
      const flow = createBatchReleaseFlow({ dryRun: true })
      expect(flow.config.dryRun).toBe(true)
    })
  })

  describe('createChangelogOnlyFlow', () => {
    it('creates a flow with the changelog-only identity', () => {
      const flow = createChangelogOnlyFlow()

      expect(flow).toEqual(expect.objectContaining({ id: 'changelog-only', name: 'Changelog Only Flow' }))
    })

    it('has changelog-related steps only', () => {
      const flow = createChangelogOnlyFlow()

      expect(flow.steps.map((s) => s.id)).toEqual([
        'fetch-registry',
        'analyze-commits',
        'calculate-bump',
        'generate-changelog',
        'write-changelog',
      ])
    })

    it('skips git and tag operations by default', () => {
      const flow = createChangelogOnlyFlow()

      expect(flow.config).toEqual(expect.objectContaining({ skipGit: true, skipTag: true }))
    })

    it('applies custom config overrides', () => {
      const flow = createChangelogOnlyFlow({ dryRun: true })

      expect(flow.config.dryRun).toBe(true)
    })
  })

  describe('createSyncedFlow', () => {
    it('has synced configuration', () => {
      const flow = createSyncedFlow()
      expect(flow).toEqual(expect.objectContaining({ id: 'synced', config: expect.objectContaining({ preset: 'synced' }) }))
    })

    it('applies custom config overrides', () => {
      const flow = createSyncedFlow({ dryRun: true, skipTag: true })
      expect(flow.config).toEqual(expect.objectContaining({ dryRun: true, skipTag: true }))
    })
  })
})

describe('Factory Functions', () => {
  describe('createVersionFlow', () => {
    it('throws error for unknown preset', () => {
      expect(() => createVersionFlow('unknown' as FlowPreset)).toThrow('Unknown flow preset: unknown')
    })
  })

  describe('createDryRunFlow', () => {
    it('creates a flow with dryRun enabled', () => {
      const flow = createDryRunFlow()
      expect(flow.config.dryRun).toBe(true)
    })

    it('creates a dry run flow with specific preset', () => {
      const flow = createDryRunFlow('independent')
      expect(flow).toEqual(expect.objectContaining({ id: 'independent', config: expect.objectContaining({ dryRun: true }) }))
    })

    it('applies custom config with dryRun', () => {
      const flow = createDryRunFlow('synced', { skipTag: true })
      expect(flow).toEqual(expect.objectContaining({ id: 'synced', config: expect.objectContaining({ dryRun: true, skipTag: true }) }))
    })
  })

  describe('getPresetDescription', () => {
    it('returns description for conventional preset', () => {
      expect(getPresetDescription('conventional')).toBe('Standard versioning using conventional commits specification')
    })

    it('returns description for independent preset', () => {
      expect(getPresetDescription('independent')).toBe('Version packages independently with dependency tracking')
    })

    it('returns description for synced preset', () => {
      expect(getPresetDescription('synced')).toBe('Keep all packages at the same version')
    })

    it('returns unknown for invalid preset', () => {
      expect(getPresetDescription('invalid' as FlowPreset)).toBe('Unknown preset')
    })
  })
})

describe('Flow Validation', () => {
  it('detects invalid dependency references', () => {
    const stepWithBadDep = createStep('bad-dep', 'Bad Dependency', async () => createSuccessResult('OK'), {
      dependsOn: ['non-existent-step'],
    })

    let flow = createMinimalFlow()
    flow = addStep(flow, stepWithBadDep)

    const errors = validateFlow(flow)
    expect(errors.some((e) => e.includes('depends on unknown step'))).toBe(true)
  })

  it('detects circular dependencies', () => {
    const stepA = createStep('step-a', 'Step A', async () => createSuccessResult('OK'), {
      dependsOn: ['step-b'],
    })
    const stepB = createStep('step-b', 'Step B', async () => createSuccessResult('OK'), {
      dependsOn: ['step-a'],
    })

    let flow = createMinimalFlow()
    flow = addStep(flow, stepA)
    flow = addStep(flow, stepB)

    const errors = validateFlow(flow)
    expect(errors.some((e) => e.includes('Circular dependency'))).toBe(true)
  })
})

describe('Step Execution Edge Cases', () => {
  it('stops execution on step failure without continueOnError', async () => {
    const failStep = createStep('fail', 'Failing Step', async () => {
      throw new Error('Step failed')
    })

    const afterStep = createStep('after', 'After Step', async () => createSuccessResult('Should not run'))

    let flow = createMinimalFlow({ dryRun: true, skipGit: true })
    flow = addStep(flow, failStep)
    flow = addStep(flow, afterStep)

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/test',
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'failed',
        steps: expect.not.arrayContaining([expect.objectContaining({ stepId: 'after' })]),
      })
    )
  })

  it('skips step when dependencies fail', async () => {
    const failStep = createStep(
      'fail',
      'Failing Step',
      async () => ({
        status: 'failed' as const,
        message: 'Intentional failure',
      }),
      { continueOnError: true }
    )

    const dependentStep = createStep('dependent', 'Dependent Step', async () => createSuccessResult('OK'), {
      dependsOn: ['fail'],
    })

    let flow = createMinimalFlow({ dryRun: true, skipGit: true })
    flow = addStep(flow, failStep)
    flow = addStep(flow, dependentStep)

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/test',
    })

    const dependentResult = result.steps.find((s) => s.stepId === 'dependent')
    expect(dependentResult).toEqual(expect.objectContaining({ status: 'skipped', message: 'Dependencies not met' }))
  })
})

describe('Independent Flow Steps', () => {
  describe('createCheckDependentBumpsStep', () => {
    it('skips when dependency tracking not enabled', async () => {
      const step = createCheckDependentBumpsStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: { trackDeps: false },
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      const result = await step.execute(ctx as never)

      expect(result).toEqual({ status: 'skipped', message: 'Dependency tracking not enabled' })
    })

    it('skips when no bump needed', async () => {
      const step = createCheckDependentBumpsStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: { trackDeps: true },
        state: { bumpType: 'none' },
      }

      const result = await step.execute(ctx as never)

      expect(result).toEqual({ status: 'skipped', message: 'No bump to propagate' })
    })

    it('succeeds when dependency tracking enabled with bump', async () => {
      const step = createCheckDependentBumpsStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: { trackDeps: true },
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('success')
    })
  })
})

describe('Synced Flow Steps', () => {
  describe('createSyncAllPackagesStep', () => {
    it('skips when no version bump needed', async () => {
      const step = createSyncAllPackagesStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'none' },
      }

      const result = await step.execute(ctx as never)

      expect(result).toEqual({ status: 'skipped', message: 'No version bump needed' })
    })

    it('updates root package.json when bump needed', async () => {
      const step = createSyncAllPackagesStep()
      const tree = createMockTree({
        '/workspace/package.json': JSON.stringify({
          name: 'workspace',
          version: '1.0.0',
        }),
      })

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'minor', nextVersion: '1.1.0', modifiedFiles: [] },
      }

      const result = await step.execute(ctx as never)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          message: expect.stringContaining('Synced'),
          stateUpdates: expect.objectContaining({ modifiedFiles: expect.arrayContaining([normalizeToNative('/workspace/package.json')]) }),
        })
      )
    })

    it('handles missing root package.json gracefully', async () => {
      const step = createSyncAllPackagesStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('success')
    })

    it('handles invalid JSON in root package.json gracefully', async () => {
      const step = createSyncAllPackagesStep()
      const tree = createMockTree({
        '/workspace/package.json': '{ invalid json }',
      })

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('success')
    })

    it('warns when the root package.json holds invalid JSON', async () => {
      const step = createSyncAllPackagesStep()
      const tree = createMockTree({
        '/workspace/package.json': '{ invalid json }',
      })

      const warnFn = jest.fn()
      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: warnFn,
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      await step.execute(ctx as never)

      expect(warnFn).toHaveBeenCalled()
    })
  })

  describe('createCombinedChangelogStep', () => {
    it('skips when changelog disabled', async () => {
      const step = createCombinedChangelogStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: { skipChangelog: true },
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('skipped')
    })

    it('skips when no bump needed', async () => {
      const step = createCombinedChangelogStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'none' },
      }

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('skipped')
    })

    it('succeeds when changelog generation needed', async () => {
      const step = createCombinedChangelogStep()
      const tree = createMockTree()

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: { bumpType: 'minor', nextVersion: '1.1.0' },
      }

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('success')
    })
  })

  describe('createFixedVersionFlow', () => {
    it('creates a flow with fixed version', () => {
      const flow = createFixedVersionFlow('2.5.0')

      expect(flow).toEqual(
        expect.objectContaining({ id: 'fixed', name: 'Fixed Version Flow', description: expect.stringContaining('fixed version 2.5.0') })
      )
    })

    it('has a calculate-bump step that returns the fixed version', async () => {
      const flow = createFixedVersionFlow('3.0.0')
      const calcBumpStep = flow.steps.find((s) => s.id === 'calculate-bump')

      const ctx = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree: createMockTree(),
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          setLogLevel: jest.fn(),
        },
        config: {},
        state: {},
      }

      const result = await calcBumpStep?.execute(ctx as never)

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          message: expect.stringContaining('fixed version'),
          stateUpdates: expect.objectContaining({ nextVersion: '3.0.0' }),
        })
      )
    })

    it('applies custom config overrides', () => {
      const flow = createFixedVersionFlow('1.0.0', { dryRun: true, skipTag: true })

      expect(flow.config).toEqual(expect.objectContaining({ dryRun: true, skipTag: true }))
    })
  })
})
