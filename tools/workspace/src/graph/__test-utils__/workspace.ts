/**
 * A disposable git workspace for the graph specs: a root project, two libraries, an
 * application, an aliased package, an installed package, a tooling package with executors, a
 * configuration-only library, target defaults and an ignored directory.
 *
 * @module graph/__test-utils__/workspace
 */

import { execFileSync } from 'node:child_process'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The files of the fixture workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'package.json': '{ "name": "@fixture/workspace", "private": true, "workspaces": ["libs/*"] }',
  'project.json': '{ "name": "root", "projectType": "application", "tags": ["scope:root"] }',
  'nx.json': `{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": ["{workspaceRoot}/patches/**"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts"]
  },
  "targetDefaults": {
    "build": {
      "executor": "@fixture/tooling:build",
      "inputs": ["production", "^production", { "projects": "@fixture/b", "input": "production" }]
    },
    "lint": { "inputs": ["default", "{workspaceRoot}/lint.config.ts", "{workspaceRoot}/libs/b/src/**/*", "{workspaceRoot}/*.md"] }
  }
}
`,
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@fixture/a": ["libs/a/src/index.ts"], "@fixture/a/*": ["libs/a/src/*"], "@fixture/none": [], "@fixture/a/gone": ["libs/a/src/gone.ts"], "@fixture/b/elsewhere": ["libs/a/src/deep.ts"] } } }',
  '.nxignore': '# ignored\nignored/**\n',
  '.gitignore': 'node_modules\n',
  'ignored/package.json': '{ "name": "@fixture/ignored" }',
  'package-lock.json':
    '{ "packages": { "": { "name": "@fixture/workspace" }, "node_modules/left-pad": { "version": "1.3.0" }, "node_modules/left-pad/node_modules/inner": { "version": "0.0.1" }, "node_modules/unversioned": {} } }',
  'node_modules/left-pad/package.json': '{ "name": "left-pad", "version": "1.3.0" }',
  'libs/a/package.json':
    '{ "name": "@fixture/a", "keywords": ["util"], "version": "1.0.0", "dependencies": { "@fixture/b": "*", "left-pad": "^1.0.0" }, "devDependencies": { "unversioned": "*" } }',
  'libs/a/project.json': `{
  "name": "lib-a",
  "projectType": "library",
  "tags": ["scope:a"],
  "implicitDependencies": ["lib-b"],
  "targets": {
    "build": {},
    "lint": {},
    "version": { "executor": "nx:run-commands" },
    "publish": { "executor": "bare" },
    "docs": { "executor": "@fixture/a:docs" },
    "test": {
      "executor": "@fixture/tooling:test",
      "inputs": [
        "default",
        { "projects": ["@fixture/b", "root"], "input": "default" },
        "{workspaceRoot}/apps/app/src/**/*",
        "{workspaceRoot}/libs/a/docs/**"
      ]
    }
  }
}
`,
  'libs/a/src/index.ts': "export { b } from '@fixture/b'\nexport const a = 1\n",
  'libs/a/src/deep.ts': "import '../../b/src/index'\nimport 'left-pad'\nimport 'node:fs'\nimport 'missing-package'\n",
  'libs/b/package.json':
    '{ "name": "@fixture/b", "private": true, "nx": { "projectType": "library" }, "exports": { ".": "./src/index.js", "./package.json": "./package.json", "./star/*": "./src/*.js", "./side": { "import": "./src/side.js" }, "./missing": "./src/missing.js" } }',
  'libs/b/src/index.ts': 'export const b = 2\n',
  'libs/b/src/side.ts': "import type { a } from '@fixture/a'\nexport const side: typeof a = 1\n",
  'libs/b/src/index.spec.ts': "describe('b', () => { it('loads', () => { require('@fixture/a') }) })\n",
  'libs/d/project.json': '{ "name": "lib-d", "targets": { "build": {} } }',
  'libs/d/src/index.ts': 'export const d = 4\n',
  'libs/c/package.json': '{ "name": "@fixture/c", "exports": { "import": "./index.js" } }',
  'libs/c/index.ts': 'export const c = 3\n',
  'node_modules/@fixture/c/package.json': '{ "name": "@fixture/c" }',
  'apps/app/package.json': '{ "name": "@fixture/app", "exports": "./src/main.js" }',
  'apps/app/src/main.ts':
    "import '@fixture/a/deep'\nconst x = () => import('@fixture/a')\nimport '../../../lint.config'\nexport * from './nothing'\n",
  'apps/app/src/broken.ts': 'const = \n',
  'apps/app/README.md': '# app\n',
  'lint.config.ts': 'export default []\n',
  'apps/unnamed/package.json': '{ "version": "1.0.0" }',
  'tools/tooling/package.json': '{ "name": "@fixture/tooling", "executors": "./executors.json" }',
  'tools/tooling/project.json': '{ "name": "tooling" }',
  'tools/tooling/executors.json': '{ "executors": { "build": { "implementation": "./src/executors/build/executor" } } }',
  'tools/tooling/src/executors/build/executor.ts': 'export default (): { success: boolean } => ({ success: true })\n',
}

/**
 * Creates the fixture workspace in a temporary directory and commits nothing: `git ls-files`
 * with untracked files included lists every file.
 *
 * @returns The absolute root
 */
export function createGraphWorkspace(): string {
  const root = createTempDir({ prefix: 'lint-graph-', tree: FILES }).path
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}
