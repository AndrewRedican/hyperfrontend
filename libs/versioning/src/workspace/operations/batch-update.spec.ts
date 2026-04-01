import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import type { PlannedBump } from './cascade-bump'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createProject } from '../models/project'
import { createWorkspace, DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import {
  applyBumps,
  DEFAULT_BATCH_UPDATE_OPTIONS,
  summarizeBatchUpdate,
  updatePackageVersionInTree,
  updateDependencyReferencesInTree,
} from './batch-update'

/**
 * Creates a mock Tree for testing VFS operations.
 *
 * @param files - A record of file paths to their content (string or null for non-existent)
 * @returns A mock Tree instance with read/write capabilities
 */
function createMockTree(files: Record<string, string | null>): Tree & { _getWrittenFiles: () => Record<string, string> } {
  const writtenFiles: Record<string, string> = {}

  const tree = {
    read: (path: string, encoding?: string) => {
      if (writtenFiles[path]) {
        return encoding ? writtenFiles[path] : Buffer.from(writtenFiles[path])
      }
      const content = files[path]
      if (content === null || content === undefined) return null
      return encoding ? content : Buffer.from(content)
    },
    write: (path: string, content: string | Buffer) => {
      writtenFiles[path] = typeof content === 'string' ? content : content.toString()
    },
    exists: (path: string) => (path in files && files[path] !== null) || path in writtenFiles,
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: (path: string) => (path in files && files[path] !== null) || path in writtenFiles,
    children: jest.fn().mockReturnValue([]),
    listChanges: jest.fn().mockReturnValue([]),
    changePermissions: jest.fn(),
    changeFile: (path: string, transform: (content: Buffer) => Buffer) => {
      const content = tree.read(path, undefined)
      if (content === null) {
        throw new Error(`File not found: ${path}`)
      }
      const buffer = typeof content === 'string' ? Buffer.from(content) : content
      const result = transform(buffer)
      tree.write(path, result)
    },
    root: '/workspace',
    _getWrittenFiles: () => writtenFiles,
  }

  return tree as unknown as Tree & { _getWrittenFiles: () => Record<string, string> }
}

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

  it('updates package version in tree', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps)

    expect(result.updated).toHaveLength(1)
    expect(result.updated[0].name).toBe('lib-a')
    expect(result.updated[0].previousVersion).toBe('1.0.0')
    expect(result.updated[0].newVersion).toBe('1.1.0')
    expect(result.success).toBe(true)

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-a/package.json']).toContain('"version": "1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
      '/workspace/packages/lib-b/package.json': '{"name": "lib-b", "version": "2.0.0"}',
      '/workspace/packages/lib-c/package.json': '{"name": "lib-c", "version": "3.0.0"}',
    })

    const bumps = [
      createPlannedBump('lib-a', '1.0.0', '1.1.0'),
      createPlannedBump('lib-b', '2.0.0', '2.0.1', 'patch'),
      createPlannedBump('lib-c', '3.0.0', '4.0.0', 'major'),
    ]
    const result = applyBumps(tree, workspace, bumps)

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

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0'), createPlannedBump('nonexistent', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps)

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

    const tree = createMockTree({})

    const result = applyBumps(tree, workspace, [])

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

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
      '/workspace/packages/lib-b/package.json': '{"name": "lib-b", "version": "2.0.0"}',
    })

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0'), createPlannedBump('lib-b', '2.0.0', '2.1.0')]
    const result = applyBumps(tree, workspace, bumps)

    expect(result.total).toBe(2)
  })

  it('handles prerelease bumps', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

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
    const result = applyBumps(tree, workspace, bumps)

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

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps)

    expect(result.updated[0].packageJsonPath).toBe('/workspace/packages/lib-a/package.json')
  })

  it('reports success as false when any update fails', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0'), createPlannedBump('missing-pkg', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps)

    expect(result.success).toBe(false)
    expect(result.failed.length).toBeGreaterThan(0)
  })

  it('writes version update to tree', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const tree = createMockTree({
      '/workspace/packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps)

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-a/package.json']).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.updated).toHaveLength(1)
  })

  it('handles file read errors gracefully', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const tree = createMockTree({})

    const bumps = [createPlannedBump('lib-a', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps)

    expect(result.success).toBe(false)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].error).toContain('File not found')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    expect(result.success).toBe(true)
    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
  })

  it('skips dependency reference updates when updateDependencyReferences is false', () => {
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: false })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-core/package.json']).toContain('"version": "1.1.0"')
    expect(written['/workspace/packages/lib-app/package.json']).toBeUndefined()
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': 'invalid json {{{',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    const result = applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "~1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "~1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": ">=1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": ">=1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": ">1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": ">1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "<=1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "<=1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "<2.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "<1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "=1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "=1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "devDependencies": {"lib-core": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "peerDependencies": {"lib-core": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "optionalDependencies": {"lib-core": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0", "dependencies": {"other-lib": "^1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-core/package.json']).toBeDefined()
    expect(written['/workspace/packages/lib-app/package.json']).toBeUndefined()
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json': '{"name": "lib-app", "version": "2.0.0"}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-core/package.json']).toBeDefined()
    expect(written['/workspace/packages/lib-app/package.json']).toBeUndefined()
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

    const tree = createMockTree({
      '/workspace/packages/lib-core/package.json': '{"name": "lib-core", "version": "1.0.0"}',
      '/workspace/packages/lib-app/package.json':
        '{"name": "lib-app", "version": "2.0.0", "dependencies": {"lib-core": "^1.0.0"}, "peerDependencies": {"lib-core": ">=1.0.0"}}',
    })

    const bumps = [createPlannedBump('lib-core', '1.0.0', '1.1.0')]
    applyBumps(tree, workspace, bumps, { updateDependencyReferences: true })

    const written = tree._getWrittenFiles()
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
    expect(written['/workspace/packages/lib-app/package.json']).toContain('"lib-core": ">=1.1.0"')
  })
})

