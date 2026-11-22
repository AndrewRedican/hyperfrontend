import type { MovePlan } from './move-helpers'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../../shared/tree'
import { carriedOver, updateContentReferences, updatePackageJson, updateProjectJson } from './move-helpers'

const MOVED = {
  'packages/kernel/project.json': '{ "name": "core", "description": "The @acme/core library, the base of @acme/core-ui" }',
  'packages/kernel/package.json': '{ "name": "@acme/core", "description": "The @acme/core library, the base of @acme/core-ui" }',
  'packages/kernel/README.md': '# @acme/core\n\nSee also @acme/core-ui and `@acme/core/testing`.\n',
  'packages/kernel/src/index.ts': "/**\n * @module @acme/core\n */\nexport * from '@acme/core-ui'\n",
}

const PLAN: MovePlan = {
  projectName: 'core',
  currentProjectRoot: 'libs/core',
  newProjectRoot: 'packages/kernel',
  newProjectName: 'kernel',
  currentPackageName: '@acme/core',
  newPackageName: '@acme/kernel',
  updateName: true,
  newOffsetFromRoot: '../../',
}

describe('updateProjectJson', () => {
  it('keeps the mention of a sibling whose package name starts with the renamed one in the description', () => {
    const tree = createMemoryTree(MOVED)
    updateProjectJson(tree, PLAN)
    expect(readJson(tree, 'packages/kernel/project.json')).toEqual({
      name: 'kernel',
      description: 'The @acme/kernel library, the base of @acme/core-ui',
    })
  })
})

describe('updatePackageJson', () => {
  it('keeps the mention of a sibling whose package name starts with the renamed one in the description', () => {
    const tree = createMemoryTree(MOVED)
    updatePackageJson(tree, PLAN)
    expect(readJson(tree, 'packages/kernel/package.json')).toEqual({
      name: '@acme/kernel',
      description: 'The @acme/kernel library, the base of @acme/core-ui',
    })
  })

  it('leaves a repository the manifest states as it is written, since the build writes the published one', () => {
    const tree = createMemoryTree({
      'packages/kernel/package.json':
        '{ "name": "@acme/core", "repository": { "url": "https://example.test/acme.git", "directory": "libs/core" } }',
    })
    updatePackageJson(tree, PLAN)
    expect(readJson(tree, 'packages/kernel/package.json')).toEqual({
      name: '@acme/kernel',
      repository: { url: 'https://example.test/acme.git', directory: 'libs/core' },
    })
  })

  it('leaves the manifest as it is written when the names do not follow the move', () => {
    const tree = createMemoryTree({ 'packages/kernel/package.json': '{"name":"@acme/core"}' })
    updatePackageJson(tree, { ...PLAN, newProjectName: 'core', newPackageName: '@acme/core', updateName: false })
    expect(tree.listChanges()).toEqual([])
  })

  it('writes nothing for a project without a package', () => {
    const tree = createMemoryTree({ 'packages/kernel/project.json': '{ "name": "core" }' })
    updatePackageJson(tree, { ...PLAN, currentPackageName: undefined, newPackageName: undefined })
    expect(tree.listChanges()).toEqual([])
  })
})

describe('updateContentReferences', () => {
  it('keeps the mentions of a sibling whose package name starts with the renamed one in the README and the entry', () => {
    const tree = createMemoryTree(MOVED)
    updateContentReferences(tree, PLAN)
    expect({ readme: tree.read('packages/kernel/README.md', 'utf-8'), entry: tree.read('packages/kernel/src/index.ts', 'utf-8') }).toEqual({
      readme: '# @acme/kernel\n\nSee also @acme/core-ui and `@acme/kernel/testing`.\n',
      entry: "/**\n * @module @acme/kernel\n */\nexport * from '@acme/core-ui'\n",
    })
  })
})

describe('carriedOver', () => {
  it('names the files under the new root that still hold what they were copied from', () => {
    const tree = createMemoryTree({
      'libs/core/project.json': '{ "name": "core" }',
      'libs/core/src/index.ts': 'export const core = 1\n',
      'libs/core/src/only-here.ts': 'export const left = 1\n',
      'packages/kernel/project.json': '{ "name": "kernel" }',
      'packages/kernel/src/index.ts': 'export const core = 1\n',
      'packages/kernel/src/added.ts': 'export const added = 1\n',
    })
    expect(carriedOver(tree, PLAN)).toEqual(['packages/kernel/src/index.ts'])
  })
})
