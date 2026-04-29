import type { EntryPoint, FormatOutputs, IifeConfig, UmdConfig } from '../../models'
import { getCdnPaths } from './cdn-paths'

const ROOT: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }

describe('getCdnPaths', () => {
  it('returns undefined when neither UMD nor IIFE bundles were produced', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    expect(getCdnPaths(formats)).toBeUndefined()
  })

  it('returns the UMD bundle path when a UMD bundle is present', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    expect(getCdnPaths(formats)).toEqual({ unpkg: './bundle/index.umd.min.js', jsdelivr: './bundle/index.umd.min.js' })
  })

  it('honors a custom UMD output directory', () => {
    const umdConfig: UmdConfig = { globalName: 'X', output: 'cdn' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    expect(getCdnPaths(formats)).toEqual({ unpkg: './cdn/index.umd.min.js', jsdelivr: './cdn/index.umd.min.js' })
  })

  it('falls back to the IIFE bundle when no UMD bundle is present', () => {
    const iifeConfig: IifeConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [{ config: iifeConfig, entries: [ROOT] }], umd: [] }
    expect(getCdnPaths(formats)).toEqual({ unpkg: './bundle/index.iife.min.js', jsdelivr: './bundle/index.iife.min.js' })
  })

  it('honors a custom IIFE output directory when falling back', () => {
    const iifeConfig: IifeConfig = { globalName: 'X', output: 'iife-bundle' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [{ config: iifeConfig, entries: [ROOT] }], umd: [] }
    expect(getCdnPaths(formats)).toEqual({ unpkg: './iife-bundle/index.iife.min.js', jsdelivr: './iife-bundle/index.iife.min.js' })
  })

  it('prefers UMD over IIFE when both bundles are present', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const iifeConfig: IifeConfig = { globalName: 'X' }
    const formats: FormatOutputs = {
      esm: [],
      cjs: [],
      iife: [{ config: iifeConfig, entries: [ROOT] }],
      umd: [{ config: umdConfig, entries: [ROOT] }],
    }
    expect(getCdnPaths(formats)?.unpkg).toBe('./bundle/index.umd.min.js')
  })

  it('respects an explicit unpkg override and only that field', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    expect(getCdnPaths(formats, { unpkg: './custom/path.js' })).toEqual({
      unpkg: './custom/path.js',
      jsdelivr: './bundle/index.umd.min.js',
    })
  })

  it('respects an explicit jsdelivr override independently of unpkg', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    expect(getCdnPaths(formats, { jsdelivr: './custom/jsd.js' })).toEqual({
      unpkg: './bundle/index.umd.min.js',
      jsdelivr: './custom/jsd.js',
    })
  })
})
