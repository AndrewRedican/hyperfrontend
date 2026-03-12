import type { Tree } from '@hyperfrontend/project-scope'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowContext } from '../models/types'
import { createSkippedResult, createStep, createSuccessResult } from '../models/step'
import { createMinimalFlow } from '../presets/conventional'
import { dryRun, executeFlow, validateFlow } from './execute'

function createMockTree(files: Record<string, string> = {}): Tree {
  const fileSystem = new Map(Object.entries(files))

  return {
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
  } as unknown as Tree
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
      return null as unknown as Awaited<ReturnType<Registry['getPackageInfo']>>
    },
    async getVersionInfo() {
      return null as unknown as Awaited<ReturnType<Registry['getVersionInfo']>>
    },
    async listVersions() {
      return publishedVersion ? [publishedVersion] : []
    },
  }
}

function createMockGitClient(commits: readonly Partial<ConventionalCommit>[] = []): GitClient {
  const mockCommits = commits.map((c, i) => ({
    hash: `abc${i}`,
    message: `${c.type ?? 'feat'}${c.scope ? `(${c.scope})` : ''}: ${c.subject ?? 'test commit'}`,
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

function createMockLogger() {
  return {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLogLevel: jest.fn(),
    getLogLevel: jest.fn().mockReturnValue('error'),
  }
}

// ============================================================================
// resolveProjectRoot Tests (internal function tested via executeFlow)
// ============================================================================

describe('executeFlow - resolveProjectRoot behavior', () => {
  it('resolves lib- prefix projects to libs/ folder', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/libs/utils/package.json': JSON.stringify({
        name: '@test/utils',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-utils', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    // Flow should execute and find the package
    expect(result.status).not.toBe('failed')
  })

  it('resolves app- prefix projects to apps/ folder', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/apps/frontend/package.json': JSON.stringify({
        name: '@test/frontend',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'app-frontend', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    // Flow should execute (may not find file but should not crash)
    expect(result).toBeDefined()
  })

  it('resolves projects without prefix to libs/ folder', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/libs/myproject/package.json': JSON.stringify({
        name: '@test/myproject',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'myproject', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(result).toBeDefined()
  })
})

// ============================================================================
// resolvePackageName Tests (internal function tested via executeFlow)
// ============================================================================

describe('executeFlow - resolvePackageName behavior', () => {
  it('returns package name from package.json', async () => {
    const capturedContext: { packageName?: string } = {}

    const captureStep = createStep('capture', 'Capture Context', async (ctx: FlowContext) => {
      capturedContext.packageName = ctx.packageName
      return createSuccessResult('captured')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@myorg/test-package',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(capturedContext.packageName).toBe('@myorg/test-package')
  })

  it('returns "unknown" when package.json is missing', async () => {
    const capturedContext: { packageName?: string } = {}

    const captureStep = createStep('capture', 'Capture Context', async (ctx: FlowContext) => {
      capturedContext.packageName = ctx.packageName
      return createSuccessResult('captured')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    const tree = createMockTree({}) // No package.json

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(capturedContext.packageName).toBe('unknown')
  })

  it('returns "unknown" when package.json has no name field', async () => {
    const capturedContext: { packageName?: string } = {}

    const captureStep = createStep('capture', 'Capture Context', async (ctx: FlowContext) => {
      capturedContext.packageName = ctx.packageName
      return createSuccessResult('captured')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        version: '1.0.0',
        // No name field
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(capturedContext.packageName).toBe('unknown')
  })

  it('returns "unknown" when package.json is invalid JSON', async () => {
    const capturedContext: { packageName?: string } = {}

    const captureStep = createStep('capture', 'Capture Context', async (ctx: FlowContext) => {
      capturedContext.packageName = ctx.packageName
      return createSuccessResult('captured')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    // Create a mock tree that returns invalid JSON
    const tree = createMockTree({
      '/workspace/libs/test/package.json': '{ invalid json }',
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(capturedContext.packageName).toBe('unknown')
  })
})

// ============================================================================
// buildSummary Tests (tested via executeFlow result)
// ============================================================================

describe('executeFlow - buildSummary behavior', () => {
  it('includes version transition in summary when nextVersion is set', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry('1.0.0'),
      git: createMockGitClient([{ type: 'feat', subject: 'feature' }]),
    })

    expect(result.summary).toContain('→')
  })

  it('shows "No release needed" when bumpType is none and status is success', async () => {
    // Create a flow that results in no bump needed
    const noBumpStep = createStep('no-bump', 'No Bump', async () =>
      createSuccessResult('Done', {
        bumpType: 'none',
      })
    )

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [noBumpStep],
    }

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
    })

    expect(result.status).toBe('success')
    expect(result.state.bumpType).toBe('none')
    expect(result.summary).toContain('No release needed')
  })

  it('shows step counts in summary', async () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK'))
    const step2 = createStep('step2', 'Step 2', async () => createSkippedResult('Skipped'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2],
    }

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
    })

    expect(result.summary).toContain('1 completed')
    expect(result.summary).toContain('1 skipped')
    expect(result.summary).toContain('0 failed')
  })
})

// ============================================================================
// executeFlow - Status Determination
// ============================================================================

describe('executeFlow - flow status determination', () => {
  it('returns "skipped" status when all steps are skipped', async () => {
    const skipStep1 = createStep('skip1', 'Skip 1', async () => createSuccessResult('OK'), {
      skipIf: () => true,
    })
    const skipStep2 = createStep('skip2', 'Skip 2', async () => createSuccessResult('OK'), {
      skipIf: () => true,
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [skipStep1, skipStep2],
    }

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
    })

    expect(result.status).toBe('skipped')
  })

  it('returns "partial" status when some steps fail with continueOnError', async () => {
    const failStep = createStep(
      'fail',
      'Fail',
      async () => ({
        status: 'failed' as const,
        message: 'Failed',
      }),
      { continueOnError: true }
    )
    const successStep = createStep('success', 'Success', async () => createSuccessResult('OK'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep, successStep],
    }

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
    })

    expect(result.status).toBe('partial')
  })

  it('returns "success" status when all steps succeed', async () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK'))
    const step2 = createStep('step2', 'Step 2', async () => createSuccessResult('OK'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2],
    }

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
    })

    expect(result.status).toBe('success')
  })

  it('returns "failed" status when a step throws and continueOnError is false', async () => {
    const failStep = createStep('fail', 'Fail', async () => {
      throw new Error('Boom')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep],
    }

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
    })

    expect(result.status).toBe('failed')
  })
})

