import type { Tree } from '@hyperfrontend/project-scope'
import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import type { PlannedBump } from './cascade-bump'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createProject } from '../models/project'
import { createWorkspace, DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import { applyBumps, DEFAULT_BATCH_UPDATE_OPTIONS, summarizeBatchUpdate, updatePackageVersionInTree } from './batch-update'

// Mock project-scope file operations
jest.mock('@hyperfrontend/project-scope', () => ({
  readFileContent: jest.fn(),
  writeFileContent: jest.fn(),
}))

function createTestProject(
  name: string,
  version = '1.0.0',
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
  peerDeps: Record<string, string> = {},
  options: { private?: boolean } = {}
): Project {
  return createProject({
    name,
    version,
    path: `/workspace/packages/${name}`,
    packageJsonPath: `/workspace/packages/${name}/package.json`,
    packageJson: {
      name,
      version,
      dependencies: deps,
      devDependencies: devDeps,
      peerDependencies: peerDeps,
      private: options.private,
    },
    internalDependencies: Object.keys({ ...deps, ...devDeps, ...peerDeps }),
  })
}

function createTestWorkspace(
  projects: Project[],
  depGraph: Map<string, readonly string[]>,
  reverseDepGraph: Map<string, readonly string[]>
): Workspace {
  const projectMap = createMap(projects.map((p) => [p.name, p] as [string, Project]))

  return createWorkspace({
    root: '/workspace',
    type: 'nx',
    projects: projectMap,
    config: DEFAULT_WORKSPACE_CONFIG,
    dependencyGraph: depGraph,
    reverseDependencyGraph: reverseDepGraph,
  })
}

describe('DEFAULT_BATCH_UPDATE_OPTIONS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_BATCH_UPDATE_OPTIONS.dryRun).toBe(false)
    expect(DEFAULT_BATCH_UPDATE_OPTIONS.updateDependencyReferences).toBe(true)
  })
})

