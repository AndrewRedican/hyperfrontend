import type { Edge, ProjectRecord } from './model'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { buildGraph, workspaceGraph } from './build'
import { fileEdge } from './file-edges'

const root = createGraphWorkspace()
const graph = workspaceGraph(root)

/**
 * One line describing a qualified edge.
 *
 * @param edge - The edge described
 * @returns Its target, kind, role, specifier, resolution, targets and evidence, space-separated
 */
function describeEdge(edge: Edge): string {
  const position = edge.evidence.kind === 'source' ? `${edge.evidence.line}:${edge.evidence.column}` : edge.evidence.key
  const path = edge.path === null ? '-' : `${edge.path.specifier}=${edge.path.resolved ?? '-'}`
  return `${edge.target} ${edge.kind} ${edge.role} ${path} [${edge.targets.join(',')}] ${edge.evidence.file} ${position}`
}

/**
 * The qualified edges drawn from a node, described.
 *
 * @param source - The node id
 * @returns One line per edge, in canonical order
 */
function from(source: string): string[] {
  return graph.records.filter((edge) => edge.source === source).map(describeEdge)
}

describe('the file edges', () => {
  it('draw a dynamic import to an entry, side-effect imports to files, and an unresolved re-export', () => {
    expect(from('file:apps/app/src/main.ts')).toEqual([
      'entry:@fixture/a dynamic production @fixture/a=libs/a/src/index.ts [] apps/app/src/main.ts 2:17',
      'file:apps/app/src/nothing unresolved production ./nothing=- [] apps/app/src/main.ts 4:1',
      'file:libs/a/src/deep.ts side-effect production @fixture/a/deep=libs/a/src/deep.ts [] apps/app/src/main.ts 1:1',
      'file:lint.config.ts side-effect production ../../../lint.config=lint.config.ts [] apps/app/src/main.ts 3:1',
      'project:@fixture/app unresolved production name=- [] apps/app/src/main.ts 5:29',
    ])
  })

  it('draw a file the parser cannot read to its own project, unresolved, without a specifier', () => {
    expect(from('file:apps/app/src/broken.ts')).toEqual(['project:@fixture/app unresolved production - [] apps/app/src/broken.ts 1:1'])
  })

  it('draw imports of installed and missing packages to externals, and none to a built-in', () => {
    expect(from('file:libs/a/src/deep.ts')).toEqual([
      'external:left-pad@1.3.0 side-effect production left-pad=left-pad [] libs/a/src/deep.ts 2:1',
      'external:missing-package@* side-effect production missing-package=missing-package [] libs/a/src/deep.ts 4:1',
      'file:libs/b/src/index.ts side-effect production ../../b/src/index=libs/b/src/index.ts [] libs/a/src/deep.ts 1:1',
    ])
  })

  it('draw a re-export of a workspace package to its entry', () => {
    expect(from('file:libs/a/src/index.ts')).toEqual([
      'entry:@fixture/b value production @fixture/b=libs/b/src/index.ts [] libs/a/src/index.ts 1:1',
    ])
  })

  it('qualify a require in a spec with the spec role and a type import with the type kind', () => {
    expect([...from('file:libs/b/src/index.spec.ts'), ...from('file:libs/b/src/side.ts')]).toEqual([
      'entry:@fixture/a value spec @fixture/a=libs/a/src/index.ts [] libs/b/src/index.spec.ts 1:43',
      'entry:@fixture/a type production @fixture/a=libs/a/src/index.ts [] libs/b/src/side.ts 1:1',
    ])
  })

  it('draw an import of a workspace package without a matching entry to the project, unresolved', () => {
    const project = graph.projects.get('lib-a') as ProjectRecord
    const resolution = graph.resolve('libs/a/src/deep.ts', '@fixture/b/missing')
    const item = { specifier: '@fixture/b/missing', dynamic: false, kind: 'value', typeOnly: false, names: [], line: 9, column: 1 } as const
    expect(fileEdge(graph, project, 'libs/a/src/deep.ts', item, resolution)).toEqual(
      expect.objectContaining({
        target: 'project:@fixture/b',
        kind: 'unresolved',
        path: { specifier: '@fixture/b/missing', resolved: null },
      })
    )
  })
})

