/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * A disposable git workspace for the specs of a changed path alias: a library with a secondary
 * entry, an importer of that entry, a consumer of the importer, a tool whose implementation
 * imports the entry, a library that imports nothing, and targets that read the importers through
 * their own files, their dependencies, a named project, a tool, or not at all.
 *
 * @module graph/__test-utils__/alias-workspace
 */

import type { BaseTsconfig } from '../affected/aliases'
import { execFileSync } from 'node:child_process'
import { after } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The base tsconfig of the workspace: one compiler option and the aliases of its packages. */
export const ALIAS_TSCONFIG = {
  compilerOptions: {
    strict: true,
    paths: {
      '@fixture/data': ['libs/data/src/index.ts'],
      '@fixture/data/csv': ['libs/data/src/csv/index.ts'],
      '@fixture/kit': ['libs/kit/src/index.ts'],
      '@fixture/report': ['libs/report/src/index.ts'],
    },
  },
} as const satisfies BaseTsconfig

/**
 * The `package.json` and `project.json` of a library of the workspace.
 *
 * @param name - The library's directory under `libs`
 * @param targets - The targets it declares
 * @returns The two files, by workspace-relative path
 */
function library(name: string, targets: readonly string[]): Record<string, string> {
  return {
    [`libs/${name}/package.json`]: stringify({ name: `@fixture/${name}`, version: '0.0.0' }),
    [`libs/${name}/project.json`]: stringify({
      name: `lib-${name}`,
      projectType: 'library',
      targets: fromEntries(targets.map((target) => [target, {}])),
    }),
  }
}

/** The files of the workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'package.json': '{ "name": "@fixture/root", "private": true }',
  'project.json': '{ "name": "root", "targets": { "docs": { "inputs": ["{projectRoot}/docs/**/*"] } } }',
  'hf.json': stringify({
    namedInputs: {
      default: ['{projectRoot}/**/*'],
      production: ['default', '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'],
      sources: ['{projectRoot}/src/**/*'],
    },
    targetDefaults: {
      build: { executor: '@fixture/kit:build', inputs: ['production', '^production'] },
      test: { inputs: ['default', '^production'] },
      pack: { inputs: ['production', { projects: 'lib-kit', input: 'sources' }] },
      notes: { inputs: ['{projectRoot}/notes/**/*'] },
    },
  }),
  'tsconfig.base.json': stringify(ALIAS_TSCONFIG),
  '.gitignore': 'node_modules\n.hf\n',
  'docs/guide.md': '# Guide\n',
  ...library('data', ['build', 'test']),
  'libs/data/src/index.ts': 'export const data = 1\n',
  'libs/data/src/csv/index.ts': 'export const csv = 2\n',
  ...library('report', ['build', 'test', 'notes']),
  'libs/report/src/index.ts': "import { csv } from '@fixture/data/csv'\nexport const report = csv\n",
  'libs/report/notes/plan.md': '# Plan\n',
  ...library('site', ['build', 'test', 'notes']),
  'libs/site/src/index.ts': "import { report } from '@fixture/report'\nexport const site = report\n",
  'libs/site/notes/plan.md': '# Plan\n',
  ...library('kit', ['test']),
  'libs/kit/src/index.ts': "import { csv } from '@fixture/data/csv'\nexport const build = (): number => csv\n",
  ...library('plain', ['build', 'test', 'pack']),
  'libs/plain/src/index.ts': "import { data } from '@fixture/data'\nexport const plain = data\n",
}

/**
 * Creates the workspace in a temporary directory and commits nothing. The directory is removed
 * when the spec file, the suite or the test the call sits in ends.
 *
 * @param baseTsconfig - The text of its `tsconfig.base.json`, the fixture's own by default
 * @returns The absolute root
 */
export function createAliasWorkspace(baseTsconfig: string = stringify(ALIAS_TSCONFIG)): string {
  const directory = createTempDir({ prefix: 'lint-graph-alias-', tree: { ...FILES, 'tsconfig.base.json': baseTsconfig } })
  // why: a caller that keeps no handle on the directory still leaves nothing behind, since node:test runs the hook when the file, the suite or the test the call sits in ends
  after(() => directory.remove())
  execFileSync('git', ['init', '-q'], { cwd: directory.path })
  return directory.path
}
