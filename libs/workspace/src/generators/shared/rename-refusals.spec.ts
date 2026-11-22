import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { assertRenameFree } from './rename-refusals'

const FILES = {
  'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@acme/core": ["libs/core/src/index.ts"] } } }',
  'libs/core/project.json': '{ "name": "core" }',
  'libs/core/package.json': '{ "name": "@acme/core" }',
  'libs/core-ui/project.json': '{ "name": "core-ui" }',
  'libs/core-ui/package.json': '{ "name": "@acme/core-ui" }',
  'libs/plain/project.json': '{ "name": "plain" }',
  'e2e/core/project.json': '{ "name": "e2e-core", "targets": { "e2e": {} }, "implicitDependencies": ["core"] }',
  'tools/x/project.json': '{ "name": "e2e-nucleus" }',
}

const CORE = {
  projectRoot: 'libs/core',
  currentProjectName: 'core',
  newProjectName: 'kernel',
  currentPackageName: '@acme/core',
  newPackageName: '@acme/kernel',
}

describe('assertRenameFree', () => {
  it('passes a rename to names nothing holds', () => {
    expect(() => assertRenameFree(createMemoryTree(FILES), CORE)).not.toThrow()
  })

  it('passes a project that keeps both of its names', () => {
    expect(() => assertRenameFree(createMemoryTree(FILES), { ...CORE, newProjectName: 'core', newPackageName: '@acme/core' })).not.toThrow()
  })

  it('refuses a project name another project holds', () => {
    expect(() => assertRenameFree(createMemoryTree(FILES), { ...CORE, newProjectName: 'plain' })).toThrow(
      "Project name already in use: 'plain' is the project at libs/plain"
    )
  })

  it('refuses a package name another package holds', () => {
    expect(() => assertRenameFree(createMemoryTree(FILES), { ...CORE, newPackageName: '@acme/core-ui' })).toThrow(
      "Package name already in use: '@acme/core-ui' is the package at libs/core-ui"
    )
  })

  it('refuses a name whose test project would take the name another project holds', () => {
    expect(() => assertRenameFree(createMemoryTree(FILES), { ...CORE, newProjectName: 'nucleus' })).toThrow(
      "Project name already in use: 'e2e-nucleus' is the project at tools/x"
    )
  })

  it('looks at no package name, and at no test project, for a project without a package', () => {
    expect(() =>
      assertRenameFree(createMemoryTree(FILES), {
        projectRoot: 'libs/plain',
        currentProjectName: 'plain',
        newProjectName: 'simple',
        currentPackageName: undefined,
        newPackageName: undefined,
      })
    ).not.toThrow()
  })
})