describe('applyBumps', () => {
  const createPlannedBump = (
    name: string,
    currentVersion: string,
    nextVersion: string,
    bumpType: PlannedBump['bumpType'] = 'minor'
  ): PlannedBump => ({
    name,
    currentVersion,
    nextVersion,
    bumpType,
    reason: 'direct',
    triggeredBy: [],
  })

  it('updates package version in dry run mode', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.updated).toHaveLength(1)
    expect(result.updated[0].name).toBe('lib-a')
    expect(result.updated[0].previousVersion).toBe('1.0.0')
    expect(result.updated[0].newVersion).toBe('1.1.0')
    expect(result.success).toBe(true)
  })

  it('handles multiple packages', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const libB = createTestProject('lib-b', '2.0.0')
    const libC = createTestProject('lib-c', '3.0.0')

    const workspace = createTestWorkspace(
      [libA, libB, libC],
      createMap([
        ['lib-a', [] as readonly string[]],
        ['lib-b', [] as readonly string[]],
        ['lib-c', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', [] as readonly string[]],
        ['lib-b', [] as readonly string[]],
        ['lib-c', [] as readonly string[]],
      ])
    )

    const bumps = [
      createPlannedBump('lib-a', '1.0.0', '1.1.0'),
      createPlannedBump('lib-b', '2.0.0', '2.0.1', 'patch'),
      createPlannedBump('lib-c', '3.0.0', '4.0.0', 'major'),
    ]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.updated).toHaveLength(3)
    expect(result.total).toBe(3)
    expect(result.success).toBe(true)
  })

  it('tracks non-existent packages as failed', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0'), createPlannedBump('nonexistent', '1.0.0', '1.1.0')]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.updated).toHaveLength(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].name).toBe('nonexistent')
    expect(result.success).toBe(false)
  })

  it('returns empty when no bumps provided', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const result = applyBumps(workspace, [], { dryRun: true })

    expect(result.updated).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.success).toBe(true)
  })

  it('provides total count', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const libB = createTestProject('lib-b', '2.0.0')

    const workspace = createTestWorkspace(
      [libA, libB],
      createMap([
        ['lib-a', [] as readonly string[]],
        ['lib-b', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', [] as readonly string[]],
        ['lib-b', [] as readonly string[]],
      ])
    )

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0'), createPlannedBump('lib-b', '2.0.0', '2.1.0')]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.total).toBe(2)
  })

  it('handles prerelease bumps', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const bumps: PlannedBump[] = [
      {
        name: 'lib-a',
        currentVersion: '1.0.0',
        nextVersion: '1.1.0-alpha.0',
        bumpType: 'minor',
        reason: 'direct',
        triggeredBy: [],
      },
    ]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.updated).toHaveLength(1)
    expect(result.updated[0].newVersion).toBe('1.1.0-alpha.0')
  })

  it('includes package paths in result', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.updated[0].packageJsonPath).toBe('/workspace/packages/lib-a/package.json')
  })

  it('reports success as false when any update fails', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0'), createPlannedBump('missing-pkg', '1.0.0', '1.1.0')]
    const result = applyBumps(workspace, bumps, { dryRun: true })

    expect(result.success).toBe(false)
    expect(result.failed.length).toBeGreaterThan(0)
  })

  describe('non-dry-run mode', () => {
    const projectScope = require('@hyperfrontend/project-scope')

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('calls updatePackageVersion when dryRun is false', () => {
      const libA = createTestProject('lib-a', '1.0.0')
      const workspace = createTestWorkspace(
        [libA],
        createMap([['lib-a', [] as readonly string[]]]),
        createMap([['lib-a', [] as readonly string[]]])
      )

      projectScope.readFileContent.mockReturnValue('{"name": "lib-a", "version": "1.0.0"}')
      projectScope.writeFileContent.mockImplementation(() => void 0)

      const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
      const result = applyBumps(workspace, bumps, { dryRun: false })

      expect(projectScope.readFileContent).toHaveBeenCalledWith('/workspace/packages/lib-a/package.json')
      expect(projectScope.writeFileContent).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.updated).toHaveLength(1)
    })

    it('handles updatePackageVersion errors gracefully', () => {
      const libA = createTestProject('lib-a', '1.0.0')
      const workspace = createTestWorkspace(
        [libA],
        createMap([['lib-a', [] as readonly string[]]]),
        createMap([['lib-a', [] as readonly string[]]])
      )

      projectScope.readFileContent.mockImplementation(() => {
        throw new Error('File not found')
      })

      const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
      const result = applyBumps(workspace, bumps, { dryRun: false })

      expect(result.success).toBe(false)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toBe('File not found')
    })

    it('handles non-Error objects in catch block', () => {
      const libA = createTestProject('lib-a', '1.0.0')
      const workspace = createTestWorkspace(
        [libA],
        createMap([['lib-a', [] as readonly string[]]]),
        createMap([['lib-a', [] as readonly string[]]])
      )

      projectScope.readFileContent.mockImplementation(() => {
        throw 'String error'
      })

      const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
      const result = applyBumps(workspace, bumps, { dryRun: false })

      expect(result.success).toBe(false)
      expect(result.failed[0].error).toBe('String error')
    })

    it('updates dependency references when updateDependencyReferences is true', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '^1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      // First call for updatePackageVersion (lib-core), second for dependency refs
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation(() => void 0)

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      const result = applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(result.success).toBe(true)
      // Should read lib-core for version update + both packages for dependency refs
      expect(projectScope.readFileContent).toHaveBeenCalled()
    })

    it('skips dependency reference updates when updateDependencyReferences is false', () => {
      const libA = createTestProject('lib-a', '1.0.0')
      const workspace = createTestWorkspace(
        [libA],
        createMap([['lib-a', [] as readonly string[]]]),
        createMap([['lib-a', [] as readonly string[]]])
      )

      projectScope.readFileContent.mockReturnValue('{"name": "lib-a", "version": "1.0.0"}')
      projectScope.writeFileContent.mockImplementation(() => void 0)

      const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: false })

      // Only one read for the package version update, not for dependency refs
      expect(projectScope.readFileContent).toHaveBeenCalledTimes(1)
    })

    it('handles dependency reference update errors gracefully', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '^1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let readCount = 0
      projectScope.readFileContent.mockImplementation(() => {
        readCount++
        // First read succeeds (for version update), subsequent fail (for dep refs)
        if (readCount === 1) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        throw new Error('Read failed')
      })
      projectScope.writeFileContent.mockImplementation(() => void 0)

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      const result = applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      // Should still succeed - dependency reference updates are best-effort
      expect(result.success).toBe(true)
    })

    it('preserves caret prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '^1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "^1.1.0"')
    })

    it('preserves tilde prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '~1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "~1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "~1.1.0"')
    })

    it('preserves >= prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '>=1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": ">=1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": ">=1.1.0"')
    })

    it('preserves > prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '>1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": ">1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": ">1.1.0"')
    })

    it('preserves <= prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '<=1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "<=1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "<=1.1.0"')
    })

    it('preserves < prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '<2.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "<2.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "<1.1.0"')
    })

    it('preserves = prefix when updating dependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '=1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "=1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "=1.1.0"')
    })

    it('uses exact version when no prefix exists', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "1.1.0"')
    })

    it('updates devDependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', {}, { 'lib-core': '^1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "devDependencies": {"lib-core": "^1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "^1.1.0"')
    })

    it('updates peerDependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', {}, {}, { 'lib-core': '^1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "peerDependencies": {"lib-core": "^1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "^1.1.0"')
    })

    it('updates optionalDependencies', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0')
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        return '{"name": "lib-app", "version": "2.0.0", "optionalDependencies": {"lib-core": "^1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      expect(writtenContent).toContain('"lib-core": "^1.1.0"')
    })

    it('does not write when no dependencies are modified', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0')
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ]),
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        // lib-app has no dependencies on lib-core
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"other-lib": "^1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation(() => void 0)

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      // Should write for lib-core version update, but not for lib-app (no matching deps)
      expect(projectScope.writeFileContent).toHaveBeenCalledTimes(1)
    })

    it('handles package with no dependency sections at all', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0')
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ]),
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        // lib-app has no dependency sections at all
        return '{"name": "lib-app", "version": "2.0.0"}'
      })
      projectScope.writeFileContent.mockImplementation(() => void 0)

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      // Should write for lib-core version update only
      expect(projectScope.writeFileContent).toHaveBeenCalledTimes(1)
    })

    it('updates deps in multiple dependency sections', () => {
      const libCore = createTestProject('lib-core', '1.0.0')
      const libApp = createTestProject('lib-app', '2.0.0', { 'lib-core': '^1.0.0' }, {}, { 'lib-core': '>=1.0.0' })
      const workspace = createTestWorkspace(
        [libCore, libApp],
        createMap([
          ['lib-core', [] as readonly string[]],
          ['lib-app', ['lib-core'] as readonly string[]],
        ]),
        createMap([
          ['lib-core', ['lib-app'] as readonly string[]],
          ['lib-app', [] as readonly string[]],
        ])
      )

      let writtenContent = ''
      projectScope.readFileContent.mockImplementation((path: string) => {
        if (path.includes('lib-core')) {
          return '{"name": "lib-core", "version": "1.0.0"}'
        }
        // lib-app has lib-core in both dependencies and peerDependencies
        return '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}, "peerDependencies": {"lib-core": ">=1.0.0"}}'
      })
      projectScope.writeFileContent.mockImplementation((path: string, content: string) => {
        if (path.includes('lib-app')) {
          writtenContent = content
        }
      })

      const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
      applyBumps(workspace, bumps, { dryRun: false, updateDependencyReferences: true })

      // Both dependency types should be updated with their respective prefixes preserved
      expect(writtenContent).toContain('"lib-core": "^1.1.0"')
      expect(writtenContent).toContain('"lib-core": ">=1.1.0"')
    })
  })
})

