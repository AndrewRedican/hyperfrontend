import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getPackageNameFromProject, readPackageJsonInfo, readRootManifest } from './package-json'

const tree = createMemoryTree({
  'package.json': '{ "name": "@acme/monorepo", "license": "MIT" }',
  'libs/a/package.json': '{ "name": "@acme/a", "description": "A", "keywords": ["a", 1] }',
  'libs/b/package.json': '{ "version": "1.0.0" }',
  'libs/c/package.json': '',
})

describe('readPackageJsonInfo', () => {
  it('reads the name, the description and the string keywords', () => {
    expect(readPackageJsonInfo(tree, 'libs/a')).toEqual({ name: '@acme/a', description: 'A', keywords: ['a'] })
  })

  it('answers no name, an empty description and no keywords for a manifest without them', () => {
    expect(readPackageJsonInfo(tree, 'libs/b')).toEqual({ name: null, description: '', keywords: [] })
  })

  it('answers nothing for a project without a manifest', () => {
    expect(readPackageJsonInfo(tree, 'libs/none')).toEqual({ name: null, description: '', keywords: [] })
  })

  it('answers nothing for an empty manifest', () => {
    expect(readPackageJsonInfo(tree, 'libs/c')).toEqual({ name: null, description: '', keywords: [] })
  })
})

describe('getPackageNameFromProject', () => {
  it('reads the name', () => {
    expect(getPackageNameFromProject(tree, 'libs/a')).toBe('@acme/a')
  })
})

describe('readRootManifest', () => {
  it('reads the root manifest', () => {
    expect(readRootManifest(tree)).toEqual({ name: '@acme/monorepo', license: 'MIT' })
  })

  it('answers nothing where the tree has none', () => {
    expect(readRootManifest(createMemoryTree())).toEqual({})
  })
})