describe('the declared edges', () => {
  it('draw implicit dependencies, manifest dependencies, target inputs and executors from a project', () => {
    expect(from('project:lib-a')).toEqual([
      'config:*.md config build-config {workspaceRoot}/*.md=- [lint] nx.json targetDefaults.lint.inputs',
      'config:libs/a/docs/** config build-config {workspaceRoot}/libs/a/docs/**=- [test] libs/a/project.json targets.test.inputs',
      'config:lint.config.ts config build-config {workspaceRoot}/lint.config.ts=lint.config.ts [lint] nx.json targetDefaults.lint.inputs',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [test] libs/a/project.json targets.test.inputs',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [version] nx.json namedInputs.default',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [publish] nx.json namedInputs.default',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [docs] nx.json namedInputs.default',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [build] nx.json targetDefaults.build.inputs',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [lint] nx.json targetDefaults.lint.inputs',
      'external:left-pad@1.3.0 manifest build-config left-pad=left-pad [] libs/a/package.json dependencies.left-pad',
      'external:unversioned@* manifest build-config unversioned=unversioned [] libs/a/package.json devDependencies.unversioned',
      'project:@fixture/app config build-config {workspaceRoot}/apps/app/src/**/*=apps/app [test] libs/a/project.json targets.test.inputs',
      'project:@fixture/b config build-config - [test] libs/a/project.json targets.test.inputs',
      'project:@fixture/b config build-config - [build] nx.json targetDefaults.build.inputs',
      'project:@fixture/b config build-config {workspaceRoot}/libs/b/src/**/*=libs/b [lint] nx.json targetDefaults.lint.inputs',
      'project:@fixture/b manifest build-config @fixture/b=libs/b/package.json [] libs/a/package.json dependencies.@fixture/b',
      'project:lib-b declared build-config - [] libs/a/project.json implicitDependencies',
      'project:root config build-config - [test] libs/a/project.json targets.test.inputs',
      'tool:@fixture/a:docs tool build-config @fixture/a:docs=- [docs] libs/a/project.json targets.docs.executor',
      'tool:@fixture/tooling:build tool build-config @fixture/tooling:build=tools/tooling/src/executors/build/executor.ts [build] nx.json targetDefaults.build.executor',
      'tool:@fixture/tooling:test tool build-config @fixture/tooling:test=- [test] libs/a/project.json targets.test.executor',
      'tool:bare tool build-config bare=- [publish] libs/a/project.json targets.publish.executor',
      'tool:nx:run-commands tool build-config nx:run-commands=- [version] libs/a/project.json targets.version.executor',
    ])
  })

  it('draw a second project sharing a tool to the same tool node, and the inferred lint target to its inputs', () => {
    expect(from('project:lib-d')).toEqual([
      'config:*.md config build-config {workspaceRoot}/*.md=- [lint] nx.json targetDefaults.lint.inputs',
      'config:lint.config.ts config build-config {workspaceRoot}/lint.config.ts=lint.config.ts [lint] nx.json targetDefaults.lint.inputs',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [build] nx.json targetDefaults.build.inputs',
      'config:patches/** config build-config {workspaceRoot}/patches/**=- [lint] nx.json targetDefaults.lint.inputs',
      'project:@fixture/b config build-config - [build] nx.json targetDefaults.build.inputs',
      'project:@fixture/b config build-config {workspaceRoot}/libs/b/src/**/*=libs/b [lint] nx.json targetDefaults.lint.inputs',
      'tool:@fixture/tooling:build tool build-config @fixture/tooling:build=tools/tooling/src/executors/build/executor.ts [build] nx.json targetDefaults.build.executor',
      'tool:nx:run-commands tool build-config nx:run-commands=- [lint] libs/d/project.json targets.lint.executor',
    ])
  })

  it('draw each workspace tool to the project implementing it, once, and installed tools to nothing', () => {
    expect([
      ...from('tool:@fixture/a:docs'),
      ...from('tool:@fixture/tooling:build'),
      ...from('tool:@fixture/tooling:test'),
      ...from('tool:nx:run-commands'),
      ...from('tool:bare'),
    ]).toEqual([
      'project:lib-a tool build-config @fixture/a:docs=- [] libs/a/executors.json executors.docs.implementation',
      'project:tooling tool build-config @fixture/tooling:build=tools/tooling/src/executors/build/executor.ts [] tools/tooling/executors.json executors.build.implementation',
      'project:tooling tool build-config @fixture/tooling:test=- [] tools/tooling/executors.json executors.test.implementation',
    ])
  })
})

