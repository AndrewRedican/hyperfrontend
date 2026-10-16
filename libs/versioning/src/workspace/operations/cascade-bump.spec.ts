import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProject } from '../models/project'
import { createWorkspace, DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import { calculateCascadeBumps, calculateCascadeBumpsFromPackage, summarizeCascadeBumps, DEFAULT_CASCADE_OPTIONS } from './cascade-bump'

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

describe('DEFAULT_CASCADE_OPTIONS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CASCADE_OPTIONS).toEqual({
      cascadeBumpType: 'patch',
      includeDevDependencies: false,
      includePeerDependencies: true,
      prereleaseId: 'alpha',
    })
  })
})

describe('calculateCascadeBumps', () => {
  it('calculates direct bumps', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-a', bumpType: 'minor' }])

    expect(result.bumps).toEqual([
      expect.objectContaining({
        name: 'lib-a',
        currentVersion: '1.0.0',
        nextVersion: '1.1.0',
        bumpType: 'minor',
        reason: 'direct',
      }),
    ])
  })

  it('separates the direct bump from the cascade bumps it causes', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })
    const app = createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', ['app'] as readonly string[]],
      ['app', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['app', ['lib-a'] as readonly string[]],
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA, app], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }])

    expect({ directBumpCount: result.directBumps.length, hasCascadeBumps: result.cascadeBumps.length >= 1 }).toEqual({
      directBumpCount: 1,
      hasCascadeBumps: true,
    })
  })

  it('cascades to dependents', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })
    const app = createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', ['app'] as readonly string[]],
      ['app', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['app', ['lib-a'] as readonly string[]],
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA, app], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }])

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toEqual(
      expect.objectContaining({ reason: 'cascade', bumpType: 'patch', triggeredBy: expect.arrayContaining(['lib-core']) })
    )
  })

  it('respects cascadeBumpType option', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'major' }], { cascadeBumpType: 'minor' })

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump?.bumpType).toBe('minor')
  })

  it('does not cascade through dev dependencies by default', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, { 'lib-core': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }])

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toBeUndefined()
  })

  it('cascades through dev dependencies when option enabled', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, { 'lib-core': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }], { includeDevDependencies: true })

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toBeDefined()
  })

  it('cascades through peer dependencies by default', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, {}, { 'lib-core': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }])

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toBeDefined()
  })

  it('skips non-existent packages', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const result = calculateCascadeBumps(workspace, [{ name: 'nonexistent', bumpType: 'minor' }])

    expect(result.bumps).toHaveLength(0)
  })

  it('handles multiple direct bumps', () => {
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

    const result = calculateCascadeBumps(workspace, [
      { name: 'lib-a', bumpType: 'minor' },
      { name: 'lib-b', bumpType: 'patch' },
    ])

    expect(result).toEqual(
      expect.objectContaining({
        directBumps: [expect.objectContaining({ name: 'lib-a' }), expect.objectContaining({ name: 'lib-b' })],
        bumps: expect.arrayContaining([
          expect.objectContaining({ name: 'lib-a', nextVersion: '1.1.0' }),
          expect.objectContaining({ name: 'lib-b', nextVersion: '2.0.1' }),
        ]),
      })
    )
  })

  it('direct bumps take precedence over cascade bumps', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [
      { name: 'lib-core', bumpType: 'minor' },
      { name: 'lib-a', bumpType: 'major' },
    ])

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toEqual(expect.objectContaining({ reason: 'direct', bumpType: 'major' }))
  })

  it('returns sorted bumps', () => {
    const libZ = createTestProject('z-lib', '1.0.0')
    const libA = createTestProject('a-lib', '1.0.0')
    const libM = createTestProject('m-lib', '1.0.0')

    const workspace = createTestWorkspace(
      [libZ, libA, libM],
      createMap([
        ['z-lib', [] as readonly string[]],
        ['a-lib', [] as readonly string[]],
        ['m-lib', [] as readonly string[]],
      ]),
      createMap([
        ['z-lib', [] as readonly string[]],
        ['a-lib', [] as readonly string[]],
        ['m-lib', [] as readonly string[]],
      ])
    )

    const result = calculateCascadeBumps(workspace, [
      { name: 'z-lib', bumpType: 'minor' },
      { name: 'a-lib', bumpType: 'minor' },
      { name: 'm-lib', bumpType: 'minor' },
    ])

    expect(result.bumps).toEqual([
      expect.objectContaining({ name: 'a-lib' }),
      expect.objectContaining({ name: 'm-lib' }),
      expect.objectContaining({ name: 'z-lib' }),
    ])
  })

  it('updates triggeredBy list when multiple packages trigger same dependent', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const libB = createTestProject('lib-b', '1.0.0')
    const app = createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0', 'lib-b': '^1.0.0' })

    const depGraph = createMap([
      ['lib-a', ['app'] as readonly string[]],
      ['lib-b', ['app'] as readonly string[]],
      ['app', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['app', ['lib-a', 'lib-b'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
      ['lib-b', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libA, libB, app], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [
      { name: 'lib-a', bumpType: 'minor' },
      { name: 'lib-b', bumpType: 'minor' },
    ])

    const appBump = result.bumps.find((b) => b.name === 'app')
    expect(appBump?.triggeredBy).toEqual(expect.arrayContaining(['lib-a', 'lib-b']))
  })
})

describe('calculateCascadeBumpsFromPackage', () => {
  it('is a convenience wrapper', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const result = calculateCascadeBumpsFromPackage(workspace, 'lib-a', 'minor')

    expect(result.bumps).toEqual([expect.objectContaining({ name: 'lib-a' })])
  })
})

