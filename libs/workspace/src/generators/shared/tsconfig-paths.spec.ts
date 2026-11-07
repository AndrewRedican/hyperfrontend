import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from './tree'
import { addTsConfigPath, moveTsConfigPaths, renameTsConfigPaths, sortPaths } from './tsconfig-paths'

/**
 * The aliases a tree's base tsconfig holds.
 *
 * @param tree - The tree read
 * @returns The aliases by name
 */
function pathsOf(tree: ReturnType<typeof createMemoryTree>): Record<string, string[]> {
  return readJson<{ compilerOptions: { paths: Record<string, string[]> } }>(tree, 'tsconfig.base.json').compilerOptions.paths
}

const BASE =
  '{ "compilerOptions": { "paths": { "@acme/b": ["libs/b/src/index.ts"], "@acme/a/sub": ["libs/a/src/sub/index.ts"], "@acme/a": ["libs/a/src/index.ts"] } } }'

describe('sortPaths', () => {
  it('orders the aliases by name', () => {
    expect(sortPaths({ b: ['b'], a: ['a'] })).toEqual({ a: ['a'], b: ['b'] })
  })
})

describe('addTsConfigPath', () => {
  it('adds the alias of a project among the others, in order', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': BASE })
    addTsConfigPath(tree, { packageName: '@acme/aa', projectRoot: 'libs/aa' })
    expect(pathsOf(tree)).toEqual({
      '@acme/a': ['libs/a/src/index.ts'],
      '@acme/a/sub': ['libs/a/src/sub/index.ts'],
      '@acme/aa': ['libs/aa/src/index.ts'],
      '@acme/b': ['libs/b/src/index.ts'],
    })
  })

  it('starts the aliases where the base tsconfig has none', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': '{}' })
    addTsConfigPath(tree, { packageName: '@acme/a', projectRoot: 'libs/a' })
    expect(pathsOf(tree)).toEqual({ '@acme/a': ['libs/a/src/index.ts'] })
  })
})

describe('renameTsConfigPaths', () => {
  it('renames the package alias and its entries', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': BASE })
    renameTsConfigPaths(tree, { currentPackageName: '@acme/a', newPackageName: '@acme/z' })
    expect(pathsOf(tree)).toEqual({
      '@acme/b': ['libs/b/src/index.ts'],
      '@acme/z': ['libs/a/src/index.ts'],
      '@acme/z/sub': ['libs/a/src/sub/index.ts'],
    })
  })

  it('leaves a base tsconfig without aliases as it is', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': '{}' })
    renameTsConfigPaths(tree, { currentPackageName: '@acme/a', newPackageName: '@acme/z' })
    expect(pathsOf(tree)).toEqual({})
  })
})

describe('moveTsConfigPaths', () => {
  it('moves the aliases of the project and renames them when the name follows', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': BASE })
    moveTsConfigPaths(tree, {
      currentProjectRoot: 'libs/a',
      newProjectRoot: 'packages/a',
      currentPackageName: '@acme/a',
      newPackageName: '@acme/z',
      updateName: true,
    })
    expect(pathsOf(tree)).toEqual({
      '@acme/b': ['libs/b/src/index.ts'],
      '@acme/z': ['packages/a/src/index.ts'],
      '@acme/z/sub': ['packages/a/src/sub/index.ts'],
    })
  })

  it('moves the aliases under their names when the name stays', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': BASE })
    moveTsConfigPaths(tree, {
      currentProjectRoot: 'libs/a',
      newProjectRoot: 'packages/a',
      currentPackageName: '@acme/a',
      newPackageName: '@acme/a',
      updateName: false,
    })
    expect(pathsOf(tree)).toEqual({
      '@acme/a': ['packages/a/src/index.ts'],
      '@acme/a/sub': ['packages/a/src/sub/index.ts'],
      '@acme/b': ['libs/b/src/index.ts'],
    })
  })

  it('leaves a base tsconfig without aliases as it is', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': '{}' })
    moveTsConfigPaths(tree, {
      currentProjectRoot: 'libs/a',
      newProjectRoot: 'packages/a',
      currentPackageName: '@acme/a',
      newPackageName: '@acme/a',
      updateName: false,
    })
    expect(pathsOf(tree)).toEqual({})
  })
})
