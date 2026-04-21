import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { ConventionalCommit } from '../commits/models/conventional'
import type { GitClient } from '../git/factory'
import type { Registry } from '../registry/models/registry'
import type { FlowPreset } from './factory'
import { executeFlow, dryRun, validateFlow } from './executor/execute'
import { createVersionFlow, createDryRunFlow, getAvailablePresets, getPresetDescription } from './factory'
import { addStep, removeStep, hasStep } from './models/flow'
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
  const fileSystem = new Map(Object.entries(files))

  const tree = {
    root: '/workspace',
    read(filePath: string, encoding?: string) {
      const content = fileSystem.get(filePath)
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write(filePath: string, content: string | Buffer) {
      fileSystem.set(filePath, typeof content === 'string' ? content : content.toString())
    },
    exists(filePath: string) {
      return fileSystem.has(filePath)
    },
    delete(filePath: string) {
      fileSystem.delete(filePath)
    },
    rename(from: string, to: string) {
      const content = fileSystem.get(from)
      if (content !== undefined) {
        fileSystem.set(to, content)
        fileSystem.delete(from)
      }
    },
    isFile(filePath: string) {
      return fileSystem.has(filePath)
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
      const buffer = typeof content === 'string' ? Buffer.from(content) : <Buffer>content
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
      expect(flow.steps.length).toBeGreaterThan(0)
    })

    it('creates an independent flow', () => {
      const flow = createVersionFlow('independent')
      expect(flow.id).toBe('independent')
      expect(flow.config.trackDeps).toBe(true)
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
      expect(flow.config.skipTag).toBe(true)
      expect(flow.config.dryRun).toBe(true)
    })
  })

  describe('getAvailablePresets', () => {
    it('returns all available presets', () => {
      const presets = getAvailablePresets()
      expect(presets).toContain('conventional')
      expect(presets).toContain('independent')
      expect(presets).toContain('synced')
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

      expect(result.state.bumpType).toBe('minor')
      expect(result.state.nextVersion).toBe('1.1.0')
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

      expect(result.state.isFirstRelease).toBe(true)
      expect(result.state.nextVersion).toBe('0.1.0')
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

      expect(result.status).toBe('partial')

      const afterResult = result.steps.find((s) => s.stepId === 'after-fail')
      expect(afterResult?.status).toBe('success')
    })
  })

  describe('Flow manipulation', () => {
    it('adds a step to a flow', () => {
      const flow = createConventionalFlow()
      const customStep = createStep('custom', 'Custom Step', async () => createSuccessResult('OK'))
      const modified = addStep(flow, customStep)

      expect(hasStep(modified, 'custom')).toBe(true)
      expect(modified.steps.length).toBe(flow.steps.length + 1)
    })

    it('removes a step from a flow', () => {
      const flow = createConventionalFlow()
      const modified = removeStep(flow, 'create-tag')

      expect(hasStep(modified, 'create-tag')).toBe(false)
      expect(modified.steps.length).toBe(flow.steps.length - 1)
    })
  })
})

