import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { makePublishableGenerator, planPublishable } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const FILES = {
  'package.json': '{ "name": "@acme/monorepo", "license": "MIT", "funding": { "type": "github", "url": "https://example.test/sponsor" } }',
  'libs/a/project.json': '{ "name": "lib-a", "projectType": "library", "targets": { "typecheck": {}, "test": {} } }',
  'libs/a/package.json':
    '{ "name": "@acme/a", "version": "1.2.0", "description": "A.", "private": true, "exports": { ".": "./src/index.js" } }',
}

/**
 * A tree with the fixture files, some replaced.
 *
 * @param overrides - The files written over the fixture's
 * @returns A memory tree holding the files
 */
function treeWith(overrides: Record<string, string> = {}): ReturnType<typeof createMemoryTree> {
  return createMemoryTree({ ...FILES, ...overrides })
}

describe('planPublishable', () => {
  it('settles the names, the formats and the e2e project from the manifest and the defaults', () => {
    expect(planPublishable(treeWith(), { project: 'lib-a' })).toEqual({
      projectName: 'lib-a',
      projectRoot: 'libs/a',
      packageName: '@acme/a',
      description: 'A.',
      formats: ['esm', 'cjs'],
      globalName: 'AcmeA',
      bundleEntry: '.',
      keywords: ['a', 'acme', 'typescript'],
      nodeEngine: undefined,
      buildExecutor: '@hyperfrontend/workspace:build',
      e2eProjectName: 'e2e-lib-a',
      e2ePackageName: '@acme/e2e-a',
      e2eProjectRoot: 'e2e/a',
      createE2e: true,
      republishing: false,
      e2eExists: false,
    })
  })

  it('takes the formats in the build order, the global, the entry, the keywords, the engine, the executor and the e2e directory as given', () => {
    expect(
      planPublishable(treeWith(), {
        project: 'lib-a',
        formats: ['umd', 'cjs'],
        globalName: 'A',
        bundleEntry: './browser',
        keywords: ['chosen'],
        nodeEngine: '>=20',
        buildExecutor: '@acme/local:build',
        e2eDirectory: 'apps/e2e',
      })
    ).toEqual(
      expect.objectContaining({
        formats: ['cjs', 'umd'],
        globalName: 'A',
        bundleEntry: './browser',
        keywords: ['chosen'],
        nodeEngine: '>=20',
        buildExecutor: '@acme/local:build',
        e2eProjectRoot: 'apps/e2e/a',
      })
    )
  })

  it('keeps the keywords the package chose', () => {
    expect(
      planPublishable(treeWith({ 'libs/a/package.json': '{ "name": "@acme/a", "keywords": ["own"] }' }), { project: 'lib-a' }).keywords
    ).toEqual(['own'])
  })

  it('names an unscoped package after itself alone', () => {
    expect(planPublishable(treeWith({ 'libs/a/package.json': '{ "name": "a" }' }), { project: 'lib-a' })).toEqual(
      expect.objectContaining({ keywords: ['a', 'typescript'], e2ePackageName: 'e2e-a', globalName: 'A' })
    )
  })

  it('refuses a project without a named package', () => {
    expect(() => planPublishable(treeWith({ 'libs/a/package.json': '{}' }), { project: 'lib-a' })).toThrow(
      'has no package.json naming its package'
    )
  })

  it('refuses a format the build does not write', () => {
    expect(() => planPublishable(treeWith(), { project: 'lib-a', formats: ['esm', 'wasm'] })).toThrow(
      'unknown bundle formats wasm; the build writes esm, cjs, iife, umd'
    )
  })
})