describe('updatePackageVersionInTree', () => {
  it('updates version in package.json', () => {
    const tree = createMockTree({
      'packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0"}',
    })

    updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')

    const written = tree._getWrittenFiles()
    const content = JSON.parse(written['packages/lib-a/package.json'])
    expect(content.version).toBe('2.0.0')
  })

  it('preserves other package.json fields', () => {
    const tree = createMockTree({
      'packages/lib-a/package.json': '{"name": "lib-a", "version": "1.0.0", "description": "Test", "main": "index.js"}',
    })

    updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')

    const written = tree._getWrittenFiles()
    const content = JSON.parse(written['packages/lib-a/package.json'])
    expect(content.name).toBe('lib-a')
    expect(content.description).toBe('Test')
    expect(content.main).toBe('index.js')
    expect(content.version).toBe('2.0.0')
  })

  it('throws error when file does not exist', () => {
    const tree = createMockTree({})

    expect(() => updatePackageVersionInTree(tree, 'nonexistent/package.json', '2.0.0')).toThrow('File not found: nonexistent/package.json')
  })

  it('throws error when file content is null', () => {
    const tree = createMockTree({
      'packages/lib-a/package.json': null,
    })

    expect(() => updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')).toThrow(
      'File not found: packages/lib-a/package.json'
    )
  })

  it('formats output with 2-space indentation and trailing newline', () => {
    const tree = createMockTree({
      'packages/lib-a/package.json': '{"name":"lib-a","version":"1.0.0"}',
    })

    updatePackageVersionInTree(tree, 'packages/lib-a/package.json', '2.0.0')

    const written = tree._getWrittenFiles()
    const content = written['packages/lib-a/package.json']
    expect(content).toMatch(/^\{\n {2}"name"/)
    expect(content).toMatch(/\n$/)
  })
})

describe('updateDependencyReferencesInTree', () => {
  it('updates dependency version with caret prefix', () => {
    const tree = createMockTree({
      'packages/lib-app/package.json': '{"name": "lib-app", "version": "1.0.0", "dependencies": {"lib-core": "^1.0.0"}}',
    })

    const versionUpdates = createMap([['lib-core', '1.1.0']])
    updateDependencyReferencesInTree(tree, 'packages/lib-app/package.json', versionUpdates)

    const written = tree._getWrittenFiles()
    expect(written['packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
  })

  it('does not write when file does not exist', () => {
    const tree = createMockTree({})

    const versionUpdates = createMap([['lib-core', '1.1.0']])
    updateDependencyReferencesInTree(tree, 'nonexistent/package.json', versionUpdates)

    const written = tree._getWrittenFiles()
    expect(Object.keys(written)).toHaveLength(0)
  })

  it('does not write when no matching dependencies found', () => {
    const tree = createMockTree({
      'packages/lib-app/package.json': '{"name": "lib-app", "version": "1.0.0", "dependencies": {"other-lib": "^1.0.0"}}',
    })

    const versionUpdates = createMap([['lib-core', '1.1.0']])
    updateDependencyReferencesInTree(tree, 'packages/lib-app/package.json', versionUpdates)

    const written = tree._getWrittenFiles()
    expect(written['packages/lib-app/package.json']).toBeUndefined()
  })

  it('updates multiple dependency types', () => {
    const tree = createMockTree({
      'packages/lib-app/package.json':
        '{"name": "lib-app", "version": "1.0.0", "dependencies": {"lib-core": "^1.0.0"}, "devDependencies": {"lib-core": "~1.0.0"}}',
    })

    const versionUpdates = createMap([['lib-core', '1.1.0']])
    updateDependencyReferencesInTree(tree, 'packages/lib-app/package.json', versionUpdates)

    const written = tree._getWrittenFiles()
    expect(written['packages/lib-app/package.json']).toContain('"lib-core": "^1.1.0"')
    expect(written['packages/lib-app/package.json']).toContain('"lib-core": "~1.1.0"')
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