// ============================================================================
// executeFlow - Verbose Logging
// ============================================================================

describe('executeFlow - verbose logging', () => {
  it('sets log level to debug when verbose is true', async () => {
    const logger = createMockLogger()

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      verbose: true,
    })

    expect(logger.setLogLevel).toHaveBeenCalledWith('debug')
  })

  it('sets log level to error when verbose is false', async () => {
    const logger = createMockLogger()

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      verbose: false,
    })

    expect(logger.setLogLevel).toHaveBeenCalledWith('error')
  })
})

// ============================================================================
// executeFlow - Step Dependency Checking
// ============================================================================

describe('executeFlow - step dependencies', () => {
  it('skips step when dependency step did not succeed', async () => {
    const failStep = createStep(
      'first',
      'First',
      async () => ({
        status: 'failed' as const,
        message: 'Failed',
      }),
      { continueOnError: true }
    )

    const dependentStep = createStep('dependent', 'Dependent', async () => createSuccessResult('Should not run'), { dependsOn: ['first'] })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep, dependentStep],
    }

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
    })

    const depResult = result.steps.find((s) => s.stepId === 'dependent')
    expect(depResult?.status).toBe('skipped')
    expect(depResult?.message).toBe('Dependencies not met')
  })

  it('executes step when all dependencies succeed', async () => {
    const firstStep = createStep('first', 'First', async () => createSuccessResult('OK'))
    const dependentStep = createStep('dependent', 'Dependent', async () => createSuccessResult('Ran after first'), { dependsOn: ['first'] })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [firstStep, dependentStep],
    }

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
    })

    const depResult = result.steps.find((s) => s.stepId === 'dependent')
    expect(depResult?.status).toBe('success')
  })
})

// ============================================================================
// validateFlow Tests
// ============================================================================

