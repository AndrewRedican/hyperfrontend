/**
 * A disposable git workspace for the graph specs: a root project, two libraries, an
 * application, an aliased package, an installed package and an ignored directory.
 *
 * @module graph/__fixtures__/workspace
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** The files of the fixture workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'package.json': '{ "name": "@fixture/workspace", "private": true, "workspaces": ["libs/*"] }',
  'project.json': '{ "name": "root", "projectType": "application", "tags": ["scope:root"] }',
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@fixture/a": ["libs/a/src/index.ts"], "@fixture/a/*": ["libs/a/src/*"], "@fixture/none": [] } } }',
  '.nxignore': '# ignored\nignored/**\n',
  '.gitignore': 'node_modules\n',
  'ignored/package.json': '{ "name": "@fixture/ignored" }',
  'package-lock.json':
    '{ "packages": { "": { "name": "@fixture/workspace" }, "node_modules/left-pad": { "version": "1.3.0" }, "node_modules/left-pad/node_modules/inner": { "version": "0.0.1" }, "node_modules/unversioned": {} } }',
  'node_modules/left-pad/package.json': '{ "name": "left-pad", "version": "1.3.0" }',
  'libs/a/package.json': '{ "name": "@fixture/a", "keywords": ["util"], "version": "1.0.0" }',
  'libs/a/project.json': '{ "name": "lib-a", "projectType": "library", "tags": ["scope:a"], "implicitDependencies": ["lib-b"] }',
  'libs/a/src/index.ts': "export { b } from '@fixture/b'\nexport const a = 1\n",
  'libs/a/src/deep.ts': "import '../../b/src/index'\nimport 'left-pad'\nimport 'node:fs'\nimport 'missing-package'\n",
  'libs/b/package.json': '{ "name": "@fixture/b", "private": true, "nx": { "projectType": "library" } }',
  'libs/b/src/index.ts': 'export const b = 2\n',
  'libs/b/src/index.spec.ts': "describe('b', () => { it('loads', () => { require('@fixture/a') }) })\n",
  'libs/c/package.json': '{ "name": "@fixture/c" }',
  'node_modules/@fixture/c/package.json': '{ "name": "@fixture/c" }',
  'apps/app/package.json': '{ "name": "@fixture/app" }',
  'apps/app/src/main.ts':
    "import '@fixture/a/deep'\nconst x = () => import('@fixture/a')\nimport '../../../lint.config'\nexport * from './nothing'\n",
  'apps/app/src/broken.ts': 'const = \n',
  'apps/app/README.md': '# app\n',
  'lint.config.ts': 'export default []\n',
  'apps/unnamed/package.json': '{ "version": "1.0.0" }',
}

/**
 * Creates the fixture workspace in a temporary directory and commits nothing: `git ls-files`
 * with untracked files included lists every file.
 *
 * @returns The absolute root
 */
export function createGraphWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'lint-graph-'))
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}
