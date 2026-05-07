jest.mock('../externals/resolve-externals', () => ({
  resolveExternals: jest.fn(),
}))

import type { BinConfig, BuildContext, CjsConfig, EntryPoint, EsmConfig, IifeConfig, UmdConfig } from '../../models'
import { resolveExternals } from '../externals/resolve-externals'
import { toBinBuildDescriptor, toCjsBuildDescriptor, toEsmBuildDescriptor, toIifeBuildDescriptor, toUmdBuildDescriptor } from './descriptor'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/libs/foo/src/index.ts', isRoot: true }
const SUB_ENTRY: EntryPoint = {
  exportPath: './sub',
  srcPath: 'sub',
  inputFile: '/abs/libs/foo/src/sub/index.ts',
  isRoot: false,
}

const makeContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: { category: 'simple', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
  ...overrides,
})

beforeEach(() => {
  ;(<jest.Mock>resolveExternals).mockReset().mockReturnValue(['react'])
})

describe('toEsmBuildDescriptor', () => {
  it('produces a structurally complete descriptor for a root entry', () => {
    const config: EsmConfig = { bundleWorkspaceDeps: false }
    const descriptor = toEsmBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/report.json')
    expect(descriptor).toEqual({
      format: 'esm',
      inputFile: '/abs/libs/foo/src/index.ts',
      outputDir: '/abs/dist/libs/foo',
      external: ['react'],
      sourcemap: true,
      bundledDepsPlugin: null,
      workspaceRoutes: [],
      tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
      projectRoot: '/abs/libs/foo',
      workspaceRoot: '/abs/repo',
      bundleWorkspaceDeps: false,
      bundle: null,
      bin: null,
      reportPath: '/tmp/report.json',
    })
  })

  it('places sub-entry output under the entry srcPath', () => {
    const config: EsmConfig = { bundleWorkspaceDeps: false }
    const descriptor = toEsmBuildDescriptor(SUB_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.outputDir).toBe('/abs/dist/libs/foo/sub')
  })

  it('opts out of sourcemap when config.sourcemap is false', () => {
    const config: EsmConfig = { bundleWorkspaceDeps: false, sourcemap: false }
    const descriptor = toEsmBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.sourcemap).toBe(false)
  })

  it('emits a bundledDepsPlugin entry when bundleAllDeps is on and bundledDeps is non-empty', () => {
    const config: EsmConfig = { bundleWorkspaceDeps: false, bundleAllDeps: true }
    const ctx = makeContext({ bundledDeps: ['rollup', 'postject'] })
    const descriptor = toEsmBuildDescriptor(ROOT_ENTRY, config, ctx, '/tmp/r.json')
    expect(descriptor.bundledDepsPlugin).toEqual({ deps: ['rollup', 'postject'], depsRoot: '/abs/dist/libs/foo/_dependencies' })
  })

  it('omits the bundledDepsPlugin entry when bundleAllDeps is on but bundledDeps is empty', () => {
    const config: EsmConfig = { bundleWorkspaceDeps: false, bundleAllDeps: true }
    const descriptor = toEsmBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.bundledDepsPlugin).toBeNull()
  })

  it('flattens externals via resolveExternals using the config + context inputs', () => {
    const isWorkspacePackage = (n: string): boolean => n === '@hyperfrontend/foo'
    const config: EsmConfig = { bundleWorkspaceDeps: true, external: ['extra'] }
    const ctx = makeContext({ external: ['global-ext'], isWorkspacePackage })
    toEsmBuildDescriptor(ROOT_ENTRY, config, ctx, '/tmp/r.json')
    expect(resolveExternals).toHaveBeenCalledWith({
      packageJsonPath: '/abs/libs/foo/package.json',
      additional: ['global-ext', 'extra'],
      isWorkspacePackage,
      bundleWorkspaceDeps: true,
      bundledDeps: [],
    })
  })
})

describe('toCjsBuildDescriptor', () => {
  it('produces a CJS-formatted descriptor with the same shape rules as ESM', () => {
    const config: CjsConfig = { bundleWorkspaceDeps: false }
    const descriptor = toCjsBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.format).toBe('cjs')
    expect(descriptor.bundle).toBeNull()
    expect(descriptor.bundledDepsPlugin).toBeNull()
    expect(descriptor.external).toEqual(['react'])
  })

  it('threads bundleAllDeps through to the bundled-deps plugin config', () => {
    const config: CjsConfig = { bundleWorkspaceDeps: false, bundleAllDeps: true }
    const ctx = makeContext({ bundledDeps: ['rollup'] })
    const descriptor = toCjsBuildDescriptor(ROOT_ENTRY, config, ctx, '/tmp/r.json')
    expect(descriptor.bundledDepsPlugin).toEqual({ deps: ['rollup'], depsRoot: '/abs/dist/libs/foo/_dependencies' })
  })
})

