import type { FileTree } from '@hyperfrontend/testing/fs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir, writeTree } from '@hyperfrontend/testing/fs'
import { collectBundledThirdPartyLicenses } from './collect-bundled'
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual<typeof import('@hyperfrontend/logging')>('@hyperfrontend/logging')
  return {
    ...actual,
    logger: { channel: jest.fn(() => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() })) },
  }
})

const isWorkspacePackage = (name: string): boolean => name.startsWith('@ws/')

describe('collectBundledThirdPartyLicenses', () => {
  const workspace = useTempDir({ prefix: 'builder-licenses-bundled-' })

  const collect = (tree: FileTree, external: string[] = []) => {
    writeTree(workspace.path, tree)
    return collectBundledThirdPartyLicenses({
      workspaceRoot: workspace.path,
      projectRoot: workspace.resolve('libs/app'),
      external,
      isWorkspacePackage,
    })
  }

  const names = (tree: FileTree, external: string[] = []): string[] => collect(tree, external).map((entry) => entry.name)

  it('records bundled dependencies and their transitive dependencies', () => {
    const tree = {
      'libs/app/package.json': { dependencies: { 'dep-a': '1' } },
      'node_modules/dep-a/package.json': { license: 'MIT', dependencies: { 'dep-b': '1' } },
      'node_modules/dep-b/package.json': { license: 'MIT' },
    }
    expect(names(tree)).toEqual(['dep-a', 'dep-b'])
  })

  it('records the dependencies of workspace packages without recording the workspace packages', () => {
    const tree = {
      'tsconfig.base.json': { compilerOptions: { paths: { '@ws/core': ['libs/core/src/index.ts'] } } },
      'libs/app/package.json': { dependencies: { '@ws/core': '1' } },
      'libs/core/package.json': { dependencies: { 'dep-a': '1' } },
      'libs/core/src/index.ts': '',
      'node_modules/dep-a/package.json': { license: 'MIT' },
    }
    expect(names(tree)).toEqual(['dep-a'])
  })

  it('locates a workspace package that exposes only sub-path mappings', () => {
    const tree = {
      'tsconfig.base.json': { compilerOptions: { paths: { '@ws/utils/string': ['libs/utils/src/string/index.ts'] } } },
      'libs/app/package.json': { dependencies: { '@ws/utils': '1' } },
      'libs/utils/package.json': { dependencies: { 'dep-a': '1' } },
      'libs/utils/src/string/index.ts': '',
      'node_modules/dep-a/package.json': { license: 'MIT' },
    }
    expect(names(tree)).toEqual(['dep-a'])
  })

  it('skips a workspace package whose mapped sources are missing', () => {
    const tree = {
      'tsconfig.base.json': { compilerOptions: { paths: { '@ws/core': ['libs/core/src/index.ts'] } } },
      'libs/app/package.json': { dependencies: { '@ws/core': '1' } },
    }
    expect(names(tree)).toEqual([])
  })

  it('skips a workspace package with no path mapping', () => {
    const tree = {
      'tsconfig.base.json': { compilerOptions: { paths: { '@ws/other': ['libs/other/src/index.ts'] } } },
      'libs/app/package.json': { dependencies: { '@ws/core': '1' } },
      'libs/other/package.json': { dependencies: { 'dep-a': '1' } },
      'libs/other/src/index.ts': '',
      'node_modules/dep-a/package.json': { license: 'MIT' },
    }
    expect(names(tree)).toEqual([])
  })

  it('stops at external packages without walking their dependencies', () => {
    const tree = {
      'libs/app/package.json': { dependencies: { tslib: '1', 'dep-a': '1' } },
      'node_modules/tslib/package.json': { license: '0BSD', dependencies: { 'dep-b': '1' } },
      'node_modules/dep-a/package.json': { license: 'MIT' },
      'node_modules/dep-b/package.json': { license: 'MIT' },
    }
    expect(names(tree, ['tslib'])).toEqual(['dep-a'])
  })

  it('reads a nested install in preference to the hoisted copy', () => {
    const tree = {
      'libs/app/package.json': { dependencies: { 'dep-a': '1' } },
      'node_modules/dep-a/package.json': { license: 'MIT', dependencies: { 'dep-b': '2' } },
      'node_modules/dep-a/node_modules/dep-b/package.json': { license: 'ISC' },
      'node_modules/dep-b/package.json': { license: 'MIT' },
    }
    expect(collect(tree).find((entry) => entry.name === 'dep-b')?.licenseType).toBe('ISC')
  })

  it('records a package reached through several dependents once', () => {
    const tree = {
      'libs/app/package.json': { dependencies: { 'dep-a': '1', 'dep-b': '1' } },
      'node_modules/dep-a/package.json': { license: 'MIT', dependencies: { 'dep-c': '1' } },
      'node_modules/dep-b/package.json': { license: 'MIT', dependencies: { 'dep-c': '1' } },
      'node_modules/dep-c/package.json': { license: 'MIT', dependencies: { 'dep-a': '1' } },
    }
    expect(names(tree)).toEqual(['dep-a', 'dep-b', 'dep-c'])
  })

  it('skips a dependency that is not installed', () => {
    expect(names({ 'libs/app/package.json': { dependencies: { missing: '1' } } })).toEqual([])
  })

  it('carries the license texts of each recorded package', () => {
    const tree = {
      'libs/app/package.json': { dependencies: { 'dep-a': '1' } },
      'node_modules/dep-a/package.json': { license: 'LGPL-3.0-only' },
      'node_modules/dep-a/COPYING.LESSER': 'lesser text',
    }
    expect(collect(tree)).toEqual([
      {
        name: 'dep-a',
        licenseType: 'LGPL-3.0-only',
        licenseUrl: null,
        licenseTexts: [{ fileName: 'COPYING.LESSER', content: 'lesser text' }],
      },
    ])
  })
})
