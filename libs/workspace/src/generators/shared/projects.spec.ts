import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { assertNewProject, assertPackageNameFree, assertProjectNameFree, getProjects, readProjectConfiguration } from './projects'

const tree = createMemoryTree({
  '.gitignore': 'node_modules\n',
  'libs/a/project.json': '{ "name": "lib-a", "tags": ["type:util"], "targets": { "build": {} } }',
  'tools/b/project.json': '{ "sourceRoot": "tools/b/src" }',
  'node_modules/pkg/project.json': '{ "name": "ignored" }',
})

describe('getProjects', () => {
  it('reads every project file git would keep, naming an unnamed one after its directory', () => {
    expect([...getProjects(tree).values()]).toEqual([
      { name: 'lib-a', root: 'libs/a', tags: ['type:util'], targets: { build: {} } },
      { name: 'b', root: 'tools/b', sourceRoot: 'tools/b/src' },
    ])
  })
})

describe('readProjectConfiguration', () => {
  it('returns the named project', () => {
    expect(readProjectConfiguration(tree, 'lib-a').root).toBe('libs/a')
  })

  it('names a project that is not there', () => {
    expect(() => readProjectConfiguration(tree, 'lib-z')).toThrow("Cannot find configuration for 'lib-z'")
  })
})

describe('assertNewProject', () => {
  it('passes a directory nothing is under and a name no project holds', () => {
    expect(() => assertNewProject(tree, 'apps/web', 'web')).not.toThrow()
  })

  it('refuses a directory that already holds files', () => {
    expect(() => assertNewProject(tree, 'libs/a', 'web')).toThrow('Destination already exists: libs/a')
  })

  it('refuses a name a project elsewhere holds, naming where that project is', () => {
    expect(() => assertNewProject(tree, 'apps/a', 'lib-a')).toThrow("Project name already in use: 'lib-a' is the project at libs/a")
  })

  it('refuses the name an unnamed project takes from its directory', () => {
    expect(() => assertNewProject(tree, 'apps/b', 'b')).toThrow("Project name already in use: 'b' is the project at tools/b")
  })
})

describe('assertProjectNameFree', () => {
  it('passes a name no project holds', () => {
    expect(() => assertProjectNameFree(tree, 'lib-z')).not.toThrow()
  })

  it('refuses a name a project holds, naming where that project is', () => {
    expect(() => assertProjectNameFree(tree, 'lib-a')).toThrow("Project name already in use: 'lib-a' is the project at libs/a")
  })
})

describe('assertPackageNameFree', () => {
  const packages = createMemoryTree({
    'tsconfig.base.json':
      '{ "compilerOptions": { "paths": { "@acme/core": ["libs/core/src/index.ts"], "@acme/vendored/testing": ["vendor/testing.ts"] } } }',
    'libs/core/project.json': '{ "name": "core" }',
    'libs/core/package.json': '{ "name": "@acme/core" }',
    'libs/plain/project.json': '{ "name": "plain" }',
    'apps/web/project.json': '{ "name": "web" }',
    'apps/web/package.json': '{ "name": "@acme/web" }',
  })

  it('passes a name no package states and no alias is written under', () => {
    expect(() => assertPackageNameFree(packages, '@acme/fresh', 'libs/fresh')).not.toThrow()
  })

  it("passes the name the project's own manifest states, where no alias is written under it", () => {
    expect(() => assertPackageNameFree(packages, '@acme/web', 'apps/web')).not.toThrow()
  })

  it("refuses a name another project's package states, naming where that package is", () => {
    expect(() => assertPackageNameFree(packages, '@acme/web', 'libs/fresh')).toThrow(
      "Package name already in use: '@acme/web' is the package at apps/web"
    )
  })

  it('refuses a name the base tsconfig holds an alias under, naming the alias', () => {
    expect(() => assertPackageNameFree(packages, '@acme/vendored', 'libs/fresh')).toThrow(
      "Package name already in use: '@acme/vendored/testing' is an alias in tsconfig.base.json"
    )
  })
})