describe('toIifeBuildDescriptor', () => {
  it('places output under the default `bundle` directory and validates externals lazily', () => {
    const config: IifeConfig = { globalName: 'MyLib' }
    const descriptor = toIifeBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.format).toBe('iife')
    expect(descriptor.outputDir).toBe('/abs/dist/libs/foo/bundle')
    expect(descriptor.external).toEqual([])
    expect(descriptor.bundle).toEqual({ globalName: 'MyLib', minify: true, globals: undefined })
  })

  it('honors the per-format output override', () => {
    const config: IifeConfig = { globalName: 'MyLib', output: 'iife-bundle' }
    const descriptor = toIifeBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.outputDir).toBe('/abs/dist/libs/foo/iife-bundle')
  })

  it('passes through external + globals when supplied', () => {
    const config: IifeConfig = { globalName: 'MyLib', external: ['react'], globals: { react: 'React' } }
    const descriptor = toIifeBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.external).toEqual(['react'])
    expect(descriptor.bundle?.globals).toEqual({ react: 'React' })
  })

  it('disables minify when config.minify is false', () => {
    const config: IifeConfig = { globalName: 'MyLib', minify: false }
    const descriptor = toIifeBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.bundle?.minify).toBe(false)
  })

  it('throws when external is declared without a matching globals entry', () => {
    const config: IifeConfig = { globalName: 'MyLib', external: ['react'] }
    expect(() => toIifeBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')).toThrow(/Missing globals mapping/)
  })
})

describe('toUmdBuildDescriptor', () => {
  it('emits a UMD descriptor including amdId when set', () => {
    const config: UmdConfig = { globalName: 'MyLib', amdId: 'mylib' }
    const descriptor = toUmdBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.format).toBe('umd')
    expect(descriptor.outputDir).toBe('/abs/dist/libs/foo/bundle')
    expect(descriptor.bundle).toEqual({ globalName: 'MyLib', minify: true, globals: undefined, amdId: 'mylib' })
  })

  it('omits amdId when not declared', () => {
    const config: UmdConfig = { globalName: 'MyLib' }
    const descriptor = toUmdBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.bundle?.amdId).toBeUndefined()
  })

  it('opts out of sourcemap when config.sourcemap is false', () => {
    const config: UmdConfig = { globalName: 'MyLib', sourcemap: false }
    const descriptor = toUmdBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')
    expect(descriptor.sourcemap).toBe(false)
  })

  it('throws when external is declared without a matching globals entry', () => {
    const config: UmdConfig = { globalName: 'MyLib', external: ['react'] }
    expect(() => toUmdBuildDescriptor(ROOT_ENTRY, config, makeContext(), '/tmp/r.json')).toThrow(/Missing globals mapping/)
  })
})

describe('toBinBuildDescriptor', () => {
  it('produces a CJS bin descriptor with shebang banner, bootstrap footer, and 0o755 chmod', () => {
    const bin: BinConfig = { name: 'cz', format: 'cjs', runner: 'runCz' }
    const descriptor = toBinBuildDescriptor(bin, makeContext(), 'cjs', ['cjs'], '/tmp/r.json')
    expect(descriptor.format).toBe('cjs')
    expect(descriptor.inputFile).toBe('/abs/libs/foo/src/bin/cz.ts')
    expect(descriptor.outputDir).toBe('/abs/dist/libs/foo/bin')
    expect(descriptor.external).toEqual([])
    expect(descriptor.sourcemap).toBe(false)
    expect(descriptor.bundleWorkspaceDeps).toBe(true)
    expect(descriptor.bundle).toBeNull()
    expect(descriptor.bin).toEqual({
      outputFile: '/abs/dist/libs/foo/bin/cz.js',
      banner: '#!/usr/bin/env node',
      footer: expect.stringContaining('runCz('),
      exports: 'named',
      inlineDynamicImports: true,
      chmod: 0o755,
    })
  })

  it('emits an ESM bin output as `<name>.mjs` with the ESM-flavored bootstrap footer', () => {
    const bin: BinConfig = { name: 'cz', format: 'esm' }
    const descriptor = toBinBuildDescriptor(bin, makeContext(), 'esm', ['esm'], '/tmp/r.json')
    expect(descriptor.format).toBe('esm')
    expect(descriptor.bin?.outputFile).toBe('/abs/dist/libs/foo/bin/cz.mjs')
    expect(descriptor.bin?.footer).toContain('await import(import.meta.url)')
  })

  it('uses `<name>.cjs.js` for the CJS output when ESM is also requested', () => {
    const bin: BinConfig = { name: 'hf-build', format: ['cjs', 'esm'] }
    const descriptor = toBinBuildDescriptor(bin, makeContext(), 'cjs', ['cjs', 'esm'], '/tmp/r.json')
    expect(descriptor.bin?.outputFile).toBe('/abs/dist/libs/foo/bin/hf-build.cjs.js')
  })

  it('honors a per-bin bootstrap override on the descriptor footer', () => {
    const bin: BinConfig = { name: 'cz', format: 'cjs', bootstrap: '// custom-footer' }
    const descriptor = toBinBuildDescriptor(bin, makeContext(), 'cjs', ['cjs'], '/tmp/r.json')
    expect(descriptor.bin?.footer).toBe('// custom-footer')
  })

  it('installs the externalize-bundled-deps plugin when context.bundledDeps is non-empty', () => {
    const bin: BinConfig = { name: 'hf-build', format: 'cjs' }
    const ctx = makeContext({ bundledDeps: ['rollup', 'terser'] })
    const descriptor = toBinBuildDescriptor(bin, ctx, 'cjs', ['cjs'], '/tmp/r.json')
    expect(descriptor.bundledDepsPlugin).toEqual({
      deps: ['rollup', 'terser'],
      depsRoot: '/abs/dist/libs/foo/_dependencies',
    })
  })

  it('omits the externalize-bundled-deps plugin when context.bundledDeps is empty', () => {
    const bin: BinConfig = { name: 'cz', format: 'cjs' }
    const descriptor = toBinBuildDescriptor(bin, makeContext(), 'cjs', ['cjs'], '/tmp/r.json')
    expect(descriptor.bundledDepsPlugin).toBeNull()
  })
})
