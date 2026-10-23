import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from './__fixtures__/workspace.ts'
import { buildGraph, workspaceGraph } from './build.ts'

const root = createGraphWorkspace()

/**
 * The edges of a project, compactly.
 *
 * @param project - The project name
 * @returns One `target type [files]` per edge
 */
function edgesOf(project: string): string[] {
  return (workspaceGraph(root).edges.get(project) ?? []).map((edge) => `${edge.target} ${edge.type} [${edge.files.join(',')}]`)
}

describe('workspaceGraph', () => {
  it('builds once per root', () => {
    expect(workspaceGraph(root)).toBe(workspaceGraph(root))
  })

  it('draws implicit, static and dynamic edges', () => {
    expect(edgesOf('lib-a')).toEqual(['lib-b implicit []', '@fixture/b static [libs/a/src/deep.ts,libs/a/src/index.ts]'])
  })

  it('draws an edge once per file', () => {
    expect(edgesOf('@fixture/app')).toEqual(['lib-a static [apps/app/src/main.ts]', 'lib-a dynamic [apps/app/src/main.ts]'])
  })

  it('keeps an edge into the root project only from the root project', () => {
    expect(edgesOf('root')).toEqual([])
  })

  it('records the npm packages each project uses', () => {
    expect(workspaceGraph(root).npmUses.get('lib-a')).toEqual([
      { name: 'left-pad', files: ['libs/a/src/deep.ts'] },
      { name: 'missing-package', files: ['libs/a/src/deep.ts'] },
    ])
  })

  it('reads the aliases, versions and owners', () => {
    const graph = workspaceGraph(root)
    expect([
      graph.aliases.get('@fixture/a'),
      graph.versions.get('left-pad'),
      graph.projectOf('lint.config.ts')?.name,
      graph.resolve('libs/a/src/deep.ts', 'fs').kind,
    ]).toEqual([['libs/a/src/index.ts'], '1.3.0', 'root', 'builtin'])
  })

  it('reads the workspaces from their object form, and none when absent', () => {
    writeFileSync(join(root, 'package.json'), '{ "name": "@fixture/workspace", "workspaces": { "packages": ["libs/*"] } }')
    const object = buildGraph(root).packages.size
    writeFileSync(join(root, 'package.json'), '{ "name": "@fixture/workspace", "workspaces": {} }')
    const empty = buildGraph(root).packages.size
    writeFileSync(join(root, 'package.json'), '{ "name": "@fixture/workspace" }')
    const none = buildGraph(root).packages.size
    writeFileSync(join(root, 'tsconfig.base.json'), '{}')
    const aliases = buildGraph(root).aliases.size
    expect([object, empty, none, aliases]).toEqual([3, 0, 0, 0])
  })
})

describe('a tracked file the working tree has deleted', () => {
  it('draws no edge from it and builds the rest of the graph', () => {
    const file = join(root, 'libs', 'a', 'src', 'gone.ts')
    writeFileSync(file, "import { b } from '@fixture/b'\n")
    execFileSync('git', ['add', '--', file], { cwd: root })
    rmSync(file)
    expect(
      buildGraph(root)
        .edges.get('lib-a')
        ?.some((edge) => edge.files.includes('libs/a/src/gone.ts'))
    ).toBe(false)
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