describe('makePublishableGenerator', () => {
  it('adds the targets a package runs, keeping the ones the project has', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect(readJson<{ targets: unknown }>(tree, 'libs/a/project.json').targets).toEqual({
      version: {},
      'version-check': {},
      build: {
        executor: '@hyperfrontend/workspace:build',
        options: { esm: { bundleWorkspaceDeps: true }, cjs: { bundleWorkspaceDeps: true } },
      },
      publish: {},
      typecheck: {},
      test: {},
    })
  })

  it('configures the browser bundles with their entry and global', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', formats: ['esm', 'cjs', 'iife', 'umd'], skipFormat: true })
    expect(readJson<{ targets: { build: { options: unknown } } }>(tree, 'libs/a/project.json').targets.build.options).toEqual({
      esm: { bundleWorkspaceDeps: true },
      cjs: { bundleWorkspaceDeps: true },
      iife: { entry: '.', globalName: 'AcmeA' },
      umd: { entry: '.', globalName: 'AcmeA' },
    })
  })

  it('merges the formats into a build target the project has, its executor and its own options winning', async () => {
    const tree = treeWith({
      'libs/a/project.json':
        '{ "name": "lib-a", "targets": { "build": { "executor": "@acme/local:build", "options": { "esm": { "bundleWorkspaceDeps": false }, "cjs": {}, "outputPath": "out/a" } }, "publish": {} } }',
    })
    await makePublishableGenerator(tree, { project: 'lib-a', formats: ['esm', 'iife'], skipFormat: true })
    expect(readJson<{ targets: { build: unknown } }>(tree, 'libs/a/project.json').targets.build).toEqual({
      executor: '@acme/local:build',
      options: { esm: { bundleWorkspaceDeps: false }, cjs: {}, outputPath: 'out/a', iife: { entry: '.', globalName: 'AcmeA' } },
    })
  })

  it('makes the manifest publishable with what the root manifest gives and the defaults', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect(readJson(tree, 'libs/a/package.json')).toEqual({
      name: '@acme/a',
      version: '1.2.0',
      description: 'A.',
      exports: { '.': './src/index.js', './package.json': './package.json' },
      license: 'MIT',
      sideEffects: false,
      engines: { node: '>=18.0.0', npm: '>=8.0.0' },
      keywords: ['a', 'acme', 'typescript'],
      funding: { type: 'github', url: 'https://example.test/sponsor' },
    })
  })

  it('keeps the licence, the engines and the funding the package states', async () => {
    const tree = treeWith({
      'libs/a/package.json':
        '{ "name": "@acme/a", "license": "Apache-2.0", "engines": { "node": ">=22", "npm": ">=10", "bun": "1" }, "funding": "https://own.test" }',
    })
    await makePublishableGenerator(tree, { project: 'lib-a', nodeEngine: '>=20', skipFormat: true })
    expect(readJson(tree, 'libs/a/package.json')).toEqual(
      expect.objectContaining({ license: 'Apache-2.0', engines: { node: '>=22', npm: '>=10', bun: '1' }, funding: 'https://own.test' })
    )
  })

  it('declares the engine chosen, and no licence or funding where neither the package nor the root states one', async () => {
    const tree = treeWith({ 'package.json': '{}', 'libs/a/package.json': '{ "name": "@acme/a" }' })
    await makePublishableGenerator(tree, { project: 'lib-a', nodeEngine: '>=20', skipFormat: true })
    expect(readJson(tree, 'libs/a/package.json')).toEqual({
      name: '@acme/a',
      sideEffects: false,
      engines: { node: '>=20', npm: '>=8.0.0' },
      exports: { '.': './src/index.js', './package.json': './package.json' },
      keywords: ['a', 'acme', 'typescript'],
    })
  })

  it('writes a README where the project has none', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect(tree.read('libs/a/README.md', 'utf-8')).toBe(
      "# @acme/a\n\nA.\n\n## Installation\n\n```bash\nnpm install @acme/a\n```\n\n## Usage\n\n```typescript\nimport {} from '@acme/a'\n```\n"
    )
  })

  it('keeps the README the project has', async () => {
    const tree = treeWith({ 'libs/a/README.md': 'mine\n' })
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect(tree.read('libs/a/README.md', 'utf-8')).toBe('mine\n')
  })

  it('writes the e2e project with one suite per format', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual([
      'e2e/a/package.json',
      'e2e/a/project.json',
      'e2e/a/src/cjs.spec.ts',
      'e2e/a/src/esm.spec.ts',
      'e2e/a/tsconfig.json',
      'libs/a/package.json',
      'libs/a/project.json',
      'libs/a/README.md',
    ])
  })

  it('keeps the suites of an e2e project that exists before the library publishes', async () => {
    const tree = treeWith({
      'e2e/a/project.json':
        '{ "name": "e2e-lib-a", "targets": { "e2e": { "options": { "formats": ["cjs", "esm", { "name": "consumer", "specs": ["src/consumer.spec.ts"] }] } } } }',
      'e2e/a/src/esm.spec.ts': 'mine\n',
      'e2e/a/src/consumer.spec.ts': 'mine too\n',
    })
    await makePublishableGenerator(tree, { project: 'lib-a', formats: ['esm'], skipFormat: true })
    expect({
      esm: tree.read('e2e/a/src/esm.spec.ts', 'utf-8'),
      consumer: tree.read('e2e/a/src/consumer.spec.ts', 'utf-8'),
      project: readJson<{ targets: unknown }>(tree, 'e2e/a/project.json').targets,
      cjs: tree.exists('e2e/a/src/cjs.spec.ts'),
    }).toEqual({
      esm: 'mine\n',
      consumer: 'mine too\n',
      project: { e2e: { options: { formats: ['cjs', 'esm', { name: 'consumer', specs: ['src/consumer.spec.ts'] }] } } },
      cjs: false,
    })
  })

  it('writes the e2e project file naming the library and the formats', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', formats: ['esm', 'umd'], skipFormat: true })
    expect(readJson(tree, 'e2e/a/project.json')).toEqual({
      name: 'e2e-lib-a',
      description: 'E2E tests for @acme/a package outputs',
      sourceRoot: '{projectRoot}/src',
      projectType: 'application',
      targets: { e2e: { executor: '@hyperfrontend/workspace:e2e', dependsOn: ['^build'], options: { formats: ['esm', 'browser'] } } },
      implicitDependencies: ['lib-a'],
    })
  })

  it('pins the e2e package to the tarball of the version the library is at', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', e2eDirectory: 'apps/e2e', skipFormat: true })
    expect(readJson(tree, 'apps/e2e/a/package.json')).toEqual({
      name: '@acme/e2e-a',
      version: '0.0.0',
      private: true,
      description: 'E2E tests for @acme/a package outputs',
      dependencies: { '@acme/a': 'file:../../../tmp/e2e-packs/acme-a-1.2.0.tgz' },
    })
  })

  it('pins the e2e package to version 0.0.0 for a library without a version', async () => {
    const tree = treeWith({ 'libs/a/package.json': '{ "name": "@acme/a" }' })
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect(readJson<{ dependencies: unknown }>(tree, 'e2e/a/package.json').dependencies).toEqual({
      '@acme/a': 'file:../../tmp/e2e-packs/acme-a-0.0.0.tgz',
    })
  })

  it('writes the browser suites reading the bundles of the installed package under the global', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', formats: ['esm', 'cjs', 'iife', 'umd'], skipFormat: true })
    expect({
      iife: tree.read('e2e/a/src/iife.spec.ts', 'utf-8'),
      umd: tree.read('e2e/a/src/umd.spec.ts', 'utf-8'),
    }).toEqual({ iife: expect.stringContaining("target['AcmeA']"), umd: expect.stringContaining("bundle('index.umd.min.js')") })
  })

  it('keeps the e2e files of a project that already publishes', async () => {
    const tree = treeWith({
      'libs/a/project.json': '{ "name": "lib-a", "targets": { "publish": {} } }',
      'e2e/a/src/cjs.spec.ts': 'mine\n',
      'e2e/a/src/iife.spec.ts': 'browser\n',
    })
    await makePublishableGenerator(tree, { project: 'lib-a', skipFormat: true })
    expect({ cjs: tree.read('e2e/a/src/cjs.spec.ts', 'utf-8'), iife: tree.read('e2e/a/src/iife.spec.ts', 'utf-8') }).toEqual({
      cjs: 'mine\n',
      iife: 'browser\n',
    })
  })

  it('writes no e2e project when asked not to', async () => {
    const tree = treeWith()
    await makePublishableGenerator(tree, { project: 'lib-a', skipE2E: true, skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/a/package.json', 'libs/a/project.json', 'libs/a/README.md'])
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(FILES, { root: REPO_ROOT })
    await makePublishableGenerator(tree, { project: 'lib-a' })
    expect(tree.read('e2e/a/src/esm.spec.ts', 'utf-8')).toContain("describe('@acme/a ESM'")
  })
})
