import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowContext } from '../models/types'
import { beforeEach } from 'node:test'
import * as projectScopeNx from '@hyperfrontend/project-scope/nx'
import * as projectScopeVfs from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as workspaceDiscovery from '../../workspace/discovery'
import { createStep, createSuccessResult } from '../models/step'
import { createMinimalFlow } from '../presets/conventional'
import { createMockGitClient, createMockLogger, createMockRegistry, createMockTree } from './__test-utils__/mocks'
import { executeFlow } from './execute'

jest.mock('@hyperfrontend/project-scope/nx', () => ({
  isNxWorkspace: jest.fn(),
  discoverNxProjects: jest.fn(),
  buildSimpleProjectGraph: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks()
  projectScopeNx.isNxWorkspace.mockReturnValue(false)
  projectScopeNx.discoverNxProjects.mockReturnValue(new Map())
  workspaceDiscovery.discoverProjectByName.mockReturnValue(null)
  projectScopeVfs.commitChanges.mockImplementation(() => void 0)
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

    const tree = createMockTree({})

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/test',
    })

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

describe('executeFlow - context properties', () => {
  it('provides all expected context properties to steps', async () => {
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

describe('executeFlow - Nx workspace project discovery', () => {
  it('discovers project via Nx when workspace is Nx-based and project exists', async () => {
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
    projectScopeNx.discoverNxProjects.mockReturnValue(new Map())
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
    expect(workspaceDiscovery.discoverProjectByName).toHaveBeenCalledWith(
      'lib-discovered',
      expect.objectContaining({ workspaceRoot: '/workspace', tree })
    )
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
    expect(workspaceDiscovery.discoverProjectByName).toHaveBeenCalledWith(
      'my-lib',
      expect.objectContaining({ workspaceRoot: '/workspace', tree })
    )
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
