import type { FileTree } from '@hyperfrontend/testing/fs'
import type { ProjectRecord } from './model'
import { after as afterAll } from 'node:test'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { buildGraph } from './build'
import { libraryOfE2e, prerequisitesOf } from './depends-on'

/** A shop application importing two libraries and declaring a third, an e2e project per library, and targets using every form read. */
const TREE: FileTree = {
  'package.json': { name: '@fixture/workspace', private: true },
  'package-lock.json': { name: '@fixture/workspace', lockfileVersion: 3, packages: { '': { name: '@fixture/workspace' } } },
  'nx.json': { targetDefaults: { publish: { dependsOn: ['build'] } } },
  'tsconfig.base.json': {
    compilerOptions: { paths: { '@fixture/core': ['libs/core/src/index.ts'], '@fixture/util': ['libs/util/src/index.ts'] } },
  },
  'libs/core/project.json': { name: 'lib-core', projectType: 'library', targets: { build: {}, verify: {} } },
  'libs/core/src/index.ts': 'export const core = 1\n',
  'libs/util/project.json': { name: 'lib-util', projectType: 'library', targets: { build: {}, test: {} } },
  'libs/util/src/index.ts': 'export const util = 1\n',
  'libs/docs/project.json': { name: 'lib-docs', projectType: 'library', targets: { test: {} } },
  'apps/shop/project.json': {
    name: 'app-shop',
    projectType: 'application',
    implicitDependencies: ['lib-docs'],
    targets: {
      install: {},
      build: { dependsOn: ['install', 'lib-core:verify', '^build'] },
      publish: {},
      check: { dependsOn: [{ projects: ['lib-core'], target: 'build' }] },
      loop: { dependsOn: ['loop', 'nobody:build', 'lib-docs:build'] },
    },
  },
  'apps/shop/src/main.ts': "import { core } from '@fixture/core'\nimport { util } from '@fixture/util'\nexport const shop = core + util\n",
  'apps/core-e2e/project.json': {
    name: 'e2e-core',
    projectType: 'application',
    implicitDependencies: ['lib-core'],
    targets: { e2e: { dependsOn: ['^build'] } },
  },
  'apps/core-e2e/src/core.spec.ts': "import { util } from '@fixture/util'\nexport const used = util\n",
  'apps/docs-e2e/project.json': {
    name: 'e2e-docs',
    projectType: 'application',
    implicitDependencies: ['lib-docs'],
    targets: { e2e: { dependsOn: ['^build'] } },
  },
}

const directory = createTempDir({ prefix: 'depends-on-', tree: TREE })
const graph = buildGraph(directory.path, { files: keys(TREE) })

/**
 * A project of the fixture graph.
 *
 * @param name - Its name in the fixture, such as app-shop
 * @returns Its record, as the graph discovered it
 */
function project(name: string): ProjectRecord {
  return graph.projects.get(name) as ProjectRecord
}

afterAll(() => directory.remove())

describe('libraryOfE2e', () => {
  it('names the first implicit dependency with a build', () => {
    expect(libraryOfE2e(graph, project('e2e-core'))?.name).toBe('lib-core')
  })

  it('names nothing when no implicit dependency builds', () => {
    expect(libraryOfE2e(graph, project('e2e-docs'))).toBeNull()
  })
})

describe('prerequisitesOf', () => {
  it('reads target, project:target and ^target, in the order they are written', () => {
    expect(prerequisitesOf(graph, project('app-shop'), 'build').map((task) => task.id)).toEqual([
      'app-shop:install',
      'lib-core:verify',
      'lib-core:build',
      'lib-util:build',
    ])
  })

  it('answers each task with its project and target', () => {
    expect(prerequisitesOf(graph, project('app-shop'), 'build')[1]).toEqual({
      id: 'lib-core:verify',
      project: 'lib-core',
      target: 'verify',
    })
  })

  it('reads the workspace defaults when the project writes none', () => {
    expect(prerequisitesOf(graph, project('app-shop'), 'publish').map((task) => task.id)).toEqual(['app-shop:build'])
  })

  it("reads an e2e task's ^build as the build of the library it tests alone", () => {
    expect(prerequisitesOf(graph, project('e2e-core'), 'e2e').map((task) => task.id)).toEqual(['lib-core:build'])
  })

  it("reads an e2e task's ^build as nothing when it tests no library", () => {
    expect(prerequisitesOf(graph, project('e2e-docs'), 'e2e')).toEqual([])
  })

  it('names no task for itself, for a colon string whose first segment names no project, or for a project lacking the target', () => {
    expect(prerequisitesOf(graph, project('app-shop'), 'loop')).toEqual([])
  })

  it('refuses an entry in any other form', () => {
    expect(() => prerequisitesOf(graph, project('app-shop'), 'check')).toThrow(
      'app-shop:check depends on {"projects":["lib-core"],"target":"build"}, which is not one of the forms read: target, ^target or project:target'
    )
  })
})
