/**
 * A disposable workspace for the runner specs: target defaults keyed by name and by executor,
 * a library whose targets inherit them, a manifest-only package, a tooling project providing
 * executors, a package of the same kind that provides none, and a demo the lint plugin leaves
 * alone. Written as code so no test material rests in the tree.
 *
 * @module runner/__test-utils__/workspace
 */

import type { FileTree, TempDir } from '@hyperfrontend/testing/fs'
import { execFileSync } from 'node:child_process'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The fixture tree. */
export const RUNNER_WORKSPACE: FileTree = freeze({
  'package.json': { name: '@fixture/workspace', private: true },
  'nx.json': {
    targetDefaults: {
      build: { executor: '@fixture/tooling:build', options: { outputPath: 'dist/{projectRoot}', mode: 'default' } },
      '@fixture/tooling:check': { options: { level: 'from-executor' } },
      check: { options: { level: 'from-name', strict: true } },
      audit: { executor: 'nx:run-commands', options: { command: 'npm audit', cwd: '{projectRoot}' } },
      lint: { inputs: ['default'] },
    },
    lint: { exclude: ['apps/demos/**/*'] },
  },
  'project.json': { name: 'workspace', targets: { lint: { command: 'node tools/lint/bin/lint.ts .' } } },
  'libs/alpha/package.json': { name: '@fixture/alpha', version: '1.0.0' },
  'libs/alpha/project.json': {
    name: 'lib-alpha',
    projectType: 'library',
    sourceRoot: '{projectRoot}/src',
    tags: ['scope:alpha'],
    implicitDependencies: ['lib-beta'],
    targets: {
      build: { options: { entry: '{projectRoot}/src/index.ts' } },
      check: { executor: '@fixture/tooling:check', options: { strict: false } },
      audit: {},
      'version:all': { executor: '@fixture/tooling:version' },
      broken: { executor: '@fixture/tooling:missing' },
      throws: { executor: '@fixture/tooling:throws' },
      fails: { executor: '@fixture/tooling:fails' },
    },
  },
  'libs/beta/package.json': { name: '@fixture/beta', nx: { projectType: 'library' } },
  'tools/tooling/package.json': { name: '@fixture/tooling', private: true, executors: './executors.json' },
  'tools/tooling/project.json': { name: 'tool-ling', targets: { typecheck: {} } },
  'tools/tooling/executors.json': {
    executors: {
      build: { implementation: './src/build/executor', schema: './src/build/schema.json' },
      check: { implementation: './src/check/executor', schema: './src/check/schema.json' },
      version: { implementation: './src/version', schema: './src/version.json' },
      missing: { implementation: './src/missing', schema: './src/version.json' },
      throws: { implementation: './src/version', schema: './src/version.json' },
      fails: { implementation: './src/version', schema: './src/version.json' },
      'no-schema': { implementation: './src/version', schema: './src/none.json' },
    },
  },
  'tools/tooling/src/build/executor.ts': 'export default (): Promise<{ success: boolean }> => Promise.resolve({ success: true })\n',
  'tools/tooling/src/build/schema.json': {
    properties: { mode: { type: 'string', default: 'schema' }, verbose: { type: 'boolean', default: false } },
  },
  'tools/tooling/src/check/executor.ts': 'export default (): Promise<{ success: boolean }> => Promise.resolve({ success: true })\n',
  'tools/tooling/src/check/schema.json': { properties: {} },
  'tools/tooling/src/version.ts': 'export default (): Promise<{ success: boolean }> => Promise.resolve({ success: true })\n',
  'tools/tooling/src/version.json': { properties: {} },
  'tools/other/package.json': { name: '@fixture/other', private: true },
  'tools/other/project.json': { name: 'tool-other' },
  'apps/demos/one/project.json': { name: 'demo-one', projectType: 'application', targets: { build: {} } },
})

/**
 * Creates the fixture workspace in a temporary directory, as a git repository with nothing
 * committed: `git ls-files` with untracked files included lists every file.
 *
 * @param tree - Files that replace or join the fixture's
 * @returns The directory, for the caller to remove
 */
export function createRunnerWorkspace(tree: FileTree = {}): TempDir {
  const directory = createTempDir({ prefix: 'runner-', tree: { ...RUNNER_WORKSPACE, ...tree } })
  execFileSync('git', ['init', '-q'], { cwd: directory.path })
  return directory
}