describe('summarizeCascadeBumps', () => {
  it('summarizes empty result', () => {
    const result = {
      bumps: [],
      directBumps: [],
      cascadeBumps: [],
      totalAffected: 0,
    }

    const summary = summarizeCascadeBumps(result)

    expect(summary).toBe('No packages affected')
  })

  it('summarizes direct bumps', () => {
    const result = {
      bumps: [
        {
          name: 'lib-a',
          currentVersion: '1.0.0',
          nextVersion: '1.1.0',
          bumpType: 'minor' as const,
          reason: 'direct' as const,
          triggeredBy: [],
        },
      ],
      directBumps: [
        {
          name: 'lib-a',
          currentVersion: '1.0.0',
          nextVersion: '1.1.0',
          bumpType: 'minor' as const,
          reason: 'direct' as const,
          triggeredBy: [],
        },
      ],
      cascadeBumps: [],
      totalAffected: 1,
    }

    const summary = summarizeCascadeBumps(result)

    expect(summary).toBe(
      [
        '1 package(s) affected:',
        '  - 1 direct bump(s)',
        '  - 0 cascade bump(s)',
        '',
        'Planned bumps:',
        '  lib-a: 1.0.0 -> 1.1.0 [minor]',
      ].join('\n')
    )
  })

  it('summarizes cascade bumps', () => {
    const result = {
      bumps: [
        {
          name: 'lib-a',
          currentVersion: '1.0.0',
          nextVersion: '1.0.1',
          bumpType: 'patch' as const,
          reason: 'cascade' as const,
          triggeredBy: ['lib-core'],
        },
      ],
      directBumps: [],
      cascadeBumps: [
        {
          name: 'lib-a',
          currentVersion: '1.0.0',
          nextVersion: '1.0.1',
          bumpType: 'patch' as const,
          reason: 'cascade' as const,
          triggeredBy: ['lib-core'],
        },
      ],
      totalAffected: 1,
    }

    const summary = summarizeCascadeBumps(result)

    expect(summary).toBe(
      [
        '1 package(s) affected:',
        '  - 0 direct bump(s)',
        '  - 1 cascade bump(s)',
        '',
        'Planned bumps:',
        '  lib-a: 1.0.0 -> 1.0.1 [patch] (triggered by lib-core)',
      ].join('\n')
    )
  })
})

describe('edge cases', () => {
  it('handles bumpType none', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-a', bumpType: 'none' }])

    expect(result.bumps).toEqual([expect.objectContaining({ nextVersion: '1.0.0' })])
  })

  it('skips cascade when project not found in shouldCascade', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, {}, {})

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }])

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toBeUndefined()
  })

  it('does not cascade through peer deps when option disabled', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, {}, { 'lib-core': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }], { includePeerDependencies: false })

    const libABump = result.bumps.find((b) => b.name === 'lib-a')
    expect(libABump).toBeUndefined()
  })

  it('skips already processed packages in queue', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })
    const libB = createTestProject('lib-b', '1.0.0', { 'lib-core': '^1.0.0' })
    const app = createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0', 'lib-b': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a', 'lib-b'] as readonly string[]],
      ['lib-a', ['app'] as readonly string[]],
      ['lib-b', ['app'] as readonly string[]],
      ['app', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['app', ['lib-a', 'lib-b'] as readonly string[]],
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-b', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA, libB, app], depGraph, reverseDepGraph)

    const result = calculateCascadeBumps(workspace, [{ name: 'lib-core', bumpType: 'minor' }])

    const appBumps = result.bumps.filter((b) => b.name === 'app')
    expect(appBumps).toEqual([expect.objectContaining({ triggeredBy: expect.arrayContaining(['lib-a', 'lib-b']) })])
  })
})
