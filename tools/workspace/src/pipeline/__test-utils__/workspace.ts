/**
 * A disposable workspace for the pipeline specs: two publishable libraries, one depending on
 * the other as a peer, a private library, a tool, an e2e project per library (one shipping a
 * consumer smoke, and one whose spec imports the private library), an e2e project naming no
 * library, two demos the lint plugin excludes (each with an install its other targets depend
 * on, the second building after the first one's verify), an application and the root project.
 * Written as code so no test material rests in the tree.
 *
 * @module pipeline/__test-utils__/workspace
 */

import type { FileTree } from '@hyperfrontend/testing/fs'
import type { WorkspaceGraph } from '../../graph/build'
import type { ChangeSet } from '../../graph/selection'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { buildGraph } from '../../graph/build'

/** A planted pipeline workspace. */
export interface PipelineWorkspace {
  /** The absolute root. */
  readonly root: string
  /** The graph of the tree. */
  readonly graph: WorkspaceGraph
  /** Deletes the directory. */
  remove(): void
}

/**
 * A JSON file's text.
 *
 * @param value - What the file holds
 * @returns Pretty-printed JSON with a trailing newline
 */
function json(value: unknown): string {
  return `${stringify(value, null, 2)}\n`
}

/** The fixture tree. */
export const PIPELINE_WORKSPACE: FileTree = freeze({
  'package.json': json({ name: '@fixture/workspace', private: true }),
  'package-lock.json': json({ name: '@fixture/workspace', lockfileVersion: 3, packages: { '': { name: '@fixture/workspace' } } }),
  'nx.json': json({
    namedInputs: { default: ['{projectRoot}/**/*'], production: ['default', '!{projectRoot}/**/*.spec.ts'] },
    targetDefaults: {
      build: { inputs: ['production', '^production'], executor: '@fixture/tooling:build' },
      typecheck: { inputs: ['default', '^production'] },
      test: { inputs: ['default', '^production'] },
      lint: { inputs: ['default', '{workspaceRoot}/lint.base.config.ts'] },
      publish: { dependsOn: ['build'], executor: '@fixture/tooling:publish' },
    },
    plugins: [{ plugin: './tools/lint/src/nx/plugin.ts', exclude: ['apps/demos/**/*'] }],
  }),
  'tsconfig.base.json': json({
    compilerOptions: {
      paths: {
        '@fixture/alpha': ['libs/alpha/src/index.ts'],
        '@fixture/beta': ['libs/beta/src/index.ts'],
        '@fixture/testing': ['libs/testing/src/index.ts'],
      },
    },
  }),
  'lint.base.config.ts': 'export default []\n',
  'project.json': json({ name: 'workspace', projectType: 'application', targets: { lint: { inputs: ['{workspaceRoot}/*.md'] } } }),
  'README.md': '# fixture\n',
  'libs/alpha/package.json': json({
    name: '@fixture/alpha',
    version: '1.2.0',
    engines: { node: '>=20.1' },
    exports: { '.': './src/index.js' },
  }),
  'libs/alpha/project.json': json({
    name: 'lib-alpha',
    projectType: 'library',
    targets: { build: {}, test: {}, typecheck: {}, lint: {}, publish: {}, version: {} },
  }),
  'libs/alpha/src/index.ts': 'export const alpha = 1\n',
  'libs/alpha/src/index.spec.ts': "import { alpha } from './index'\nexport const checked = alpha\n",
  'libs/beta/package.json': json({
    name: '@fixture/beta',
    version: '2.0.0',
    peerDependencies: { '@fixture/alpha': '1.2.0' },
    exports: { '.': './src/index.js' },
  }),
  'libs/beta/project.json': json({
    name: 'lib-beta',
    projectType: 'library',
    targets: {
      build: {},
      test: {},
      typecheck: {},
      lint: {},
      publish: {},
      serve: { dependsOn: ['build'] },
      'loop-a': { dependsOn: ['loop-b'] },
      'loop-b': { dependsOn: ['loop-a'] },
    },
  }),
  'libs/beta/src/index.ts': "import { alpha } from '@fixture/alpha'\nexport const beta = alpha + 1\n",
  'libs/testing/package.json': json({ name: '@fixture/testing', version: '0.0.0', private: true, exports: { '.': './src/index.js' } }),
  'libs/testing/project.json': json({
    name: 'lib-testing',
    projectType: 'library',
    targets: { build: {}, test: {}, typecheck: {}, publish: {} },
  }),
  'libs/testing/src/index.ts': 'export const check = (ok: boolean): boolean => ok\n',
  'tools/tooling/package.json': json({ name: '@fixture/tooling', private: true, executors: './executors.json' }),
  'tools/tooling/project.json': json({ name: 'tool-ling', targets: { typecheck: {}, test: {} } }),
  'tools/tooling/executors.json': json({
    executors: { build: { implementation: './src/build' }, publish: { implementation: './src/publish' } },
  }),
  'tools/tooling/src/build.ts': 'export default (): boolean => true\n',
  'tools/tooling/src/publish.ts': 'export default (): boolean => true\n',
  'apps/alpha-e2e/project.json': json({
    name: 'e2e-alpha',
    projectType: 'application',
    implicitDependencies: ['lib-alpha'],
    targets: { e2e: { dependsOn: ['^build'] } },
  }),
  'apps/alpha-e2e/scripts/consumer-smoke.mjs': 'process.exit(0)\n',
  'apps/alpha-e2e/src/esm.spec.ts': "import { check } from '@fixture/testing'\nexport const loaded = check(true)\n",
  'apps/beta-e2e/project.json': json({
    name: 'e2e-beta',
    projectType: 'application',
    implicitDependencies: ['lib-beta'],
    targets: { e2e: { dependsOn: ['^build'] } },
  }),
  'apps/orphan-e2e/project.json': json({
    name: 'e2e-orphan',
    projectType: 'application',
    implicitDependencies: ['nobody'],
    targets: { e2e: {} },
  }),
  'apps/demos/one/project.json': json({
    name: 'demo-one',
    projectType: 'application',
    targets: {
      install: {},
      build: { dependsOn: ['install'] },
      typecheck: { dependsOn: ['install'] },
      verify: { dependsOn: ['install'] },
    },
  }),
  'apps/demos/one/src/main.ts': 'export const demo = 1\n',
  'apps/demos/two/project.json': json({
    name: 'demo-two',
    projectType: 'application',
    targets: { install: {}, build: { dependsOn: ['install', 'demo-one:verify'] } },
  }),
  'apps/demos/two/src/main.ts': 'export const demo = 2\n',
  'apps/site/project.json': json({ name: 'app-site', projectType: 'application', targets: { build: {}, typecheck: {}, lint: {} } }),
  'apps/site/src/main.ts': "import { beta } from '@fixture/beta'\nexport const site = beta\n",
})

/**
 * Plants the fixture and builds its graph.
 *
 * @param tree - The tree, the fixture's by default
 * @returns The root, the graph and how to remove the directory
 */
export function createPipelineWorkspace(tree: FileTree = PIPELINE_WORKSPACE): PipelineWorkspace {
  const directory = createTempDir({ prefix: 'pipeline-', tree })
  return { root: directory.path, graph: buildGraph(directory.path, { files: keys(tree) }), remove: () => directory.remove() }
}

/**
 * A change set over the fixture, as if the files had been modified in the working tree.
 *
 * @param paths - The files that changed, workspace-relative
 * @returns The change set
 */
export function modified(...paths: readonly string[]): ChangeSet {
  return { base: 'base-revision', head: null, changes: paths.map((path) => ({ status: 'modified', path, previousPath: null })) }
}
