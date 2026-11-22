import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from './tree'
import { addTsConfigPath, aliasesOf, moveTsConfigPaths, renameTsConfigPaths, sortPaths } from './tsconfig-paths'

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

const SIBLINGS =
  '{ "compilerOptions": { "paths": { "@acme/core": ["libs/core/src/index.ts"], "@acme/core-ui": ["libs/core-ui/src/index.ts"], "@acme/corex": ["libs/corex/src/index.ts"] } } }'

const MOVE_CORE = {
  currentProjectRoot: 'libs/core',
  newProjectRoot: 'packages/core',
  currentPackageName: '@acme/core',
  newPackageName: '@acme/core',
  updateName: false,
}

/**
 * A tree whose base tsconfig holds one alias.
 *
 * @param alias - The specifier the paths are mapped under
 * @param values - The paths it resolves to, none needing an escape in JSON
 * @returns A tree holding that base tsconfig alone
 */
function treeWithAlias(alias: string, values: readonly string[]): ReturnType<typeof createMemoryTree> {
  return createMemoryTree({
    'tsconfig.base.json': `{ "compilerOptions": { "paths": { "${alias}": [${values.map((value) => `"${value}"`).join(', ')}] } } }`,
  })
}

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

describe('aliasesOf', () => {
  it('names the alias of a package and its entries in the order they are written, a sibling whose name starts with it left out', () => {
    const tree = createMemoryTree({
      'tsconfig.base.json':
        '{ "compilerOptions": { "paths": { "@acme/core/testing": ["a.ts"], "@acme/core-ui": ["b.ts"], "@acme/core": ["c.ts"] } } }',
    })
    expect(aliasesOf(tree, '@acme/core')).toEqual(['@acme/core/testing', '@acme/core'])
  })

  it.each([
    ['holds no alias under the name', { 'tsconfig.base.json': BASE }],
    ['holds no aliases', { 'tsconfig.base.json': '{ "compilerOptions": {} }' }],
    ['states no compiler options', { 'tsconfig.base.json': '{}' }],
    ['is not there', {}],
  ])('names none where the base tsconfig %s', (_case, files) => {
    expect(aliasesOf(createMemoryTree(files), '@acme/core')).toEqual([])
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
    expect(tree.listChanges()).toEqual([])
  })

  it('leaves a base tsconfig that holds no alias of the package as it is written, in the order it lists the others', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': BASE })
    renameTsConfigPaths(tree, { currentPackageName: '@acme/c', newPackageName: '@acme/z' })
    expect(tree.read('tsconfig.base.json', 'utf-8')).toBe(BASE)
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

  it('leaves the aliases of a project whose directory name merely starts with the moved one where they are', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': SIBLINGS })
    moveTsConfigPaths(tree, MOVE_CORE)
    expect(pathsOf(tree)).toEqual({
      '@acme/core': ['packages/core/src/index.ts'],
      '@acme/core-ui': ['libs/core-ui/src/index.ts'],
      '@acme/corex': ['libs/corex/src/index.ts'],
    })
  })

  it('leaves such a sibling under its name and its directory when the moved project is renamed too', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': SIBLINGS })
    moveTsConfigPaths(tree, { ...MOVE_CORE, newProjectRoot: 'packages/kernel', newPackageName: '@acme/kernel', updateName: true })
    expect(pathsOf(tree)).toEqual({
      '@acme/core-ui': ['libs/core-ui/src/index.ts'],
      '@acme/corex': ['libs/corex/src/index.ts'],
      '@acme/kernel': ['packages/kernel/src/index.ts'],
    })
  })

  it('moves an alias that resolves to the project directory itself', () => {
    const tree = treeWithAlias('@acme/core', ['libs/core'])
    moveTsConfigPaths(tree, MOVE_CORE)
    expect(pathsOf(tree)).toEqual({ '@acme/core': ['packages/core'] })
  })

  it('leaves a path outside the project alone among the paths of a moved alias', () => {
    const tree = treeWithAlias('@acme/core', ['libs/core/src/index.ts', 'vendor/libs/core-shim/index.ts', 'vendor/libs/core/index.ts'])
    moveTsConfigPaths(tree, MOVE_CORE)
    expect(pathsOf(tree)).toEqual({
      '@acme/core': ['packages/core/src/index.ts', 'vendor/libs/core-shim/index.ts', 'vendor/libs/core/index.ts'],
    })
  })

  it('moves a path written from the current directory, keeping it written that way', () => {
    const tree = treeWithAlias('@acme/core/*', ['./libs/core/src/*'])
    moveTsConfigPaths(tree, MOVE_CORE)
    expect(pathsOf(tree)).toEqual({ '@acme/core/*': ['./packages/core/src/*'] })
  })

  it('leaves a sibling path written from the current directory where it is', () => {
    const tree = treeWithAlias('@acme/core-ui', ['./libs/core-ui/src/index.ts'])
    moveTsConfigPaths(tree, MOVE_CORE)
    expect(pathsOf(tree)).toEqual({ '@acme/core-ui': ['./libs/core-ui/src/index.ts'] })
  })

  it('moves the alias of a project nested under the moved one, under its own name', () => {
    const tree = treeWithAlias('@acme/plugin', ['libs/core/plugins/x/src/index.ts'])
    moveTsConfigPaths(tree, { ...MOVE_CORE, newProjectRoot: 'packages/kernel', newPackageName: '@acme/kernel', updateName: true })
    expect(pathsOf(tree)).toEqual({ '@acme/plugin': ['packages/kernel/plugins/x/src/index.ts'] })
  })

  it('renames the aliases of a project that stays in its directory', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': SIBLINGS })
    moveTsConfigPaths(tree, { ...MOVE_CORE, newProjectRoot: 'libs/core', newPackageName: '@acme/kernel', updateName: true })
    expect(pathsOf(tree)).toEqual({
      '@acme/core-ui': ['libs/core-ui/src/index.ts'],
      '@acme/corex': ['libs/corex/src/index.ts'],
      '@acme/kernel': ['libs/core/src/index.ts'],
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
    expect(tree.listChanges()).toEqual([])
  })

  it('leaves a base tsconfig that holds no alias under the project as it is written, in the order it lists the others', () => {
    const tree = createMemoryTree({ 'tsconfig.base.json': BASE })
    moveTsConfigPaths(tree, {
      currentProjectRoot: 'apps/web',
      newProjectRoot: 'sites/web',
      currentPackageName: '@acme/web',
      newPackageName: '@acme/site',
      updateName: true,
    })
    expect(tree.read('tsconfig.base.json', 'utf-8')).toBe(BASE)
  })
})
