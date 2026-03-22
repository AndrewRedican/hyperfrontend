import type { Tree } from '@hyperfrontend/project-scope'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowContext } from '../models/types'
import { createSkippedResult, createStep, createSuccessResult } from '../models/step'
import { createMinimalFlow } from '../presets/conventional'
import { dryRun, executeFlow, validateFlow } from './execute'

// Mock external discovery modules
jest.mock('@hyperfrontend/project-scope/nx', () => ({
  isNxWorkspace: jest.fn(),
  discoverNxProjects: jest.fn(),
}))

jest.mock('../../workspace/discovery', () => ({
  discoverProjectByName: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope', () => ({
  createTree: jest.fn(),
  commitChanges: jest.fn(),
  generateAllDiffs: jest.fn(),
  formatUnifiedDiff: jest.fn(),
}))

const projectScopeNx = require('@hyperfrontend/project-scope/nx')
const workspaceDiscovery = require('../../workspace/discovery')
const projectScope = require('@hyperfrontend/project-scope')

interface MockFileChange {
  path: string
  type: 'CREATE' | 'UPDATE' | 'DELETE'
}

function createMockTree(files: Record<string, string> = {}, changes: MockFileChange[] = []): Tree {
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
      return changes
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

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  // Default mock implementations - most tests use explicit projectRoot
  projectScopeNx.isNxWorkspace.mockReturnValue(false)
  projectScopeNx.discoverNxProjects.mockReturnValue(new Map())
  workspaceDiscovery.discoverProjectByName.mockReturnValue(null)
  projectScope.commitChanges.mockImplementation(() => void 0)
})

describe('executeFlow - project discovery with explicit projectRoot', () => {
  it('executes flow with explicit projectRoot for libs/ project', async () => {
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
      projectRoot: 'libs/utils',
    })

    // Flow should execute and find the package
    expect(result.status).not.toBe('failed')
  })

  it('executes flow with explicit projectRoot for apps/ project', async () => {
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
      projectRoot: 'apps/frontend',
    })

    expect(result.status).not.toBe('failed')
  })

  it('executes flow with nested project path', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/libs/utils/myproject/package.json': JSON.stringify({
        name: '@test/myproject',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-myproject', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/utils/myproject',
    })

    expect(result.status).not.toBe('failed')
  })

  it('fails gracefully when project cannot be discovered without projectRoot', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/libs/myproject/package.json': JSON.stringify({
        name: '@test/myproject',
        version: '1.0.0',
      }),
    })

    // Without projectRoot, discovery must find the project (which won't work with mock tree)
    const result = await executeFlow(flow, 'nonexistent-project', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(result.status).toBe('failed')
    expect(result.summary).toContain('not found')
  })
})

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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    // Project discovery fails when package.json is missing
    expect(capturedContext.packageName).toBeUndefined()
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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    expect(capturedContext.packageName).toBe('unknown')
  })
})

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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('1 completed')
    expect(result.summary).toContain('1 skipped')
    expect(result.summary).toContain('0 failed')
  })
})

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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
  })
})

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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    expect(logger.setLogLevel).toHaveBeenCalledWith('error')
  })
})

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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    const depResult = result.steps.find((s) => s.stepId === 'dependent')
    expect(depResult?.status).toBe('success')
  })
})

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
      projectRoot: 'libs/test',
    })

    expect(capturedDryRun).toBe(true)
  })
})

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
      projectRoot: 'libs/test',
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
      projectRoot: 'libs/test',
    })

    expect(capturedState?.['myValue']).toBe('hello')
  })
})

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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
    const failedStep = result.steps.find((s) => s.stepId === 'throw-string')
    expect(failedStep?.error).toBeInstanceOf(Error)
    expect(failedStep?.message).toBe('string error')
  })
})

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
      projectRoot: 'libs/test',
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