describe('Flow Presets', () => {
  describe('createConventionalFlow', () => {
    it('has all required steps', () => {
      const flow = createConventionalFlow()

      expect(hasStep(flow, 'fetch-registry')).toBe(true)
      expect(hasStep(flow, 'analyze-commits')).toBe(true)
      expect(hasStep(flow, 'calculate-bump')).toBe(true)
      expect(hasStep(flow, 'check-idempotency')).toBe(true)
      expect(hasStep(flow, 'generate-changelog')).toBe(true)
      expect(hasStep(flow, 'update-packages')).toBe(true)
      expect(hasStep(flow, 'write-changelog')).toBe(true)
      expect(hasStep(flow, 'create-commit')).toBe(true)
      expect(hasStep(flow, 'create-tag')).toBe(true)
    })
  })

  describe('createIndependentFlow', () => {
    it('enables dependency tracking', () => {
      const flow = createIndependentFlow()
      expect(flow.config.trackDeps).toBe(true)
    })

    it('includes cascade steps', () => {
      const flow = createIndependentFlow()
      expect(hasStep(flow, 'check-dependent-bumps')).toBe(true)
      expect(hasStep(flow, 'cascade-dependencies')).toBe(true)
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
      expect(flow.id).toBe('batch-release')
      expect(flow.name).toBe('Batch Release Flow')
    })

    it('excludes git commit and tag steps', () => {
      const flow = createBatchReleaseFlow()
      const stepIds = flow.steps.map((s) => s.id)
      expect(stepIds).not.toContain('git-commit')
      expect(stepIds).not.toContain('create-tag')
    })

    it('includes core release steps', () => {
      const flow = createBatchReleaseFlow()
      const stepIds = flow.steps.map((s) => s.id)
      expect(stepIds).toContain('fetch-registry')
      expect(stepIds).toContain('analyze-commits')
      expect(stepIds).toContain('calculate-bump')
      expect(stepIds).toContain('generate-changelog')
      expect(stepIds).toContain('update-packages')
      expect(stepIds).toContain('write-changelog')
    })

    it('has skipGit and skipTag in config', () => {
      const flow = createBatchReleaseFlow()
      expect(flow.config.skipGit).toBe(true)
      expect(flow.config.skipTag).toBe(true)
    })

    it('applies config overrides', () => {
      const flow = createBatchReleaseFlow({ dryRun: true })
      expect(flow.config.dryRun).toBe(true)
    })
  })

  describe('createChangelogOnlyFlow', () => {
    it('has changelog-related steps only', () => {
      const flow = createChangelogOnlyFlow()

      expect(flow.id).toBe('changelog-only')
      expect(flow.name).toBe('Changelog Only Flow')
      expect(hasStep(flow, 'fetch-registry')).toBe(true)
      expect(hasStep(flow, 'analyze-commits')).toBe(true)
      expect(hasStep(flow, 'calculate-bump')).toBe(true)
      expect(hasStep(flow, 'generate-changelog')).toBe(true)
      expect(hasStep(flow, 'write-changelog')).toBe(true)
    })

    it('skips git and tag operations by default', () => {
      const flow = createChangelogOnlyFlow()

      expect(flow.config.skipGit).toBe(true)
      expect(flow.config.skipTag).toBe(true)
    })

    it('applies custom config overrides', () => {
      const flow = createChangelogOnlyFlow({ dryRun: true })

      expect(flow.config.dryRun).toBe(true)
    })
  })

  describe('createSyncedFlow', () => {
    it('has synced configuration', () => {
      const flow = createSyncedFlow()
      expect(flow.id).toBe('synced')
      expect(flow.config.preset).toBe('synced')
    })

    it('applies custom config overrides', () => {
      const flow = createSyncedFlow({ dryRun: true, skipTag: true })
      expect(flow.config.dryRun).toBe(true)
      expect(flow.config.skipTag).toBe(true)
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
      expect(flow.id).toBe('independent')
      expect(flow.config.dryRun).toBe(true)
    })

    it('applies custom config with dryRun', () => {
      const flow = createDryRunFlow('synced', { skipTag: true })
      expect(flow.id).toBe('synced')
      expect(flow.config.dryRun).toBe(true)
      expect(flow.config.skipTag).toBe(true)
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

    expect(result.status).toBe('failed')
    const afterResult = result.steps.find((s) => s.stepId === 'after')
    expect(afterResult).toBeUndefined()
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
    expect(dependentResult?.status).toBe('skipped')
    expect(dependentResult?.message).toBe('Dependencies not met')
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

      expect(result.status).toBe('skipped')
      expect(result.message).toBe('Dependency tracking not enabled')
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

      expect(result.status).toBe('skipped')
      expect(result.message).toBe('No bump to propagate')
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

      expect(result.status).toBe('skipped')
      expect(result.message).toBe('No version bump needed')
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

      expect(result.status).toBe('success')
      expect(result.message).toContain('Synced')
      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/package.json')
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

      const result = await step.execute(ctx as never)

      expect(result.status).toBe('success')
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

      expect(flow.id).toBe('fixed')
      expect(flow.name).toBe('Fixed Version Flow')
      expect(flow.description).toContain('fixed version 2.5.0')
    })

    it('has a calculate-bump step that returns the fixed version', async () => {
      const flow = createFixedVersionFlow('3.0.0')
      const calcBumpStep = flow.steps.find((s) => s.id === 'calculate-bump')

      expect(calcBumpStep).toBeDefined()

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

      expect(calcBumpStep).toBeDefined()
      const result = await calcBumpStep?.execute(ctx as never)

      expect(result?.status).toBe('success')
      expect(result?.stateUpdates?.nextVersion).toBe('3.0.0')
      expect(result?.message).toContain('fixed version')
    })

    it('applies custom config overrides', () => {
      const flow = createFixedVersionFlow('1.0.0', { dryRun: true, skipTag: true })

      expect(flow.config.dryRun).toBe(true)
      expect(flow.config.skipTag).toBe(true)
    })
  })
})
