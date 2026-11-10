import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { buildOutputOf, resolveFromEngine, resolveFromWorkspace, workspacePackages } from './workspace'

describe('resolveFromWorkspace', () => {
  const workspace = useTempDir({
    prefix: 'executors-workspace-',
    tree: {
      'package.json': '{ "name": "workspace" }',
      'node_modules/@fixture/runtime/package.json': '{ "name": "@fixture/runtime", "exports": { "./hooks": "./hooks.cjs" } }',
      'node_modules/@fixture/runtime/hooks.cjs': '',
    },
  })

  it('finds an entry of a package the workspace installs', () => {
    expect(resolveFromWorkspace(workspace.path, '@fixture/runtime/hooks')).toBe(
      join(workspace.path, 'node_modules', '@fixture', 'runtime', 'hooks.cjs')
    )
  })

  it('answers null for a module the workspace cannot resolve', () => {
    expect(resolveFromWorkspace(workspace.path, '@fixture/absent/hooks')).toBeNull()
  })
})

describe('resolveFromEngine', () => {
  const installs = useTempDir({
    prefix: 'executors-engine-',
    tree: {
      'node_modules/typescript/package.json': '{ "name": "typescript", "version": "7.0.0", "exports": { ".": "./index.js" } }',
      'node_modules/typescript/index.js': '',
      'node_modules/typescript/bin/tsc': '',
      'node_modules/@hyperfrontend/workspace/executors/keep.txt': '',
      'node_modules/@hyperfrontend/workspace/node_modules/typescript/package.json': '{ "name": "typescript", "version": "5.9.3" }',
      'node_modules/@hyperfrontend/workspace/node_modules/typescript/bin/tsc': '',
    },
  })

  it('finds the dependency nested beside the engine before the one hoisted above it', () => {
    expect(resolveFromEngine('typescript/bin/tsc', join(installs.path, 'node_modules', '@hyperfrontend', 'workspace', 'executors'))).toBe(
      join(installs.path, 'node_modules', '@hyperfrontend', 'workspace', 'node_modules', 'typescript', 'bin', 'tsc')
    )
  })

  it('answers null when the hoisted package does not export the script and nothing is nested', () => {
    expect(resolveFromEngine('typescript/bin/tsc', join(installs.path, 'node_modules', 'other'))).toBeNull()
  })

  it('climbs from this module when no directory is given', () => {
    expect(resolveFromEngine('typescript/bin/tsc')).toMatch(/typescript[\\/]bin[\\/]tsc$/)
  })
})

describe('buildOutputOf', () => {
  it('answers the output path the build target runs with', () => {
    expect(buildOutputOf('/work', { root: 'libs/a', targets: { build: { options: { outputPath: 'out/a' } } } })).toBe(
      join('/work', 'out', 'a')
    )
  })

  it.each([
    ['has no build target', { root: 'libs/a' }],
    ['builds without an output path', { root: 'libs/a', targets: { build: { options: {} } } }],
  ])('answers dist under the project root for a project that %s', (_, project) => {
    expect(buildOutputOf('/work', project)).toBe(join('/work', 'dist', 'libs', 'a'))
  })
})

describe('workspacePackages', () => {
  const workspace = useTempDir({
    prefix: 'executors-packages-',
    tree: {
      'libs/a/package.json': '{ "name": "@fixture/a" }',
      'libs/unnamed/package.json': '{ "private": true }',
      'apps/site/project.json': '{ "name": "site" }',
    },
  })

  it('names the package of every project that carries one', () => {
    expect(
      workspacePackages(workspace.path, { a: { root: 'libs/a' }, unnamed: { root: 'libs/unnamed' }, site: { root: 'apps/site' } })
    ).toEqual(['@fixture/a'])
  })
})
