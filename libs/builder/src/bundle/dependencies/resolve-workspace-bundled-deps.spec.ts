import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { loadWorkspacePathMappings, resolveWorkspaceBundledDeps } from './resolve-workspace-bundled-deps'

const writeFile = (p: string, contents: string): void => {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, contents)
}

const writeJson = (p: string, contents: object): void => writeFile(p, JSON.stringify(contents))

const isHyperfrontend = (n: string): boolean => n.startsWith('@hyperfrontend/')

interface SeedDepFixtureOptions {
  /** Workspace root directory. */
  workspaceRoot: string
  /** Project-root directory of the dep, relative to `workspaceRoot`. */
  projectDir: string
  /** Source files to materialize, relative to `projectDir/src/`. */
  sources: string[]
}

const seedDep = ({ workspaceRoot, projectDir, sources }: SeedDepFixtureOptions): string[] => {
  writeJson(join(workspaceRoot, projectDir, 'package.json'), { name: projectDir.replace(/\//g, '-') })
  writeJson(join(workspaceRoot, projectDir, 'tsconfig.lib.json'), {
    compilerOptions: { module: 'es2022', target: 'es2022' },
    include: ['src/**/*.ts'],
  })
  return sources.map((source) => {
    const absolute = join(workspaceRoot, projectDir, source)
    writeFile(absolute, 'export {}')
    return absolute
  })
}

describe('resolveWorkspaceBundledDeps', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-ws-deps-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('returns an empty list when the project declares no workspace deps', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { rollup: '*' } })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {})
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('enumerates the root for a root-only dep under the default sub-path policy', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    const [sourcePath] = seedDep({ workspaceRoot, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/logging': ['libs/logging/src/index.ts'],
          '@hyperfrontend/logging/internal': ['libs/logging/src/internal/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })
    expect(result).toEqual([
      {
        packageName: '@hyperfrontend/logging',
        subPath: '',
        specifier: '@hyperfrontend/logging',
        inputPath: sourcePath,
        tsConfigPath: join(workspaceRoot, 'libs/logging/tsconfig.lib.json'),
        policy: 'sub-path',
      },
    ])
  })

  it('collapses sub-paths onto the root when a dep is explicitly opted into whole-surface', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    const [rootPath] = seedDep({ workspaceRoot, projectDir: 'libs/logging', sources: ['src/index.ts', 'src/internal/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/logging': ['libs/logging/src/index.ts'],
          '@hyperfrontend/logging/internal': ['libs/logging/src/internal/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, {
      isWorkspacePackage: isHyperfrontend,
      policy: { '@hyperfrontend/logging': 'whole-surface' },
    })
    expect(result).toEqual([
      {
        packageName: '@hyperfrontend/logging',
        subPath: '',
        specifier: '@hyperfrontend/logging',
        inputPath: rootPath,
        tsConfigPath: join(workspaceRoot, 'libs/logging/tsconfig.lib.json'),
        policy: 'whole-surface',
      },
    ])
  })

  it('resolves a non-scoped workspace package and its sub-path under the default policy', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { mylib: '*' } })
    seedDep({ workspaceRoot, projectDir: 'libs/mylib', sources: ['src/index.ts', 'src/sub/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: { mylib: ['libs/mylib/src/index.ts'], 'mylib/sub': ['libs/mylib/src/sub/index.ts'] },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: (n) => n === 'mylib' })
    expect(result.map((r) => r.specifier)).toEqual(['mylib', 'mylib/sub'])
  })

  it('returns one entry per resolvable sub-path under the default sub-path policy', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/immutable-api-utils': '*' } })
    const [arrayPath, errorPath] = seedDep({
      workspaceRoot,
      projectDir: 'libs/utils/immutable-api',
      sources: ['src/built-in-copy/array/index.ts', 'src/built-in-copy/error/index.ts', 'src/index.ts'],
    })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/immutable-api-utils': ['libs/utils/immutable-api/src/index.ts'],
          '@hyperfrontend/immutable-api-utils/built-in-copy/array': ['libs/utils/immutable-api/src/built-in-copy/array/index.ts'],
          '@hyperfrontend/immutable-api-utils/built-in-copy/error': ['libs/utils/immutable-api/src/built-in-copy/error/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.specifier)).toEqual([
      '@hyperfrontend/immutable-api-utils',
      '@hyperfrontend/immutable-api-utils/built-in-copy/array',
      '@hyperfrontend/immutable-api-utils/built-in-copy/error',
    ])
    expect(result[1]).toMatchObject({
      subPath: 'built-in-copy/array',
      inputPath: arrayPath,
      tsConfigPath: join(workspaceRoot, 'libs/utils/immutable-api/tsconfig.lib.json'),
      policy: 'sub-path',
    })
    expect(result[2]?.inputPath).toBe(errorPath)
  })

  it('falls back to tsconfig.json when the dep has no tsconfig.lib.json', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    writeJson(join(workspaceRoot, 'libs/logging/package.json'), { name: 'logging' })
    writeJson(join(workspaceRoot, 'libs/logging/tsconfig.json'), { compilerOptions: { module: 'es2022' } })
    writeFile(join(workspaceRoot, 'libs/logging/src/index.ts'), 'export {}')
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    const [entry] = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })
    expect(entry?.tsConfigPath).toBe(join(workspaceRoot, 'libs/logging/tsconfig.json'))
  })

  it('throws when a dep source has no owning project (no package.json up the tree)', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    // context: no package.json or tsconfig anywhere up the dep's source tree
    writeFile(join(workspaceRoot, 'orphan/src/index.ts'), 'export {}')
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['orphan/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /no tsconfig.+was found in its project root/
    )
  })

  it('throws when a dep project root has no tsconfig.lib.json or tsconfig.json', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    writeJson(join(workspaceRoot, 'libs/logging/package.json'), { name: 'logging' })
    writeFile(join(workspaceRoot, 'libs/logging/src/index.ts'), 'export {}')
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /"@hyperfrontend\/logging"/
    )
  })

  it('skips sub-paths whose source file is missing on disk while keeping resolvable ones', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/immutable-api-utils': '*' } })
    seedDep({ workspaceRoot, projectDir: 'libs/utils/immutable-api', sources: ['src/built-in-copy/array/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/immutable-api-utils/built-in-copy/array': ['libs/utils/immutable-api/src/built-in-copy/array/index.ts'],
          '@hyperfrontend/immutable-api-utils/built-in-copy/missing': ['libs/utils/immutable-api/src/built-in-copy/missing/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/immutable-api-utils/built-in-copy/array'])
  })

  it('subtracts peerDependencies and skips workspace packages declared as peers', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, {
      dependencies: { '@hyperfrontend/logging': '*' },
      peerDependencies: { '@hyperfrontend/logging': '*' },
    })
    seedDep({ workspaceRoot, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('honours include for force-adding a workspace dep absent from dependencies', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: {} })
    seedDep({ workspaceRoot, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, {
      isWorkspacePackage: isHyperfrontend,
      include: ['@hyperfrontend/logging'],
    })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/logging'])
  })

  it('include cannot resurrect a non-workspace package', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: {} })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), { compilerOptions: { baseUrl: '.', paths: {} } })
    expect(
      resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, {
        isWorkspacePackage: isHyperfrontend,
        include: ['rollup'],
      })
    ).toEqual([])
  })

  it('honours exclude for skipping a workspace dep', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*', '@hyperfrontend/versioning': '*' } })
    seedDep({ workspaceRoot, projectDir: 'libs/logging', sources: ['src/index.ts'] })
    seedDep({ workspaceRoot, projectDir: 'libs/versioning', sources: ['src/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/logging': ['libs/logging/src/index.ts'],
          '@hyperfrontend/versioning': ['libs/versioning/src/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, {
      isWorkspacePackage: isHyperfrontend,
      exclude: ['@hyperfrontend/logging'],
    })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/versioning'])
  })

  it('throws when an eligible dep has no path-mapping table at all', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /has no.+tsconfig path mapping/
    )
  })

  it('throws when a declared dep name has no matching path entries', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/missing': '*' } })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/other': ['libs/other/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /"@hyperfrontend\/missing"/
    )
  })

  it('resolves a subpath-only dep with zero configuration', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/string-utils': '*' } })
    seedDep({ workspaceRoot, projectDir: 'libs/utils/string', sources: ['src/browser/index.ts', 'src/node/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/string-utils/browser': ['libs/utils/string/src/browser/index.ts'],
          '@hyperfrontend/string-utils/node': ['libs/utils/string/src/node/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/string-utils/browser', '@hyperfrontend/string-utils/node'])
  })

  it('throws when a subpath-only dep is explicitly forced to whole-surface', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/string-utils': '*' } })
    seedDep({ workspaceRoot, projectDir: 'libs/utils/string', sources: ['src/browser/index.ts', 'src/node/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/string-utils/browser': ['libs/utils/string/src/browser/index.ts'],
          '@hyperfrontend/string-utils/node': ['libs/utils/string/src/node/index.ts'],
        },
      },
    })
    expect(() =>
      resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, {
        isWorkspacePackage: isHyperfrontend,
        policy: { '@hyperfrontend/string-utils': 'whole-surface' },
      })
    ).toThrow(/explicitly set to the 'whole-surface' hoist policy but is subpath-only/)
  })

  it("throws when a dep's only mapped source is missing on disk", () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(() => resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toThrow(
      /"@hyperfrontend\/logging"/
    )
  })
})