describe('the nodes', () => {
  it('hold the entries, externals, tools and configurations the edges reach', () => {
    const kinds = [...graph.nodes.values()].filter((node) => node.kind !== 'file' && node.kind !== 'project')
    expect(kinds).toEqual([
      { kind: 'entry', id: '@fixture/app', project: '@fixture/app', file: 'apps/app/src/main.ts' },
      { kind: 'entry', id: '@fixture/a', project: 'lib-a', file: 'libs/a/src/index.ts' },
      { kind: 'entry', id: '@fixture/b', project: '@fixture/b', file: 'libs/b/src/index.ts' },
      { kind: 'entry', id: '@fixture/b/side', project: '@fixture/b', file: 'libs/b/src/side.ts' },
      { kind: 'entry', id: '@fixture/c', project: '@fixture/c', file: 'libs/c/index.ts' },
      { kind: 'tool', id: 'nx:run-commands', project: null, entry: null },
      { kind: 'config', path: 'patches/**' },
      { kind: 'config', path: 'lint.config.ts' },
      { kind: 'config', path: '*.md' },
      { kind: 'external', name: 'left-pad', version: '1.3.0' },
      { kind: 'external', name: 'missing-package', version: null },
      { kind: 'tool', id: '@fixture/tooling:build', project: 'tooling', entry: 'tools/tooling/src/executors/build/executor.ts' },
      { kind: 'tool', id: 'bare', project: null, entry: null },
      { kind: 'tool', id: '@fixture/a:docs', project: 'lib-a', entry: null },
      { kind: 'tool', id: '@fixture/tooling:test', project: 'tooling', entry: null },
      { kind: 'config', path: 'libs/a/docs/**' },
      { kind: 'config', path: 'libs/b/src/**/*' },
    ])
  })

  it('hold every file with its role', () => {
    expect([graph.nodes.get('file:libs/b/src/index.spec.ts'), graph.nodes.get('file:libs/a/project.json')]).toEqual([
      { kind: 'file', path: 'libs/b/src/index.spec.ts', project: '@fixture/b', role: 'spec' },
      { kind: 'file', path: 'libs/a/project.json', project: 'lib-a', role: 'build-config' },
    ])
  })
})

describe('the groups', () => {
  it('collect the edges between a project and each node outside it by kind and role', () => {
    expect(
      (graph.groups.get('lib-a') ?? []).map((group) => `${group.target} ${group.kind} ${group.role} [${group.files.join(',')}]`)
    ).toEqual([
      'project:@fixture/b side-effect production [libs/a/src/deep.ts]',
      'external:left-pad@1.3.0 side-effect production [libs/a/src/deep.ts]',
      'external:missing-package@* side-effect production [libs/a/src/deep.ts]',
      'project:@fixture/b value production [libs/a/src/index.ts]',
      'project:lib-b declared build-config [libs/a/project.json]',
      'project:@fixture/b manifest build-config [libs/a/package.json]',
      'external:left-pad@1.3.0 manifest build-config [libs/a/package.json]',
      'external:unversioned@* manifest build-config [libs/a/package.json]',
      'tool:@fixture/tooling:build tool build-config [nx.json]',
      'project:@fixture/b config build-config [nx.json,libs/a/project.json]',
      'config:patches/** config build-config [nx.json,libs/a/project.json]',
      'config:lint.config.ts config build-config [nx.json]',
      'config:*.md config build-config [nx.json]',
      'tool:nx:run-commands tool build-config [libs/a/project.json]',
      'tool:bare tool build-config [libs/a/project.json]',
      'tool:@fixture/a:docs tool build-config [libs/a/project.json]',
      'tool:@fixture/tooling:test tool build-config [libs/a/project.json]',
      'project:root config build-config [libs/a/project.json]',
      'project:@fixture/app config build-config [libs/a/project.json]',
      'config:libs/a/docs/** config build-config [libs/a/project.json]',
    ])
  })

  it('keep a spec import and a type import of the same project apart', () => {
    expect(
      (graph.groups.get('@fixture/b') ?? []).map((group) => `${group.target} ${group.kind} ${group.role} [${group.files.join(',')}]`)
    ).toEqual([
      'project:lib-a value spec [libs/b/src/index.spec.ts]',
      'project:lib-a type production [libs/b/src/side.ts]',
      'tool:nx:run-commands tool build-config [libs/b/project.json]',
      'config:patches/** config build-config [nx.json]',
      'config:lint.config.ts config build-config [nx.json]',
      'config:libs/b/src/**/* config build-config [nx.json]',
      'config:*.md config build-config [nx.json]',
    ])
  })

  it('give every project but the root a source group once the lint target is inferred', () => {
    expect([...graph.groups.keys()].sort()).toEqual(['@fixture/app', '@fixture/b', '@fixture/c', 'lib-a', 'lib-d', 'tooling'])
  })

  it('name an unresolved path by its file when no project holds it', () => {
    rmSync(join(root, 'project.json'))
    rmSync(join(root, 'package.json'))
    expect(buildGraph(root).groups.get('@fixture/app')).toEqual(
      expect.arrayContaining([
        { source: '@fixture/app', target: 'file:lint.config', kind: 'unresolved', role: 'production', files: ['apps/app/src/main.ts'] },
      ])
    )
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