describe('executeFlow - discoverProjectRoot behavior', () => {
  it('uses provided projectRoot option (relative path)', async () => {
    let capturedProjectRoot: string | undefined

    const captureStep = createStep('capture', 'Capture', async (ctx: FlowContext) => {
      capturedProjectRoot = ctx.projectRoot
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    const tree = createMockTree({
      '/workspace/libs/utils/immutable-api/package.json': JSON.stringify({
        name: '@test/immutable-api',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-immutable-api-utils', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/utils/immutable-api',
    })

    expect(capturedProjectRoot).toBe('/workspace/libs/utils/immutable-api')
  })

  it('uses provided projectRoot option (absolute path)', async () => {
    let capturedProjectRoot: string | undefined

    const captureStep = createStep('capture', 'Capture', async (ctx: FlowContext) => {
      capturedProjectRoot = ctx.projectRoot
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    const tree = createMockTree({
      '/workspace/libs/utils/immutable-api/package.json': JSON.stringify({
        name: '@test/immutable-api',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-immutable-api-utils', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: '/workspace/libs/utils/immutable-api',
    })

    expect(capturedProjectRoot).toBe('/workspace/libs/utils/immutable-api')
  })

  it('returns failed status when project cannot be discovered', async () => {
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    // Empty tree - no package.json anywhere
    const tree = createMockTree({})

    const result = await executeFlow(flow, 'nonexistent-project', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
    })

    expect(result.status).toBe('failed')
    expect(result.summary).toContain('not found')
  })

  it('returns failed status when package.json does not exist at resolved path', async () => {
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    // Tree has no package.json at the given path
    const tree = createMockTree({
      '/workspace/libs/other/package.json': JSON.stringify({ name: '@test/other', version: '1.0.0' }),
    })

    const result = await executeFlow(flow, 'missing-project', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/missing',
    })

    expect(result.status).toBe('failed')
    expect(result.summary).toContain('Invalid project root')
  })
})

describe('executeFlow - buildSummary edge cases', () => {
  it('shows "?.?.?" when currentVersion is undefined but nextVersion is set', async () => {
    const setNextVersionStep = createStep('set-next', 'Set Next', async () =>
      createSuccessResult('OK', {
        nextVersion: '2.0.0',
        // currentVersion is NOT set
      })
    )

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [setNextVersionStep],
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
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('?.?.?')
    expect(result.summary).toContain('2.0.0')
  })

  it('shows failed count in summary when steps fail with continueOnError', async () => {
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
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('1 completed')
    expect(result.summary).toContain('1 failed')
  })
})

describe('executeFlow - context properties', () => {
  it('provides all expected context properties to steps', async () => {
    // Use mutable object to capture values (FlowContext has readonly props)
    const capturedContext: {
      workspaceRoot?: string
      projectName?: string
      projectRoot?: string
      packageName?: string
      tree?: Tree
      registry?: Registry
      git?: GitClient
      logger?: ReturnType<typeof createMockLogger>
      config?: FlowContext['config']
      state?: FlowContext['state']
    } = {}

    const captureStep = createStep('capture', 'Capture', async (ctx: FlowContext) => {
      capturedContext.workspaceRoot = ctx.workspaceRoot
      capturedContext.projectName = ctx.projectName
      capturedContext.projectRoot = ctx.projectRoot
      capturedContext.packageName = ctx.packageName
      capturedContext.tree = ctx.tree
      capturedContext.registry = ctx.registry
      capturedContext.git = ctx.git
      capturedContext.logger = ctx.logger as ReturnType<typeof createMockLogger>
      capturedContext.config = ctx.config
      capturedContext.state = ctx.state
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const registry = createMockRegistry()
    const git = createMockGitClient()
    const logger = createMockLogger()

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry,
      git,
      logger,
      projectRoot: 'libs/test',
    })

    expect(capturedContext.workspaceRoot).toBe('/workspace')
    expect(capturedContext.projectName).toBe('lib-test')
    expect(capturedContext.projectRoot).toBeDefined()
    expect(capturedContext.packageName).toBe('@test/pkg')
    expect(capturedContext.tree).toBe(tree)
    expect(capturedContext.registry).toBe(registry)
    expect(capturedContext.git).toBe(git)
    expect(capturedContext.logger).toBe(logger)
    expect(capturedContext.config).toBeDefined()
    expect(capturedContext.config?.dryRun).toBe(true)
    expect(capturedContext.state).toEqual({})
  })
})

describe('executeFlow - continueOnError with throws', () => {
  it('continues to next step when step throws and continueOnError is true', async () => {
    let secondStepRan = false

    const throwStep = createStep(
      'throw',
      'Throw',
      async () => {
        throw new Error('Intentional error')
      },
      { continueOnError: true }
    )

    const secondStep = createStep('second', 'Second', async () => {
      secondStepRan = true
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStep, secondStep],
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
      projectRoot: 'libs/test',
    })

    expect(secondStepRan).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.steps[0].status).toBe('failed')
    expect(result.steps[1].status).toBe('success')
  })

  it('stops execution when step throws and continueOnError is false', async () => {
    let secondStepRan = false

    const throwStep = createStep('throw', 'Throw', async () => {
      throw new Error('Intentional error')
    })

    const secondStep = createStep('second', 'Second', async () => {
      secondStepRan = true
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStep, secondStep],
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
      projectRoot: 'libs/test',
    })

    expect(secondStepRan).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.steps).toHaveLength(1)
  })
})

describe('executeFlow - config merging', () => {
  it('options.dryRun overrides flow.config.dryRun', async () => {
    let capturedDryRun: boolean | undefined

    const captureStep = createStep('capture', 'Capture', async (ctx: FlowContext) => {
      capturedDryRun = ctx.config.dryRun
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [captureStep],
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
      dryRun: true,
      projectRoot: 'libs/test',
    })

    expect(capturedDryRun).toBe(true)
  })

  it('uses flow.config.dryRun when options.dryRun is undefined', async () => {
    let capturedDryRun: boolean | undefined

    const captureStep = createStep('capture', 'Capture', async (ctx: FlowContext) => {
      capturedDryRun = ctx.config.dryRun
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [captureStep],
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
      // dryRun not specified
      projectRoot: 'libs/test',
    })

    expect(capturedDryRun).toBe(true)
  })
})

describe('executeFlow - logging behavior', () => {
  it('warns when package name is unknown', async () => {
    const logger = createMockLogger()

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        // No name field
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read package name'))
  })

  it('logs flow info at start', async () => {
    const logger = createMockLogger()

    const flow = {
      id: 'test',
      name: 'My Test Flow',
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
      projectRoot: 'libs/test',
    })

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('My Test Flow'))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('lib-test'))
  })
})