describe('loadWorkspacePathMappings', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-ws-paths-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('reads paths from tsconfig.base.json', () => {
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    const map = loadWorkspacePathMappings(workspaceRoot)
    expect(map.get('@a/b')).toEqual([join(workspaceRoot, 'libs/a/b/src/index.ts')])
  })

  it('falls back to tsconfig.json when tsconfig.base.json is missing', () => {
    writeJson(join(workspaceRoot, 'tsconfig.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    expect(loadWorkspacePathMappings(workspaceRoot).get('@a/b')).toEqual([join(workspaceRoot, 'libs/a/b/src/index.ts')])
  })

  it('returns an empty map when neither tsconfig is present', () => {
    expect(loadWorkspacePathMappings(workspaceRoot).size).toBe(0)
  })

  it('follows extends chains and merges paths from inherited and local configs', () => {
    writeJson(join(workspaceRoot, 'tsconfig.parent.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    writeJson(join(workspaceRoot, 'tsconfig.json'), {
      extends: './tsconfig.parent.json',
      compilerOptions: { paths: { '@x/y': ['libs/x/y/src/index.ts'] } },
    })
    const map = loadWorkspacePathMappings(workspaceRoot)
    expect(map.get('@a/b')).toEqual([join(workspaceRoot, 'libs/a/b/src/index.ts')])
    expect(map.get('@x/y')).toEqual([join(workspaceRoot, 'libs/x/y/src/index.ts')])
  })

  it('returns the inherited table when a tsconfig has only extends', () => {
    writeJson(join(workspaceRoot, 'tsconfig.parent.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    writeJson(join(workspaceRoot, 'tsconfig.json'), { extends: './tsconfig.parent.json' })
    const map = loadWorkspacePathMappings(workspaceRoot)
    expect(map.get('@a/b')).toEqual([join(workspaceRoot, 'libs/a/b/src/index.ts')])
  })

  it('tolerates missing extends targets without throwing', () => {
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      extends: './missing.json',
      compilerOptions: { baseUrl: '.', paths: { '@a/b': ['libs/a/b/src/index.ts'] } },
    })
    expect(loadWorkspacePathMappings(workspaceRoot).get('@a/b')).toEqual([join(workspaceRoot, 'libs/a/b/src/index.ts')])
  })

  it('does not loop on cyclic extends', () => {
    writeJson(join(workspaceRoot, 'tsconfig.a.json'), { extends: './tsconfig.b.json' })
    writeJson(join(workspaceRoot, 'tsconfig.b.json'), { extends: './tsconfig.a.json' })
    expect(loadWorkspacePathMappings(workspaceRoot).size).toBe(0)
  })

  it('honours absolute paths in the tsconfig path entries', () => {
    const absSrc = join(workspaceRoot, 'libs/a/b/src/index.ts')
    writeFile(absSrc, '')
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@a/b': [absSrc] } },
    })
    expect(loadWorkspacePathMappings(workspaceRoot).get('@a/b')).toEqual([absSrc])
  })
})
