import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadWorkspacePathMappings, resolveWorkspaceBundledDeps, WORKSPACE_DEP_POLICY } from './resolve-workspace-bundled-deps'

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

  it('returns a single root entry for whole-surface deps with the dep tsconfig attached', () => {
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
      },
    ])
  })

  it('returns one entry per resolvable sub-path for sub-path-mode deps', () => {
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

  it('skips a dep whose package.json cannot be located by walking up from the source file', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    // context: no package.json or tsconfig anywhere up the dep's source tree
    writeFile(join(workspaceRoot, 'orphan/src/index.ts'), 'export {}')
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['orphan/src/index.ts'] } },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('skips a dep when its project root has no tsconfig.lib.json or tsconfig.json', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    writeJson(join(workspaceRoot, 'libs/logging/package.json'), { name: 'logging' })
    writeFile(join(workspaceRoot, 'libs/logging/src/index.ts'), 'export {}')
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('skips sub-paths whose source file is missing on disk', () => {
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

  it('returns an empty list when no path-mapping table is found', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('skips deps whose package name has no matching path entries', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/missing': '*' } })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/other': ['libs/other/src/index.ts'] } },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
  })

  it('falls back to whole-surface mode when a sub-path-mode dep has no resolvable root', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/immutable-api-utils': '*' } })
    seedDep({ workspaceRoot, projectDir: 'libs/utils/immutable-api', sources: ['src/built-in-copy/array/index.ts'] })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@hyperfrontend/immutable-api-utils/built-in-copy/array': ['libs/utils/immutable-api/src/built-in-copy/array/index.ts'],
        },
      },
    })
    const result = resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })
    expect(result.map((r) => r.specifier)).toEqual(['@hyperfrontend/immutable-api-utils/built-in-copy/array'])
  })

  it('skips whole-surface deps whose root entry is not on disk', () => {
    const pkgPath = join(workspaceRoot, 'libs/foo/package.json')
    writeJson(pkgPath, { dependencies: { '@hyperfrontend/logging': '*' } })
    writeJson(join(workspaceRoot, 'tsconfig.base.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } },
    })
    expect(resolveWorkspaceBundledDeps(pkgPath, workspaceRoot, { isWorkspacePackage: isHyperfrontend })).toEqual([])
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

describe('WORKSPACE_DEP_POLICY', () => {
  it('declares immutable-api-utils as the canonical sub-path mode dep', () => {
    expect(WORKSPACE_DEP_POLICY['@hyperfrontend/immutable-api-utils']).toBe('sub-path')
  })
})