describe('executeFlow - Nx workspace project discovery', () => {
  it('discovers project via Nx when workspace is Nx-based and project exists', async () => {
    // Mock Nx workspace detection and project discovery
    projectScopeNx.isNxWorkspace.mockReturnValue(true)
    projectScopeNx.discoverNxProjects.mockReturnValue(new Map([['lib-my-package', { root: 'libs/my-package', name: 'lib-my-package' }]]))

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/my-package/package.json': JSON.stringify({
        name: '@test/my-package',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-my-package', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
    })

    expect(projectScopeNx.isNxWorkspace).toHaveBeenCalledWith('/workspace')
    expect(projectScopeNx.discoverNxProjects).toHaveBeenCalledWith('/workspace')
    expect(result.status).toBe('success')
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Nx workspace detected'))
  })

  it('falls back to workspace discovery when Nx discovery throws an error', async () => {
    projectScopeNx.isNxWorkspace.mockReturnValue(true)
    projectScopeNx.discoverNxProjects.mockImplementation(() => {
      throw new Error('Nx project graph read failed')
    })
    workspaceDiscovery.discoverProjectByName.mockReturnValue({
      name: 'fallback-pkg',
      path: '/workspace/libs/fallback',
      version: '1.0.0',
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/fallback/package.json': JSON.stringify({
        name: '@test/fallback-pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-fallback', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
    })

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Nx project discovery failed'))
    expect(workspaceDiscovery.discoverProjectByName).toHaveBeenCalled()
    expect(result.status).toBe('success')
  })

  it('falls back to workspace discovery when project not found in Nx graph', async () => {
    projectScopeNx.isNxWorkspace.mockReturnValue(true)
    projectScopeNx.discoverNxProjects.mockReturnValue(new Map()) // Empty - project not found
    workspaceDiscovery.discoverProjectByName.mockReturnValue({
      name: 'discovered-pkg',
      path: '/workspace/packages/discovered',
      version: '2.0.0',
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/packages/discovered/package.json': JSON.stringify({
        name: '@test/discovered-pkg',
        version: '2.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-discovered', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
    })

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('not found in Nx project graph'))
    expect(workspaceDiscovery.discoverProjectByName).toHaveBeenCalledWith('lib-discovered', { workspaceRoot: '/workspace' })
    expect(result.status).toBe('success')
  })
})

