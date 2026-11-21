/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * A disposable git workspace for the specs of projects that install for themselves: two aliased
 * libraries, and beside them projects with a lock file of their own, each one a case of what
 * decides whether the workspace's path aliases reach it: the configurations its tsconfig extends,
 * the executors its targets run, and where its lock file takes a package from.
 *
 * @module graph/__test-utils__/consumer-workspace
 */

import { execFileSync } from 'node:child_process'
import { posix } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** Where the fixture's registry serves a package from. */
const REGISTRY = 'https://registry.npmjs.org'

/** A lock file taking `@fixture/kit` and `@fixture/rules` from the registry, with entries a project does not take from it. */
const LOCK = stringify({
  packages: {
    '': { name: 'consumer' },
    'node_modules/@fixture/kit': { version: '1.0.0', resolved: `${REGISTRY}/@fixture/kit/-/kit-1.0.0.tgz` },
    'node_modules/@fixture/rules': { version: '1.0.0', resolved: `${REGISTRY}/@fixture/rules/-/rules-1.0.0.tgz` },
    'node_modules/@fixture/shell': { version: '0.1.0', resolved: 'file:vendor/fixture-shell-0.1.0.tgz' },
    'node_modules/@fixture/linked': { resolved: '../../libs/linked', link: true },
    'node_modules/@fixture/bare': { version: '0.0.1' },
    'node_modules/left-pad': { version: '1.3.0', resolved: `${REGISTRY}/left-pad/-/left-pad-1.3.0.tgz` },
    'node_modules/left-pad/node_modules/@fixture/nested': { version: '0.0.1', resolved: `${REGISTRY}/@fixture/nested/-/nested-0.0.1.tgz` },
  },
})

/** The packages `LOCK` takes from the registry at its top level. */
export const REGISTRY_PACKAGES = ['@fixture/kit', '@fixture/rules', 'left-pad']

/**
 * The files of a project under `apps` that installs for itself and imports `@fixture/kit`.
 *
 * @param name - The project's directory and name
 * @param files - Its other files, by path under the project
 * @param targets - The targets its `project.json` declares
 * @returns The files, by workspace-relative path
 */
function consumer(
  name: string,
  files: Readonly<Record<string, string>>,
  targets: Readonly<Record<string, object>> = { build: {} }
): Record<string, string> {
  const placed: Record<string, string> = {
    [`apps/${name}/package.json`]: stringify({ name: `@fixture/${name}`, dependencies: { '@fixture/kit': '1.0.0', 'left-pad': '1.3.0' } }),
    [`apps/${name}/project.json`]: stringify({ name, projectType: 'application', targets }),
    [`apps/${name}/package-lock.json`]: LOCK,
    [`apps/${name}/src/main.ts`]:
      "import { kit } from '@fixture/kit'\nimport { deep } from '@fixture/kit/deep'\nexport const main = [kit, deep]\n",
  }
  for (const [file, text] of entries(files)) placed[posix.join('apps', name, file)] = text
  return placed
}

/** The files of the workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'package.json': '{ "name": "@fixture/root", "private": true }',
  'project.json': '{ "name": "root", "targets": { "build": {} } }',
  'package-lock.json': LOCK,
  'main.ts': "import { kit } from '@fixture/kit'\nexport const root = kit\n",
  'hf.json': stringify({
    namedInputs: { default: ['{projectRoot}/**/*'], production: ['default', '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'] },
    targetDefaults: {
      build: { inputs: ['production', '^production'] },
      test: { executor: '@hyperfrontend/workspace:test', inputs: ['default', '^production'] },
    },
  }),
  'tsconfig.base.json': stringify({
    compilerOptions: {
      paths: {
        '@fixture/kit': ['libs/kit/src/index.ts'],
        '@fixture/kit/*': ['libs/kit/src/*'],
        '@fixture/rules': ['libs/rules/src/index.ts'],
      },
    },
  }),
  '.gitignore': 'node_modules\n.hf\n',
  'libs/kit/package.json': '{ "name": "@fixture/kit", "version": "2.0.0" }',
  'libs/kit/project.json': '{ "name": "lib-kit", "projectType": "library", "targets": { "build": {}, "test": {} } }',
  'libs/kit/tsconfig.json': '{ "extends": "../../tsconfig.base.json" }',
  'libs/kit/src/index.ts': 'export const kit = 1\n',
  'libs/kit/src/deep.ts': 'export const deep = 2\n',
  'libs/rules/package.json': '{ "name": "@fixture/rules", "version": "2.0.0" }',
  'libs/rules/project.json': '{ "name": "lib-rules", "projectType": "library", "targets": { "build": {} } }',
  'libs/rules/src/index.ts': 'export default []\n',
  // note: the site carries a solution file, a configuration with comments that extends a package's and one of its own, and a lint configuration
  ...consumer('site', {
    'tsconfig.json': '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }',
    'tsconfig.app.json': `{
  // The compiler settings of the application.
  "extends": ["@vue/tsconfig/tsconfig.dom.json", "./tsconfig.shared"],
  "include": ["src/**/*", /* generated */ "env.d.ts",],
}
`,
    'tsconfig.shared.json': '{ "compilerOptions": { "strict": true } }',
    'lint.config.ts': "import rules from '@fixture/rules'\nexport default rules\n",
  }),
  ...consumer('seed', { 'tsconfig.json': '{ "extends": "../../tsconfig.base.json" }' }),
  ...consumer('chain', {
    'tsconfig.json': '{ "extends": ["./tsconfig.mid.json"] }',
    'tsconfig.mid.json': '{ "extends": "../../tsconfig.base" }',
  }),
  ...consumer('missing', { 'tsconfig.json': '{ "extends": "./gone.json" }' }),
  ...consumer('absolute', { 'tsconfig.json': '{ "extends": "/srv/tsconfig.base.json" }' }),
  ...consumer('drive', { 'tsconfig.json': '{ "extends": "C:/srv/tsconfig.base.json" }' }),
  ...consumer('broken', { 'tsconfig.json': '{ "extends": ' }),
  ...consumer('list', { 'tsconfig.json': '[]' }),
  ...consumer('numbered', { 'tsconfig.json': '{ "extends": 3 }' }),
  ...consumer('holed', { 'tsconfig.json': '{ "extends": [, "./tsconfig.own.json"] }', 'tsconfig.own.json': '{}' }),
  ...consumer('spread', { 'tsconfig.json': '{ ...{}, "extends": "./tsconfig.own.json" }', 'tsconfig.own.json': '{}' }),
  ...consumer('deleted', { 'tsconfig.json': '{}' }),
  ...consumer('bare', {}),
  ...consumer('checked', { 'tsconfig.json': '{}' }, { test: {} }),
  ...consumer('packed', { 'tsconfig.json': '{}' }, { e2e: { executor: '@hyperfrontend/workspace:e2e' }, notes: {} }),
  'apps/lone/package.json': '{ "name": "@fixture/lone", "dependencies": { "@fixture/kit": "1.0.0" } }',
  'apps/lone/package-lock.json': LOCK,
  'apps/lone/index.ts': "import { kit } from '@fixture/kit'\nexport const lone = kit\n",
}

/**
 * Creates the workspace in a temporary directory and commits nothing.
 *
 * @returns The absolute root
 */
export function createConsumerWorkspace(): string {
  const root = createTempDir({ prefix: 'lint-graph-consumer-', tree: FILES }).path
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}