describe('validateFlow', () => {
  it('returns empty array for valid flow', () => {
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [
        createStep('step1', 'Step 1', async () => createSuccessResult('OK')),
        createStep('step2', 'Step 2', async () => createSuccessResult('OK')),
      ],
    }

    const errors = validateFlow(flow)
    expect(errors).toHaveLength(0)
  })

  it('detects duplicate step IDs', () => {
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [
        createStep('same-id', 'Step 1', async () => createSuccessResult('OK')),
        createStep('same-id', 'Step 2', async () => createSuccessResult('OK')),
      ],
    }

    const errors = validateFlow(flow)
    expect(errors).toContainEqual('Duplicate step ID: "same-id"')
  })

  it('detects unknown dependency references', () => {
    const stepWithBadDep = createStep('step1', 'Step 1', async () => createSuccessResult('OK'), {
      dependsOn: ['nonexistent'],
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [stepWithBadDep],
    }

    const errors = validateFlow(flow)
    expect(errors.some((e) => e.includes('depends on unknown step'))).toBe(true)
  })

  it('detects circular dependencies', () => {
    const stepA = createStep('a', 'Step A', async () => createSuccessResult('OK'), {
      dependsOn: ['b'],
    })
    const stepB = createStep('b', 'Step B', async () => createSuccessResult('OK'), {
      dependsOn: ['a'],
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [stepA, stepB],
    }

    const errors = validateFlow(flow)
    expect(errors.some((e) => e.includes('Circular dependency'))).toBe(true)
  })

  it('detects self-referencing dependencies', () => {
    const selfRef = createStep('self', 'Self', async () => createSuccessResult('OK'), {
      dependsOn: ['self'],
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [selfRef],
    }

    const errors = validateFlow(flow)
    expect(errors.some((e) => e.includes('Circular dependency'))).toBe(true)
  })

  it('handles deeply nested valid dependencies', () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK'))
    const step2 = createStep('step2', 'Step 2', async () => createSuccessResult('OK'), {
      dependsOn: ['step1'],
    })
    const step3 = createStep('step3', 'Step 3', async () => createSuccessResult('OK'), {
      dependsOn: ['step2'],
    })
    const step4 = createStep('step4', 'Step 4', async () => createSuccessResult('OK'), {
      dependsOn: ['step3'],
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [step1, step2, step3, step4],
    }

    const errors = validateFlow(flow)
    expect(errors).toHaveLength(0)
  })
})

// ============================================================================
// dryRun Wrapper Tests
// ============================================================================

describe('dryRun', () => {
  it('forces dryRun to true', async () => {
    let capturedDryRun: boolean | undefined

    const captureStep = createStep('capture', 'Capture', async (ctx: FlowContext) => {
      capturedDryRun = ctx.config.dryRun
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false }, // Explicitly false
      steps: [captureStep],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await dryRun(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(capturedDryRun).toBe(true)
  })
})

// ============================================================================
// Step State Updates Tests
// ============================================================================

describe('executeFlow - state accumulation', () => {
  it('accumulates state updates from multiple steps', async () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK', { currentVersion: '1.0.0' }))
    const step2 = createStep('step2', 'Step 2', async () => createSuccessResult('OK', { nextVersion: '1.1.0' }))
    const step3 = createStep('step3', 'Step 3', async () => createSuccessResult('OK', { bumpType: 'minor' as const }))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2, step3],
    }

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
    })

    expect(result.state.currentVersion).toBe('1.0.0')
    expect(result.state.nextVersion).toBe('1.1.0')
    expect(result.state.bumpType).toBe('minor')
  })

  it('later steps can access state from earlier steps', async () => {
    let capturedState: Record<string, unknown> | undefined

    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK', { myValue: 'hello' }))
    const step2 = createStep('step2', 'Step 2', async (ctx: FlowContext) => {
      capturedState = { ...ctx.state }
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(capturedState?.['myValue']).toBe('hello')
  })
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('executeFlow - error handling', () => {
  it('converts non-Error throws to Error objects', async () => {
    const throwStringStep = createStep('throw-string', 'Throw String', async () => {
      throw 'string error'
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStringStep],
    }

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
    })

    expect(result.status).toBe('failed')
    const failedStep = result.steps.find((s) => s.stepId === 'throw-string')
    expect(failedStep?.error).toBeInstanceOf(Error)
    expect(failedStep?.message).toBe('string error')
  })
})

// ============================================================================
// Flow Duration Tests
// ============================================================================

describe('executeFlow - timing', () => {
  it('returns duration in milliseconds', async () => {
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

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
    })

    expect(typeof result.duration).toBe('number')
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})

describe('validateFlow - complex circular dependencies', () => {
  it('detects three-node circular dependencies (A → B → C → A)', () => {
    const stepA = createStep('a', 'Step A', async () => createSuccessResult('OK'), {
      dependsOn: ['c'],
    })
    const stepB = createStep('b', 'Step B', async () => createSuccessResult('OK'), {
      dependsOn: ['a'],
    })
    const stepC = createStep('c', 'Step C', async () => createSuccessResult('OK'), {
      dependsOn: ['b'],
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: {},
      steps: [stepA, stepB, stepC],
    }

    const errors = validateFlow(flow)
    expect(errors.some((e) => e.includes('Circular dependency'))).toBe(true)
  })
})