describe('executeFlow - workspace discovery fallback', () => {
  it('discovers project via discoverProjectByName when not in Nx workspace', async () => {
    projectScopeNx.isNxWorkspace.mockReturnValue(false)
    workspaceDiscovery.discoverProjectByName.mockReturnValue({
      name: 'my-lib',
      path: '/workspace/packages/my-lib',
      version: '1.0.0',
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/packages/my-lib/package.json': JSON.stringify({
        name: '@test/my-lib',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'my-lib', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
    })

    expect(projectScopeNx.discoverNxProjects).not.toHaveBeenCalled()
    expect(workspaceDiscovery.discoverProjectByName).toHaveBeenCalledWith('my-lib', { workspaceRoot: '/workspace' })
    expect(result.status).toBe('success')
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('workspace discovery'))
  })

  it('logs error and returns failed when workspace discovery throws', async () => {
    projectScopeNx.isNxWorkspace.mockReturnValue(false)
    workspaceDiscovery.discoverProjectByName.mockImplementation(() => {
      throw new Error('Workspace traversal failed')
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({})

    const result = await executeFlow(flow, 'broken-project', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
    })

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Workspace discovery failed'))
    expect(result.status).toBe('failed')
    expect(result.summary).toContain('not found')
  })
})

describe('executeFlow - VFS commit behavior', () => {
  it('commits VFS changes to disk when dryRun is false and flow succeeds', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
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
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(projectScope.commitChanges).toHaveBeenCalledWith(tree, { verbose: undefined })
    expect(logger.info).toHaveBeenCalledWith('File changes committed to disk')
  })

  it('commits VFS changes with verbose option when verbose is true', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
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
      projectRoot: 'libs/test',
      dryRun: false,
      verbose: true,
    })

    expect(projectScope.commitChanges).toHaveBeenCalledWith(tree, { verbose: true })
  })

  it('logs error when commitChanges throws but does not fail the flow', async () => {
    projectScope.commitChanges.mockImplementation(() => {
      throw new Error('Filesystem permission denied')
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
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
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to commit file changes'))
    // Flow status should still reflect step execution success
    expect(result.status).toBe('success')
  })

  it('does not commit changes when dryRun is true', async () => {
    const logger = createMockLogger()
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(projectScope.commitChanges).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('Dry run mode - no changes to write')
  })

  it('does not commit changes when flow fails', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [
        createStep('fail', 'Fail', async () => {
          throw new Error('Step failed')
        }),
      ],
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
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(projectScope.commitChanges).not.toHaveBeenCalled()
    expect(result.status).toBe('failed')
  })

  it('populates modifiedFiles in result from tree.listChanges()', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [
      { path: 'libs/test/package.json', type: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', type: 'UPDATE' },
    ]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.modifiedFiles).toEqual([
      { path: 'libs/test/package.json', changeType: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', changeType: 'UPDATE' },
    ])
  })

  it('logs pending changes when verbose is true', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      verbose: true,
      projectRoot: 'libs/test',
    })

    expect(logger.info).toHaveBeenCalledWith('Pending changes: 1 file(s)')
    expect(logger.info).toHaveBeenCalledWith('  [UPDATE] libs/test/package.json')
  })

  it('shows would-modify message in dry-run mode with pending changes', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [
      { path: 'libs/test/package.json', type: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', type: 'CREATE' },
    ]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(projectScope.commitChanges).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('Dry run - would modify 2 file(s):')
    expect(logger.info).toHaveBeenCalledWith('  [UPDATE] libs/test/package.json')
    expect(logger.info).toHaveBeenCalledWith('  [CREATE] libs/test/CHANGELOG.md')
  })
})

