import type { EntryPoint, EntryPointDiscovery, FormatOutputs, IifeConfig, PackageJson, UmdConfig } from '../../models'
import { generateExportsFromFormats } from './generate-exports'

const ROOT: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }
const BROWSER: EntryPoint = {
  exportPath: './browser',
  srcPath: 'browser',
  inputFile: '/abs/src/browser/index.ts',
  isRoot: false,
  platform: 'browser',
}

const discovery: EntryPointDiscovery = {
  category: 'hybrid',
  entryPoints: [ROOT, BROWSER],
  hasRootEntry: true,
  platformEntries: [BROWSER],
  featureEntries: [],
}

const noBundles: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }

describe('generateExportsFromFormats', () => {
  it('always emits the package.json self-reference', () => {
    const result = generateExportsFromFormats(discovery, noBundles)
    expect(result['./package.json']).toBe('./package.json')
  })

  it('falls back to a root export when srcPkg has no exports map', () => {
    const formats: FormatOutputs = { esm: [ROOT], cjs: [ROOT], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['.']).toEqual({ types: './index.d.ts', import: './index.esm.js', require: './index.cjs.js' })
  })

  it('skips the root fallback when discovery has no root entry', () => {
    const noRoot: EntryPointDiscovery = { ...discovery, hasRootEntry: false, entryPoints: [BROWSER] }
    const result = generateExportsFromFormats(noRoot, noBundles)
    expect(result['.']).toBeUndefined()
  })

  it('skips the root fallback when neither esm nor cjs landed at root', () => {
    const result = generateExportsFromFormats(discovery, noBundles)
    expect(result['.']).toBeUndefined()
  })

  it('honors the source exports map by mirroring its keys onto built outputs', () => {
    const srcPkg: PackageJson = {
      exports: {
        '.': './src/index.ts',
        './browser': './src/browser/index.ts',
        './package.json': './package.json',
      },
    }
    const formats: FormatOutputs = { esm: [ROOT, BROWSER], cjs: [ROOT, BROWSER], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats, srcPkg)
    expect(result['.']).toEqual({ types: './index.d.ts', import: './index.esm.js', require: './index.cjs.js' })
    expect(result['./browser']).toEqual({
      types: './browser/index.d.ts',
      import: './browser/index.esm.js',
      require: './browser/index.cjs.js',
    })
  })

  it('omits source-declared exports that have no matching format output', () => {
    const srcPkg: PackageJson = { exports: { './missing': './src/missing/index.ts' } }
    const result = generateExportsFromFormats(discovery, noBundles, srcPkg)
    expect(result['./missing']).toBeUndefined()
  })

  it('emits ESM-only entries when CJS was not produced', () => {
    const formats: FormatOutputs = { esm: [ROOT], cjs: [], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['.']).toEqual({ types: './index.d.ts', import: './index.esm.js' })
  })

  it('emits CJS-only entries when ESM was not produced', () => {
    const formats: FormatOutputs = { esm: [], cjs: [ROOT], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['.']).toEqual({ types: './index.d.ts', require: './index.cjs.js' })
  })

  it('extracts the output dir from a conditional source-export value', () => {
    const srcPkg: PackageJson = {
      exports: {
        './browser': { import: './src/browser/index.ts', require: './src/browser/index.ts' },
      },
    }
    const formats: FormatOutputs = { esm: [BROWSER], cjs: [BROWSER], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats, srcPkg)
    expect(result['./browser']).toEqual({
      types: './browser/index.d.ts',
      import: './browser/index.esm.js',
      require: './browser/index.cjs.js',
    })
  })

  it('uses the default condition when import / require are missing on a conditional entry', () => {
    const srcPkg: PackageJson = { exports: { '.': { default: './src/index.ts' } } }
    const formats: FormatOutputs = { esm: [ROOT], cjs: [], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats, srcPkg)
    expect(result['.']).toEqual({ types: './index.d.ts', import: './index.esm.js' })
  })

  it('treats a conditional entry with no recognized conditions as a missing source path', () => {
    const srcPkg: PackageJson = { exports: { './weird': { browser: { import: './src/index.ts' } } } }
    const formats: FormatOutputs = { esm: [ROOT], cjs: [], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats, srcPkg)
    expect(result['./weird']).toEqual({ types: './index.d.ts', import: './index.esm.js' })
  })

  it('skips the package.json self-reference when iterating source exports', () => {
    const srcPkg: PackageJson = { exports: { '.': './src/index.ts', './package.json': './package.json' } }
    const formats: FormatOutputs = { esm: [ROOT], cjs: [], iife: [], umd: [] }
    const result = generateExportsFromFormats(discovery, formats, srcPkg)
    expect(Object.keys(result).filter((k) => k === './package.json')).toHaveLength(1)
  })

  it('emits an IIFE export pointing at the minified twin', () => {
    const iifeConfig: IifeConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [{ config: iifeConfig, entries: [ROOT] }], umd: [] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['./bundle']).toEqual({ import: './bundle/index.iife.min.js', require: './bundle/index.iife.min.js' })
  })

  it('respects a custom IIFE output directory', () => {
    const iifeConfig: IifeConfig = { globalName: 'X', output: 'dist-iife' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [{ config: iifeConfig, entries: [ROOT] }], umd: [] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['./dist-iife']).toBeDefined()
  })

  it('emits a UMD export when no IIFE shadows the same bundle directory', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['./bundle']).toEqual({ import: './bundle/index.umd.min.js', require: './bundle/index.umd.min.js' })
  })

  it('keeps the IIFE entry when a UMD bundle would otherwise overwrite it', () => {
    const iifeConfig: IifeConfig = { globalName: 'X' }
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = {
      esm: [],
      cjs: [],
      iife: [{ config: iifeConfig, entries: [ROOT] }],
      umd: [{ config: umdConfig, entries: [ROOT] }],
    }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['./bundle']).toEqual({ import: './bundle/index.iife.min.js', require: './bundle/index.iife.min.js' })
  })

  it('respects a custom UMD output directory', () => {
    const umdConfig: UmdConfig = { globalName: 'X', output: 'dist-umd' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    const result = generateExportsFromFormats(discovery, formats)
    expect(result['./dist-umd']).toBeDefined()
  })
})
