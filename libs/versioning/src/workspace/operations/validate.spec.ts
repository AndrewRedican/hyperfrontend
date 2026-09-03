import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProject } from '../models/project'
import { createWorkspace, DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import { validateWorkspace, validateProject, summarizeValidation } from './validate'

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

describe('validateWorkspace', () => {
  it('validates valid workspace', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const libB = createTestProject('lib-b', '1.0.0')

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

    const report = validateWorkspace(workspace)

    expect(report.valid).toBe(true)
    expect(report.errorCount).toBe(0)
  })

  it('detects invalid version', () => {
    const invalidProject = createTestProject('lib-invalid', 'bad-version')

    const workspace = createTestWorkspace(
      [invalidProject],
      createMap([['lib-invalid', [] as readonly string[]]]),
      createMap([['lib-invalid', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    expect(report.valid).toBe(false)
    expect(report.errorCount).toBeGreaterThan(0)
    expect(report.invalidPackages).toContain('lib-invalid')
  })

  it('detects missing package name', () => {
    const project = createProject({
      name: '',
      version: '1.0.0',
      path: '/workspace/packages/unnamed',
      packageJsonPath: '/workspace/packages/unnamed/package.json',
      packageJson: { name: '', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace([project], createMap([['', [] as readonly string[]]]), createMap([['', [] as readonly string[]]]))

    const report = validateWorkspace(workspace)

    expect(report.valid).toBe(false)
    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && !r.result.valid)
    expect(nameCheck).toBeDefined()
  })

  it('detects circular dependencies', () => {
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0' })
    const libB = createTestProject('lib-b', '1.0.0', { 'lib-a': '^1.0.0' })

    const depGraph = createMap([
      ['lib-a', ['lib-b'] as readonly string[]],
      ['lib-b', ['lib-a'] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['lib-b', ['lib-a'] as readonly string[]],
      ['lib-a', ['lib-b'] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libA, libB], depGraph, reverseDepGraph)

    const report = validateWorkspace(workspace)

    const circularCheck = report.results.find((r) => r.checkId === 'no-circular-dependencies')
    expect(circularCheck).toBeDefined()
    expect(circularCheck?.result.valid).toBe(false)
  })

  it('validates all projects', () => {
    const validProject = createTestProject('lib-valid', '1.0.0')
    const invalidProject = createTestProject('lib-invalid', 'bad-version')

    const workspace = createTestWorkspace(
      [validProject, invalidProject],
      createMap([
        ['lib-valid', [] as readonly string[]],
        ['lib-invalid', [] as readonly string[]],
      ]),
      createMap([
        ['lib-valid', [] as readonly string[]],
        ['lib-invalid', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    expect(report.valid).toBe(false)
    expect(report.errorCount).toBeGreaterThan(0)
    expect(report.invalidPackages).toContain('lib-invalid')
    expect(report.invalidPackages).not.toContain('lib-valid')
  })

  it('provides issue counts', () => {
    const validProject = createTestProject('lib-valid', '1.0.0')
    const workspace = createTestWorkspace(
      [validProject],
      createMap([['lib-valid', [] as readonly string[]]]),
      createMap([['lib-valid', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    expect(typeof report.errorCount).toBe('number')
    expect(typeof report.warningCount).toBe('number')
    expect(report.errorCount).toBe(0)
  })

  it('includes check details', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    expect(report.results.length).toBeGreaterThan(0)
    for (const result of report.results) {
      expect(result.checkId).toBeDefined()
      expect(result.checkName).toBeDefined()
      expect(result.result).toBeDefined()
      expect(typeof result.result.valid).toBe('boolean')
    }
  })

  it('includes package name in check results', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const packageChecks = report.results.filter((r) => r.packageName !== null)
    expect(packageChecks.length).toBeGreaterThan(0)
    expect(packageChecks.some((r) => r.packageName === 'lib-a')).toBe(true)
  })

  it('includes workspace-level checks', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const workspaceChecks = report.results.filter((r) => r.packageName === null)
    expect(workspaceChecks.length).toBeGreaterThan(0)
  })

  it('detects empty workspace', () => {
    const workspace = createTestWorkspace([], createMap([]), createMap([]))

    const report = validateWorkspace(workspace)

    const projectCheck = report.results.find((r) => r.checkId === 'workspace-has-projects')
    expect(projectCheck).toBeDefined()
    expect(projectCheck?.result.valid).toBe(false)
  })

  it('returns invalid packages list', () => {
    const invalidProject = createTestProject('lib-bad', 'not-semver')

    const workspace = createTestWorkspace(
      [invalidProject],
      createMap([['lib-bad', [] as readonly string[]]]),
      createMap([['lib-bad', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    expect(Array.isArray(report.invalidPackages)).toBe(true)
    expect(report.invalidPackages).toContain('lib-bad')
  })

  it('validates dependency versions', () => {
    const libCore = createTestProject('lib-core', '2.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    const depCheck = report.results.find((r) => r.checkId === 'dependency-versions' && r.packageName === 'lib-a')
    expect(depCheck).toBeDefined()
  })

  it('validates devDependencies versions', () => {
    const libCore = createTestProject('lib-core', '2.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, { 'lib-core': '^1.0.0' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    const depCheck = report.results.find((r) => r.checkId === 'dependency-versions' && r.packageName === 'lib-a')
    expect(depCheck?.result.warning).toContain('lib-core')
  })

  it('validates peerDependencies versions', () => {
    const libCore = createTestProject('lib-core', '2.0.0')
    const libA = createTestProject('lib-a', '1.0.0', {}, {}, { 'lib-core': '^1.0.0' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    const depCheck = report.results.find((r) => r.checkId === 'dependency-versions' && r.packageName === 'lib-a')
    expect(depCheck?.result.warning).toContain('lib-core')
  })

  it('skips workspace protocol versions', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': 'workspace:*' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    const depCheck = report.results.find((r) => r.checkId === 'dependency-versions' && r.packageName === 'lib-a')
    expect(depCheck?.result.valid).toBe(true)
    expect(depCheck?.result.warning).toBeUndefined()
  })

  it('skips star version ranges', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '*' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    const depCheck = report.results.find((r) => r.checkId === 'dependency-versions' && r.packageName === 'lib-a')
    expect(depCheck?.result.valid).toBe(true)
  })

  it('skips link: protocol versions', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': 'link:' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    const depCheck = report.results.find((r) => r.checkId === 'dependency-versions' && r.packageName === 'lib-a')
    expect(depCheck?.result.valid).toBe(true)
  })

  it('detects invalid scoped package name format', () => {
    const project = createProject({
      name: '@scope',
      version: '1.0.0',
      path: '/workspace/packages/scoped',
      packageJsonPath: '/workspace/packages/scoped/package.json',
      packageJson: { name: '@scope', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope', [] as readonly string[]]]),
      createMap([['@scope', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('validates valid scoped package names', () => {
    const project = createProject({
      name: '@scope/package',
      version: '1.0.0',
      path: '/workspace/packages/scoped',
      packageJsonPath: '/workspace/packages/scoped/package.json',
      packageJson: { name: '@scope/package', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope/package', [] as readonly string[]]]),
      createMap([['@scope/package', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope/package')
    expect(nameCheck?.result.valid).toBe(true)
  })

  it('detects invalid characters in package name', () => {
    const project = createProject({
      name: 'UPPERCASE',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: 'UPPERCASE', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['UPPERCASE', [] as readonly string[]]]),
      createMap([['UPPERCASE', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === 'UPPERCASE')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects package name exceeding 214 characters', () => {
    const longName = 'a'.repeat(215)
    const project = createProject({
      name: longName,
      version: '1.0.0',
      path: '/workspace/packages/longname',
      packageJsonPath: '/workspace/packages/longname/package.json',
      packageJson: { name: longName, version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([[longName, [] as readonly string[]]]),
      createMap([[longName, [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === longName)
    expect(nameCheck?.result.valid).toBe(false)
    expect(nameCheck?.result.error).toContain('214')
  })

  it('detects scoped package with empty scope', () => {
    const project = createProject({
      name: '@/package',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '@/package', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@/package', [] as readonly string[]]]),
      createMap([['@/package', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@/package')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects scoped package with empty name after slash', () => {
    const project = createProject({
      name: '@scope/',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '@scope/', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope/', [] as readonly string[]]]),
      createMap([['@scope/', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope/')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects invalid first character in package name', () => {
    const project = createProject({
      name: '-invalid',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '-invalid', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['-invalid', [] as readonly string[]]]),
      createMap([['-invalid', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '-invalid')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects invalid first character in scoped package name', () => {
    const project = createProject({
      name: '@-scope/package',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '@-scope/package', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@-scope/package', [] as readonly string[]]]),
      createMap([['@-scope/package', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@-scope/package')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects invalid character in scoped package scope', () => {
    const project = createProject({
      name: '@scope!/package',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '@scope!/package', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope!/package', [] as readonly string[]]]),
      createMap([['@scope!/package', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope!/package')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects invalid first character in scoped package name part', () => {
    const project = createProject({
      name: '@scope/-package',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '@scope/-package', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope/-package', [] as readonly string[]]]),
      createMap([['@scope/-package', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope/-package')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('detects invalid character in scoped package name part', () => {
    const project = createProject({
      name: '@scope/pack!age',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '@scope/pack!age', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope/pack!age', [] as readonly string[]]]),
      createMap([['@scope/pack!age', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)

    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope/pack!age')
    expect(nameCheck?.result.valid).toBe(false)
  })
})

describe('validateProject', () => {
  it('returns valid for valid project', () => {
    const project = createTestProject('my-package', '1.0.0')
    const result = validateProject(project)
    expect(result.valid).toBe(true)
  })

  it('returns error for invalid version', () => {
    const project = createTestProject('my-package', 'bad-version')
    const result = validateProject(project)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('semver')
  })

  it('returns error for invalid name', () => {
    const project = createProject({
      name: '',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: '', version: '1.0.0' },
      internalDependencies: [],
    })
    const result = validateProject(project)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('required')
  })
})

describe('summarizeValidation', () => {
  it('summarizes valid workspace', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const workspace = createTestWorkspace(
      [libA],
      createMap([['lib-a', [] as readonly string[]]]),
      createMap([['lib-a', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)
    const summary = summarizeValidation(report)

    expect(summary).toContain('passed')
  })

  it('summarizes invalid workspace with errors', () => {
    const invalidProject = createTestProject('lib-bad', 'invalid')
    const workspace = createTestWorkspace(
      [invalidProject],
      createMap([['lib-bad', [] as readonly string[]]]),
      createMap([['lib-bad', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)
    const summary = summarizeValidation(report)

    expect(summary).toContain('failed')
    expect(summary).toContain('error')
    expect(summary).toContain('lib-bad')
  })

  it('summarizes workspace with warnings', () => {
    const libCore = createTestProject('lib-core', '2.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)
    const summary = summarizeValidation(report)

    expect(summary).toContain('warning')
  })

  it('includes warning count for valid workspace with warnings', () => {
    const libCore = createTestProject('lib-core', '2.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)
    const summary = summarizeValidation(report)

    expect(summary).toContain('passed')
    expect(summary).toContain('warning')
  })
})

describe('edge cases', () => {
  it('handles deep dependency chain without cycles', () => {
    const projects = [
      createTestProject('pkg-e', '1.0.0'),
      createTestProject('pkg-d', '1.0.0', { 'pkg-e': '^1.0.0' }),
      createTestProject('pkg-c', '1.0.0', { 'pkg-d': '^1.0.0' }),
      createTestProject('pkg-b', '1.0.0', { 'pkg-c': '^1.0.0' }),
      createTestProject('pkg-a', '1.0.0', { 'pkg-b': '^1.0.0' }),
    ]

    const depGraph = createMap([
      ['pkg-e', ['pkg-d'] as readonly string[]],
      ['pkg-d', ['pkg-c'] as readonly string[]],
      ['pkg-c', ['pkg-b'] as readonly string[]],
      ['pkg-b', ['pkg-a'] as readonly string[]],
      ['pkg-a', [] as readonly string[]],
    ])

    const reverseDepGraph = createMap([
      ['pkg-a', ['pkg-b'] as readonly string[]],
      ['pkg-b', ['pkg-c'] as readonly string[]],
      ['pkg-c', ['pkg-d'] as readonly string[]],
      ['pkg-d', ['pkg-e'] as readonly string[]],
      ['pkg-e', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace(projects, depGraph, reverseDepGraph)
    const report = validateWorkspace(workspace)

    const circularCheck = report.results.find((r) => r.checkId === 'no-circular-dependencies')
    expect(circularCheck?.result.valid).toBe(true)
  })

  it('handles unscoped package with valid hyphen in middle', () => {
    const project = createProject({
      name: 'my-valid-package',
      version: '1.0.0',
      path: '/workspace/packages/valid',
      packageJsonPath: '/workspace/packages/valid/package.json',
      packageJson: { name: 'my-valid-package', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['my-valid-package', [] as readonly string[]]]),
      createMap([['my-valid-package', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)
    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === 'my-valid-package')
    expect(nameCheck?.result.valid).toBe(true)
  })

  it('validates invalid characters in unscoped package', () => {
    const project = createProject({
      name: 'pack!age',
      version: '1.0.0',
      path: '/workspace/packages/bad',
      packageJsonPath: '/workspace/packages/bad/package.json',
      packageJson: { name: 'pack!age', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['pack!age', [] as readonly string[]]]),
      createMap([['pack!age', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)
    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === 'pack!age')
    expect(nameCheck?.result.valid).toBe(false)
  })

  it('handles dependency with invalid version format', () => {
    const libCore = createTestProject('lib-core', 'not-a-semver')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })

    const workspace = createTestWorkspace(
      [libCore, libA],
      createMap([
        ['lib-core', ['lib-a'] as readonly string[]],
        ['lib-a', [] as readonly string[]],
      ]),
      createMap([
        ['lib-a', ['lib-core'] as readonly string[]],
        ['lib-core', [] as readonly string[]],
      ])
    )

    const report = validateWorkspace(workspace)

    expect(report.invalidPackages).toContain('lib-core')
  })

  it('handles scoped package with numbers in scope', () => {
    const project = createProject({
      name: '@scope123/package456',
      version: '1.0.0',
      path: '/workspace/packages/valid',
      packageJsonPath: '/workspace/packages/valid/package.json',
      packageJson: { name: '@scope123/package456', version: '1.0.0' },
      internalDependencies: [],
    })

    const workspace = createTestWorkspace(
      [project],
      createMap([['@scope123/package456', [] as readonly string[]]]),
      createMap([['@scope123/package456', [] as readonly string[]]])
    )

    const report = validateWorkspace(workspace)
    const nameCheck = report.results.find((r) => r.checkId === 'valid-name' && r.packageName === '@scope123/package456')
    expect(nameCheck?.result.valid).toBe(true)
  })
})
