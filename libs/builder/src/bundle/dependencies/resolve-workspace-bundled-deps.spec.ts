import type { TempDir } from '@hyperfrontend/testing/fs'
import { join, posix } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadWorkspacePathMappings, resolveWorkspaceBundledDeps } from './resolve-workspace-bundled-deps'

const isHyperfrontend = (n: string): boolean => n.startsWith('@hyperfrontend/')

interface SeedDepFixtureOptions {
  /** Workspace root directory. */
  workspace: TempDir
  /** Project-root directory of the dep, relative to `workspace`. */
  projectDir: string
  /** Source files to materialize, relative to `projectDir/src/`. */
  sources: string[]
}

const seedDep = ({ workspace, projectDir, sources }: SeedDepFixtureOptions): string[] => {
  workspace.write(join(projectDir, 'package.json'), { name: projectDir.replaceAll(posix.sep, '-') })
  workspace.write(join(projectDir, 'tsconfig.lib.json'), {
    compilerOptions: { module: 'es2022', target: 'es2022' },
    include: ['src/**/*.ts'],
  })
  return sources.map((source) => workspace.write(join(projectDir, source), 'export {}'))
}

describe('resolveWorkspaceBundledDeps', () => {
  const workspace = useTempDir({ prefix: 'builder-ws-deps-' })

  it('returns an empty list when the project declares no workspace deps', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { rollup: '*' } })
    workspace.write('tsconfig.base.json', {})
    expect(resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('enumerates the root for a root-only dep under the default sub-path policy', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    const [sourcePath] = seedDep({ workspace, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/logging': ['libs/logging/src/index.ts'],
          '@hyperfrontend/logging/internal': ['libs/logging/src/internal/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })
    expect(result).toEqual([
      {
        packageName: '@hyperfrontend/logging',
        subPath: '',
        specifier: '@hyperfrontend/logging',
        inputPath: sourcePath,
        tsConfigPath: workspace.resolve('libs/logging/tsconfig.lib.json'),
        policy: 'sub-path',
      },
    ])
  })

  it('collapses sub-paths onto the root when a dep is explicitly opted into whole-surface', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    const [rootPath] = seedDep({ workspace, projectDir: 'libs/logging', sources: ['src/index.ts', 'src/internal/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/logging': ['libs/logging/src/index.ts'],
          '@hyperfrontend/logging/internal': ['libs/logging/src/internal/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, {
      isWorkspacePackage: isHyperfrontend,
      policy: { '@hyperfrontend/logging': 'whole-surface' },
    })
    expect(result).toEqual([
      {
        packageName: '@hyperfrontend/logging',
        subPath: '',
        specifier: '@hyperfrontend/logging',
        inputPath: rootPath,
        tsConfigPath: workspace.resolve('libs/logging/tsconfig.lib.json'),
        policy: 'whole-surface',
      },
    ])
  })

  it('resolves a non-scoped workspace package and its sub-path under the default policy', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { mylib: '*' } })
    seedDep({ workspace, projectDir: 'libs/mylib', sources: ['src/index.ts', 'src/sub/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: { mylib: ['libs/mylib/src/index.ts'], 'mylib/sub': ['libs/mylib/src/sub/index.ts'] },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: (n) => n === 'mylib' })
    expect(result.map((r) => r.specifier)).toEqual(['mylib', 'mylib/sub'])
  })

  it('returns one entry per resolvable sub-path under the default sub-path policy', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/immutable-api-utils': '*' } })
    const [arrayPath, errorPath] = seedDep({
      workspace,
      projectDir: 'libs/utils/immutable-api',
      sources: ['src/built-in-copy/array/index.ts', 'src/built-in-copy/error/index.ts', 'src/index.ts'],
    })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/immutable-api-utils': ['libs/utils/immutable-api/src/index.ts'],
          '@hyperfrontend/immutable-api-utils/built-in-copy/array': ['libs/utils/immutable-api/src/built-in-copy/array/index.ts'],
          '@hyperfrontend/immutable-api-utils/built-in-copy/error': ['libs/utils/immutable-api/src/built-in-copy/error/index.ts'],
        },
      },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toEqual([
      expect.objectContaining({ specifier: '@hyperfrontend/immutable-api-utils' }),
      expect.objectContaining({
        specifier: '@hyperfrontend/immutable-api-utils/built-in-copy/array',
        subPath: 'built-in-copy/array',
        inputPath: arrayPath,
        tsConfigPath: workspace.resolve('libs/utils/immutable-api/tsconfig.lib.json'),
        policy: 'sub-path',
      }),
      expect.objectContaining({ specifier: '@hyperfrontend/immutable-api-utils/built-in-copy/error', inputPath: errorPath }),
    ])
  })

  it('falls back to tsconfig.json when the dep has no tsconfig.lib.json', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    workspace.write('libs/logging/package.json', { name: 'logging' })
    workspace.write('libs/logging/tsconfig.json', { compilerOptions: { module: 'es2022' } })
    workspace.write('libs/logging/src/index.ts', 'export {}')
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    const [entry] = resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })
    expect(entry?.tsConfigPath).toBe(workspace.resolve('libs/logging/tsconfig.json'))
  })

  it('throws when a dep source has no owning project (no package.json up the tree)', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    // context: no package.json or tsconfig anywhere up the dep's source tree
    workspace.write('orphan/src/index.ts', 'export {}')
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['orphan/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /no tsconfig.+was found in its project root/
    )
  })

  it('throws when a dep project root has no tsconfig.lib.json or tsconfig.json', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    workspace.write('libs/logging/package.json', { name: 'logging' })
    workspace.write('libs/logging/src/index.ts', 'export {}')
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /"@hyperfrontend\/logging"/
    )
  })

  it('skips sub-paths whose source file is missing on disk while keeping resolvable ones', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/immutable-api-utils': '*' } })
    seedDep({ workspace, projectDir: 'libs/utils/immutable-api', sources: ['src/built-in-copy/array/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/immutable-api-utils/built-in-copy/array': ['libs/utils/immutable-api/src/built-in-copy/array/index.ts'],
          '@hyperfrontend/immutable-api-utils/built-in-copy/missing': ['libs/utils/immutable-api/src/built-in-copy/missing/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/immutable-api-utils/built-in-copy/array'])
  })

  it('subtracts peerDependencies and skips workspace packages declared as peers', () => {
    const pkgPath = workspace.write('libs/foo/package.json', {
      dependencies: { '@hyperfrontend/logging': '*' },
      peerDependencies: { '@hyperfrontend/logging': '*' },
    })
    seedDep({ workspace, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('honours include for force-adding a workspace dep absent from dependencies', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: {} })
    seedDep({ workspace, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, {
      isWorkspacePackage: isHyperfrontend,
      include: ['@hyperfrontend/logging'],
    })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/logging'])
  })

  it('include cannot resurrect a non-workspace package', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: {} })
    workspace.write('tsconfig.base.json', { compilerOptions: { baseUrl: '.', paths: {} } })
    expect(
      resolveWorkspaceBundledDeps(pkgPath, workspace.path, {
        isWorkspacePackage: isHyperfrontend,
        include: ['rollup'],
      })
    ).toEqual([])
  })

  it('honours exclude for skipping a workspace dep', () => {
    const pkgPath = workspace.write('libs/foo/package.json', {
      dependencies: { '@hyperfrontend/logging': '*', '@hyperfrontend/versioning': '*' },
    })
    seedDep({ workspace, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    seedDep({ workspace, projectDir: 'libs/versioning', sources: ['src/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/logging': ['libs/logging/src/index.ts'],
          '@hyperfrontend/versioning': ['libs/versioning/src/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, {
      isWorkspacePackage: isHyperfrontend,
      exclude: ['@hyperfrontend/logging'],
    })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/versioning'])
  })

  it('throws when an eligible dep has no path-mapping table at all', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /has no.+tsconfig path mapping/
    )
  })

  it('throws when a declared dep name has no matching path entries', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/missing': '*' } })
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/other': ['libs/other/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /"@hyperfrontend\/missing"/
    )
  })

  it('resolves a subpath-only dep with zero configuration', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/string-utils': '*' } })
    seedDep({ workspace, projectDir: 'libs/utils/string', sources: ['src/browser/index.ts', 'src/node/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/string-utils/browser': ['libs/utils/string/src/browser/index.ts'],
          '@hyperfrontend/string-utils/node': ['libs/utils/string/src/node/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/string-utils/browser', '@hyperfrontend/string-utils/node'])
  })

  it('throws when a subpath-only dep is explicitly forced to whole-surface', () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/string-utils': '*' } })
    seedDep({ workspace, projectDir: 'libs/utils/string', sources: ['src/browser/index.ts', 'src/node/index.ts'] })
    workspace.write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/string-utils/browser': ['libs/utils/string/src/browser/index.ts'],
          '@hyperfrontend/string-utils/node': ['libs/utils/string/src/node/index.ts'],
        },
      },
    })
    expect(() =>
      resolveWorkspaceBundledDeps(pkgPath, workspace.path, {
        isWorkspacePackage: isHyperfrontend,
        policy: { '@hyperfrontend/string-utils': 'whole-surface' },
      })
    ).toThrow(/explicitly set to the 'whole-surface' hoist policy but is subpath-only/)
  })

  it("throws when a dep's only mapped source is missing on disk", () => {
    const pkgPath = workspace.write('libs/foo/package.json', { dependencies: { '@hyperfrontend/logging': '*' } })
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspace.path, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /"@hyperfrontend\/logging"/
    )
  })
})

