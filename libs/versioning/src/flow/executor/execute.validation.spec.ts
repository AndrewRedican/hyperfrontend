import type { FlowContext } from '../models/types'
import type { MockFileChange } from './__test-utils__/mocks'
import { createStep, createSuccessResult } from '../models/step'
import { createMockGitClient, createMockLogger, createMockRegistry, createMockTree } from './__test-utils__/mocks'
import { dryRun, executeFlow, validateFlow } from './execute'

jest.mock('@hyperfrontend/project-scope/nx', () => ({
  isNxWorkspace: jest.fn(),
  discoverNxProjects: jest.fn(),
}))

jest.mock('../../workspace/discovery', () => ({
  discoverProjectByName: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/vfs', () => ({
  createTree: jest.fn(),
  commitChanges: jest.fn(),
  rollbackChanges: jest.fn(),
  generateAllDiffs: jest.fn(),
  formatUnifiedDiff: jest.fn(),
}))

const projectScopeNx = require('@hyperfrontend/project-scope/nx')
const workspaceDiscovery = require('../../workspace/discovery')
const projectScopeVfs = require('@hyperfrontend/project-scope/vfs')

beforeEach(() => {
  jest.clearAllMocks()
  projectScopeNx.isNxWorkspace.mockReturnValue(false)
  projectScopeNx.discoverNxProjects.mockReturnValue(new Map())
  workspaceDiscovery.discoverProjectByName.mockReturnValue(null)
  projectScopeVfs.commitChanges.mockImplementation(() => void 0)
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
      config: { dryRun: false },
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
    projectScopeVfs.generateAllDiffs.mockReturnValue([mockFileDiff])
    projectScopeVfs.formatUnifiedDiff.mockReturnValue('--- a/libs/test/package.json\n+++ b/libs/test/package.json')
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

    expect(projectScopeVfs.generateAllDiffs).not.toHaveBeenCalled()
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

    expect(projectScopeVfs.generateAllDiffs).toHaveBeenCalledWith(expect.anything())
    expect(projectScopeVfs.formatUnifiedDiff).toHaveBeenCalledWith(mockFileDiff)
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

    expect(projectScopeVfs.generateAllDiffs).toHaveBeenCalledWith(expect.anything())
    expect(projectScopeVfs.formatUnifiedDiff).not.toHaveBeenCalled()
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
      []
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      showDiff: true,
      projectRoot: 'libs/test',
    })

    expect(projectScopeVfs.generateAllDiffs).not.toHaveBeenCalled()
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
    projectScopeVfs.generateAllDiffs.mockReturnValue(mockDiffs)
    projectScopeVfs.formatUnifiedDiff.mockImplementation((d: { path: string }) => `--- a/${d.path}\n+++ b/${d.path}`)

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
    expect(projectScopeVfs.formatUnifiedDiff).toHaveBeenCalledTimes(2)
  })
})
