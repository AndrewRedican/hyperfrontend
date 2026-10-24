import type { ProjectRecord } from '../../../graph/model.ts'
import { existsSync, rmSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { buildGraph } from '../../../graph/build.ts'
import { createDependencyWorkspace } from '../__test-utils__/dependency-workspace.ts'
import { inputFiles, installedVersion, selfInputs, usedPackages } from './dependencies.ts'

const root = createDependencyWorkspace()
const graph = buildGraph(root)
const lib = graph.projects.get('lib') as ProjectRecord

/**
 * A project with the given build inputs and files.
 *
 * @param inputs - The build target's inputs, or undefined for none
 * @param namedInputs - The project's named inputs
 * @returns The project record
 */
function withInputs(inputs: readonly unknown[] | undefined, namedInputs?: Readonly<Record<string, readonly unknown[]>>): ProjectRecord {
  return {
    ...lib,
    files: ['libs/lib/a.ts', 'libs/lib/b.spec.ts', 'libs/lib/c/d.ts'],
    configuration: {
      name: 'lib',
      targets: { build: inputs === undefined ? {} : { inputs } },
      ...(namedInputs === undefined ? {} : { namedInputs }),
    },
  }
}

describe('selfInputs', () => {
  it('reads the target defaults, leaving out the dependencies and other projects', () => {
    expect(selfInputs(root, lib, 'build')).toEqual(['{projectRoot}/**/*', '{workspaceRoot}/patches/**'])
  })

  it('expands the project named inputs and object inputs', () => {
    const project = withInputs(
      [
        'own',
        { input: 'own', projects: 'self' },
        { fileset: '{projectRoot}/x' },
        { fileset: '{projectRoot}/y', dependencies: true },
        { input: 'own', dependencies: true },
        { env: 'X' },
        { input: 'undefined-name' },
        'missing-name',
      ],
      { own: ['{projectRoot}/c/**'] }
    )
    expect(selfInputs(root, project, 'build')).toEqual(['{projectRoot}/c/**', '{projectRoot}/c/**', '{projectRoot}/x', 'missing-name'])
  })

  it('falls back to the default input without nx.json', () => {
    const bare = createDependencyWorkspace()
    rmSync(`${bare}/nx.json`)
    const patterns = selfInputs(bare, withInputs(undefined), 'build')
    rmSync(bare, { recursive: true, force: true })
    expect(patterns).toEqual(['{projectRoot}/**/*'])
  })
})

describe('inputFiles', () => {
  it('keeps every file for the default pattern alone', () => {
    expect(inputFiles(withInputs([]), ['{projectRoot}/**/*'], [])).toEqual(['libs/lib/a.ts', 'libs/lib/b.spec.ts', 'libs/lib/c/d.ts'])
  })

  it('keeps every file without patterns', () => {
    expect(inputFiles(withInputs([]), [], []).length).toBe(3)
  })

  it('matches positive patterns and drops negated and ignored ones', () => {
    expect(
      inputFiles(withInputs([]), ['./{projectRoot}/**/*.ts', '!./{projectRoot}/**/*.spec.ts', '{workspaceRoot}/x'], ['{projectRoot}/c/**'])
    ).toEqual(['libs/lib/a.ts'])
  })
})

describe('installedVersion', () => {
  it('answers the nearest install the lock file records below a package', () => {
    expect(installedVersion(graph, 'libs/lib/src/nested/use.ts', 'inner')).toBe('0.0.1')
  })

  it('answers the top-level version for an install the lock file does not record', () => {
    expect(installedVersion(graph, 'libs/lib/src/nested/use.ts', 'hoisted')).toBe('2.0.0')
  })

  it('answers null for an install without a version or lock entry', () => {
    expect(installedVersion(graph, 'libs/lib/src/nested/use.ts', 'versionless')).toBe(null)
  })

  it('answers the top-level version from the workspace root', () => {
    expect(installedVersion(graph, 'root-file.ts', 'left-pad')).toBe('1.3.0')
  })
})

describe('usedPackages', () => {
  it('collects the npm and buildable workspace packages the files import', () => {
    expect([...usedPackages(graph, lib, [...lib.files, 'libs/lib/package.json'])]).toEqual([
      ['@ws/dep', '2.0.0'],
      ['left-pad', '1.3.0'],
      ['inner', '0.0.1'],
      ['hoisted', '2.0.0'],
    ])
  })

  it('gives a workspace package without a version the wildcard', () => {
    const user = graph.projects.get('user') as ProjectRecord
    expect([...usedPackages(graph, user, user.files)]).toEqual([['@ws/unversioned', '*']])
  })

  it('counts imports of the root project from the root project', () => {
    const rootProject = graph.projects.get('root') as ProjectRecord
    expect(usedPackages(graph, rootProject, ['libs/lib/src/dep-user.ts']).get('@ws/dep')).toBe('2.0.0')
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