describe('updatePackageVersionInTree', () => {
  function createMockTree(files: Record<string, string | null>): Tree {
    const writtenFiles: Record<string, string> = {}

    return {
      read: (path: string, encoding?: string) => {
        const content = files[path]
        if (content === null || content === undefined) return null
        return encoding ? content : Buffer.from(content)
      },
      write: (path: string, content: string) => {
        writtenFiles[path] = content
      },
      exists: (path: string) => path in files && files[path] !== null,
      delete: jest.fn(),
      rename: jest.fn(),
      isFile: (path: string) => path in files && files[path] !== null,
      children: jest.fn().mockReturnValue([]),
      listChanges: jest.fn().mockReturnValue([]),
      changePermissions: jest.fn(),
      root: '/workspace',
      _getWrittenFiles: () => writtenFiles,
    } as unknown as Tree & { _getWrittenFiles: () => Record<string, string> }
  }

  it('updates version in package.json', () => {
    const files = {
      'packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    }
    const tree = createMockTree(files) as Tree & { _getWrittenFiles: () => Record<string, string> }

    updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')

    const written = tree._getWrittenFiles()
    const content = JSON.parse(written['packages/lib-a/package.json'])
    expect(content.version).toBe('2.0.0')
  })

  it('preserves other package.json fields', () => {
    const files = {
      'packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0", "description": "Test", "main": "index.js"}',
    }
    const tree = createMockTree(files) as Tree & { _getWrittenFiles: () => Record<string, string> }

    updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')

    const written = tree._getWrittenFiles()
    const content = JSON.parse(written['packages/lib-a/package.json'])
    expect(content.name).toBe('lib-a')
    expect(content.description).toBe('Test')
    expect(content.main).toBe('index.js')
    expect(content.version).toBe('2.0.0')
  })

  it('throws error when file does not exist', () => {
    const files = {}
    const tree = createMockTree(files)

    expect(() => updatePackageVersionInTree(tree, 'nonexistent/package.json', '2.0.0')).toThrow('Could not read nonexistent/package.json')
  })

  it('throws error when file content is null', () => {
    const files = {
      'packages/lib-a/package.json': null,
    }
    const tree = createMockTree(files)

    expect(() => updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')).toThrow(
      'Could not read packages/lib-a/package.json'
    )
  })

  it('formats output with 2-space indentation and trailing newline', () => {
    const files = {
      'packages/lib-a/package.json': '{"name":"lib-a","version":"1.0.0"}',
    }
    const tree = createMockTree(files) as Tree & { _getWrittenFiles: () => Record<string, string> }

    updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')

    const written = tree._getWrittenFiles()
    const content = written['packages/lib-a/package.json']
    expect(content).toMatch(/^\{\n {2}"name"/) // 2-space indentation
    expect(content).toMatch(/\n$/) // trailing newline
  })
})

describe('summarizeBatchUpdate', () => {
  it('shows success message when all updates succeed', () => {
    const result = {
      updated: [
        { name: 'lib-a', packageJsonPath: '/workspace/lib-a/package.json', previousVersion: '1.0.0', newVersion: '1.1.0' },
        { name: 'lib-b', packageJsonPath: '/workspace/lib-b/package.json', previousVersion: '2.0.0', newVersion: '2.1.0' },
      ],
      failed: [],
      total: 2,
      success: true,
    }

    const summary = summarizeBatchUpdate(result)

    expect(summary).toContain('Successfully updated 2 package(s)')
    expect(summary).toContain('lib-a: 1.0.0 -> 1.1.0')
    expect(summary).toContain('lib-b: 2.0.0 -> 2.1.0')
  })

  it('shows failure information when some updates fail', () => {
    const result = {
      updated: [{ name: 'lib-a', packageJsonPath: '/workspace/lib-a/package.json', previousVersion: '1.0.0', newVersion: '1.1.0' }],
      failed: [{ name: 'lib-b', packageJsonPath: '/workspace/lib-b/package.json', error: 'File not found' }],
      total: 2,
      success: false,
    }

    const summary = summarizeBatchUpdate(result)

    expect(summary).toContain('Updated 1/2 package(s)')
    expect(summary).toContain('Failed: 1 package(s)')
    expect(summary).toContain('lib-a: 1.0.0 -> 1.1.0')
    expect(summary).toContain('lib-b: File not found')
  })

  it('handles empty results', () => {
    const result = {
      updated: [],
      failed: [],
      total: 0,
      success: true,
    }

    const summary = summarizeBatchUpdate(result)

    expect(summary).toContain('Successfully updated 0 package(s)')
    expect(summary).not.toContain('Updated packages:')
    expect(summary).not.toContain('Failed packages:')
  })

  it('handles all failed results', () => {
    const result = {
      updated: [],
      failed: [
        { name: 'lib-a', packageJsonPath: '/workspace/lib-a/package.json', error: 'Error 1' },
        { name: 'lib-b', packageJsonPath: '/workspace/lib-b/package.json', error: 'Error 2' },
      ],
      total: 2,
      success: false,
    }

    const summary = summarizeBatchUpdate(result)

    expect(summary).toContain('Updated 0/2 package(s)')
    expect(summary).toContain('Failed: 2 package(s)')
    expect(summary).toContain('lib-a: Error 1')
    expect(summary).toContain('lib-b: Error 2')
    expect(summary).not.toContain('Updated packages:')
  })
})
