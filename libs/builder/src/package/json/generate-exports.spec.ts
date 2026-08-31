import type { EntryPoint, EntryPointDiscovery, FormatOutputs, IifeConfig, PackageJson, UmdConfig } from '../../models'
import { describe, expect, it } from '@hyperfrontend/testing'
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

  it('does not advertise an IIFE CDN bundle in the exports map', () => {
    const iifeConfig: IifeConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [{ config: iifeConfig, entries: [ROOT] }], umd: [] }
    expect(generateExportsFromFormats(discovery, formats)).not.toHaveProperty('./bundle')
  })

  it('does not advertise a UMD CDN bundle in the exports map', () => {
    const umdConfig: UmdConfig = { globalName: 'X', output: 'dist-umd' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    expect(generateExportsFromFormats(discovery, formats)).not.toHaveProperty('./dist-umd')
  })
})
