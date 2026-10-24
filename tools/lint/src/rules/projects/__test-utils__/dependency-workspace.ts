/**
 * A disposable git workspace for the dependency specs: a buildable library importing an npm
 * package, a buildable and an unbuildable workspace library, a missing package, a nested install,
 * a library pinning a prerelease beside a package installed at no version, and the root project.
 *
 * @module rules/projects/__test-utils__/dependency-workspace
 */

import { execFileSync } from 'node:child_process'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The files of the workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  '.gitignore': 'node_modules\n',
  'package.json': stringify({
    name: '@ws/root',
    private: true,
    dependencies: { 'left-pad': '1.3.0' },
    devDependencies: { typescript: '5.0.0' },
  }),
  'project.json': stringify({ name: 'root' }),
  'root-file.ts': 'export const root = 1\n',
  'nx.json': stringify({
    namedInputs: { default: ['{projectRoot}/**/*', 'sharedGlobals'], sharedGlobals: ['{workspaceRoot}/patches/**'] },
    targetDefaults: { build: { inputs: ['default', '^default', { projects: ['other'], input: 'default' }] } },
  }),
  'tsconfig.base.json': stringify({
    compilerOptions: {
      paths: {
        '@ws/dep': ['libs/dep/src/index.ts'],
        '@ws/nobuild': ['libs/nobuild/src/index.ts'],
        '@ws/lib': ['libs/lib/src/index.ts'],
        '@ws/unversioned': ['libs/unversioned/src/index.ts'],
      },
    },
  }),
  'package-lock.json': stringify({
    packages: {
      '': {},
      'node_modules/left-pad': { version: '1.3.0' },
      'node_modules/typescript': { version: '5.0.0' },
      'node_modules/hoisted': { version: '2.0.0' },
      'node_modules/x/node_modules/inner': { version: '0.0.1' },
      'node_modules/prerelease': { version: '1.0.0-alpha.6' },
      'node_modules/oddball': { version: 'next' },
    },
  }),
  'node_modules/left-pad/package.json': stringify({ name: 'left-pad', version: '1.3.0' }),
  'libs/lib/project.json': stringify({ name: 'lib', targets: { build: { executor: 'x:build' } } }),
  'libs/lib/src/index.ts': "import 'left-pad'\nimport 'node:fs'\nimport 'unknown-package'\nimport '@ws/lib'\nimport '../../../root-file'\n",
  'libs/lib/src/dep-user.ts': "import { dep } from '@ws/dep'\nimport { nobuild } from '@ws/nobuild'\nexport const both = [dep, nobuild]\n",
  'libs/lib/src/nested/use.ts': "import 'inner'\nimport 'hoisted'\nimport 'versionless'\n",
  'libs/lib/src/nested/node_modules/inner/package.json': stringify({ name: 'inner', version: '0.0.1' }),
  'libs/lib/src/nested/node_modules/hoisted/package.json': stringify({ name: 'hoisted', version: '9.9.9' }),
  'libs/lib/src/nested/node_modules/versionless/package.json': stringify({ name: 'versionless' }),
  'libs/lib/README.md': '# lib\n',
  'libs/dep/project.json': stringify({ name: 'dep', targets: { build: { executor: 'x:build' } } }),
  'libs/dep/package.json': stringify({ name: '@ws/dep', version: '2.0.0' }),
  'libs/dep/src/index.ts': 'export const dep = 1\n',
  'libs/unversioned/project.json': stringify({ name: 'unversioned', targets: { build: { executor: 'x:build' } } }),
  'libs/unversioned/package.json': stringify({ name: '@ws/unversioned' }),
  'libs/nobuild/project.json': stringify({ name: 'nobuild' }),
  'libs/nobuild/package.json': stringify({ name: '@ws/nobuild', version: '1.0.0' }),
  'libs/nobuild/src/index.ts': 'export const nobuild = 1\n',
  'libs/quiet/project.json': stringify({ name: 'quiet', targets: { build: { executor: 'x:build' } } }),
  'libs/quiet/src/index.ts': 'export const quiet = 1\n',
  'libs/user/project.json': stringify({ name: 'user', targets: { build: { executor: 'x:build', inputs: ['{projectRoot}/**/*'] } } }),
  'libs/user/src/index.ts': "import '@ws/unversioned'\n",
  'node_modules/prerelease/package.json': stringify({ name: 'prerelease', version: '1.0.0-alpha.6' }),
  'libs/pre/project.json': stringify({ name: 'pre', targets: { build: { executor: 'x:build' } } }),
  'node_modules/oddball/package.json': stringify({ name: 'oddball', version: 'next' }),
  'libs/pre/src/index.ts': "import 'prerelease'\nimport 'oddball'\n",
}

/**
 * Creates the workspace in a temporary directory, a git repository with nothing committed.
 *
 * @returns The absolute root
 */
export function createDependencyWorkspace(): string {
  const root = createTempDir({ prefix: 'lint-dependencies-', tree: FILES }).path
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}