describe('executeFlow - showDiff option', () => {
  const mockFileDiff = {
    path: 'libs/test/package.json',
    lines: [
      { type: 'context' as const, line: 1, content: '{' },
      { type: 'remove' as const, line: 2, content: '  "version": "1.0.0"' },
      { type: 'add' as const, line: 2, content: '  "version": "1.1.0"' },
      { type: 'context' as const, line: 3, content: '}' },
    ],
    additions: 1,
    deletions: 1,
  }

  beforeEach(() => {
    projectScope.generateAllDiffs.mockReturnValue([mockFileDiff])
    projectScope.formatUnifiedDiff.mockReturnValue('--- a/libs/test/package.json\n+++ b/libs/test/package.json')
  })

  it('does not generate diffs when showDiff is false', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: false,
      projectRoot: 'libs/test',
    })

    expect(projectScope.generateAllDiffs).not.toHaveBeenCalled()
    expect(result.diffs).toBeUndefined()
  })

  it('generates and logs unified diffs when showDiff is true (default format)', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: true,
      projectRoot: 'libs/test',
    })

    expect(projectScope.generateAllDiffs).toHaveBeenCalledWith(expect.anything())
    expect(projectScope.formatUnifiedDiff).toHaveBeenCalledWith(mockFileDiff)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Pending changes:'))
    expect(logger.info).toHaveBeenCalledWith('--- a/libs/test/package.json\n+++ b/libs/test/package.json')
    expect(result.diffs).toEqual([mockFileDiff])
  })

  it('generates and logs summary diffs when diffFormat is summary', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: true,
      diffFormat: 'summary',
      projectRoot: 'libs/test',
    })

    expect(projectScope.generateAllDiffs).toHaveBeenCalledWith(expect.anything())
    expect(projectScope.formatUnifiedDiff).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('libs/test/package.json: +1 -1')
    expect(result.diffs).toEqual([mockFileDiff])
  })

  it('logs "No file changes to commit" when showDiff is true but no changes exist', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      [] // No pending changes
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: true,
      projectRoot: 'libs/test',
    })

    expect(projectScope.generateAllDiffs).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('No file changes to commit')
    expect(result.diffs).toBeUndefined()
  })

  it('does not duplicate verbose logging when showDiff is enabled', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: true,
      verbose: true,
      projectRoot: 'libs/test',
    })

    // Should not see verbose "Pending changes: X file(s)" since diff output handles that
    const infoCallArgs = logger.info.mock.calls.map((c: unknown[]) => c[0])
    const pendingChangesVerboseCount = infoCallArgs.filter((arg: string) => arg === 'Pending changes: 1 file(s)').length
    expect(pendingChangesVerboseCount).toBe(0)
  })

  it('includes diffs in FlowResult when showDiff is true', async () => {
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      showDiff: true,
      projectRoot: 'libs/test',
    })

    expect(result.diffs).toBeDefined()
    expect(result.diffs).toHaveLength(1)
    expect(result.diffs?.[0]).toEqual(mockFileDiff)
  })

  it('handles multiple file diffs', async () => {
    const mockDiffs = [
      { path: 'libs/test/package.json', lines: [], additions: 1, deletions: 1 },
      { path: 'libs/test/CHANGELOG.md', lines: [], additions: 10, deletions: 0 },
    ]
    projectScope.generateAllDiffs.mockReturnValue(mockDiffs)
    projectScope.formatUnifiedDiff.mockImplementation((d: { path: string }) => `--- a/${d.path}\n+++ b/${d.path}`)

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [
      { path: 'libs/test/package.json', type: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', type: 'CREATE' },
    ]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: true,
      projectRoot: 'libs/test',
    })

    expect(result.diffs).toHaveLength(2)
    expect(projectScope.formatUnifiedDiff).toHaveBeenCalledTimes(2)
  })
})