describe('loadWorkspacePathMappings', () => {
  const workspace = useTempDir({ prefix: 'builder-ws-paths-' })

  it('reads paths from tsconfig.base.json', () => {
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    const map = loadWorkspacePathMappings(workspace.path)
    expect(map.get('@a/b')).toEqual([workspace.resolve('libs/a/b/src/index.ts')])
  })

  it('falls back to tsconfig.json when tsconfig.base.json is missing', () => {
    workspace.write('tsconfig.json', {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    expect(loadWorkspacePathMappings(workspace.path).get('@a/b')).toEqual([workspace.resolve('libs/a/b/src/index.ts')])
  })

  it('returns an empty map when neither tsconfig is present', () => {
    expect(loadWorkspacePathMappings(workspace.path).size).toBe(0)
  })

  it('follows extends chains and merges paths from inherited and local configs', () => {
    workspace.write('tsconfig.parent.json', {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    workspace.write('tsconfig.json', {
      extends: './tsconfig.parent.json',
      compilerOptions: { paths: { '@x/y': ['libs/x/y/src/index.ts'] } },
    })
    expect(Object.fromEntries(loadWorkspacePathMappings(workspace.path))).toEqual({
      '@a/b': [workspace.resolve('libs/a/b/src/index.ts')],
      '@x/y': [workspace.resolve('libs/x/y/src/index.ts')],
    })
  })

  it('returns the inherited table when a tsconfig has only extends', () => {
    workspace.write('tsconfig.parent.json', {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    workspace.write('tsconfig.json', { extends: './tsconfig.parent.json' })
    const map = loadWorkspacePathMappings(workspace.path)
    expect(map.get('@a/b')).toEqual([workspace.resolve('libs/a/b/src/index.ts')])
  })

  it('tolerates missing extends targets without throwing', () => {
    workspace.write('tsconfig.base.json', {
      extends: './missing.json',
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    expect(loadWorkspacePathMappings(workspace.path).get('@a/b')).toEqual([workspace.resolve('libs/a/b/src/index.ts')])
  })

  it('does not loop on cyclic extends', () => {
    workspace.write('tsconfig.a.json', { extends: './tsconfig.b.json' })
    workspace.write('tsconfig.b.json', { extends: './tsconfig.a.json' })
    expect(loadWorkspacePathMappings(workspace.path).size).toBe(0)
  })

  it('honours absolute paths in the tsconfig path entries', () => {
    const absSrc = workspace.write('libs/a/b/src/index.ts', '')
    workspace.write('tsconfig.base.json', {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': [absSrc] } },
    })
    expect(loadWorkspacePathMappings(workspace.path).get('@a/b')).toEqual([absSrc])
  })
})
