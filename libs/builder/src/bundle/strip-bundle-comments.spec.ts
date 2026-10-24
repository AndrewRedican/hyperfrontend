import type { FormatOutputs, IifeConfig, IifeOutput, UmdConfig, UmdOutput } from '../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { stripBundleCommentsPass } from './strip-bundle-comments'

const PRAGMA = '// lint-disable-next-line workspace/no-unsafe-builtin-methods'
const CODE = 'var MyLib = { value: 1 };\n'

describe('stripBundleCommentsPass', () => {
  const outputDir = useTempDir({ prefix: 'builder-bundle-strip-' })

  const iifeOutput = (config: Partial<IifeConfig> = {}): IifeOutput => ({
    config: { globalName: 'MyLib', ...config } as IifeConfig,
    entries: [],
  })

  const umdOutput = (config: Partial<UmdConfig> = {}): UmdOutput => ({
    config: { globalName: 'MyLib', ...config } as UmdConfig,
    entries: [],
  })

  const outputsOf = (overrides: Partial<FormatOutputs>): FormatOutputs => ({ esm: [], cjs: [], iife: [], umd: [], ...overrides })

  it('strips lint pragmas from the non-minified IIFE output', () => {
    outputDir.write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputDir.path, outputsOf({ iife: [iifeOutput()] }))
    expect(outputDir.read('bundle/index.iife.js')).toBe(CODE)
  })

  it('strips lint pragmas from the non-minified UMD output', () => {
    outputDir.write('bundle/index.umd.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputDir.path, outputsOf({ umd: [umdOutput()] }))
    expect(outputDir.read('bundle/index.umd.js')).toBe(CODE)
  })

  it('leaves the minified twin untouched', () => {
    outputDir.write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    outputDir.write('bundle/index.iife.min.js', 'var MyLib={/* kept as-is */};')
    stripBundleCommentsPass(outputDir.path, outputsOf({ iife: [iifeOutput()] }))
    expect(outputDir.read('bundle/index.iife.min.js')).toBe('var MyLib={/* kept as-is */};')
  })

  it('skips an IIFE output whose config enables sourcemaps', () => {
    outputDir.write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputDir.path, outputsOf({ iife: [iifeOutput({ sourcemap: true })] }))
    expect(outputDir.read('bundle/index.iife.js')).toBe(`${PRAGMA}\n${CODE}`)
  })

  it('skips a UMD output whose config enables sourcemaps', () => {
    outputDir.write('bundle/index.umd.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputDir.path, outputsOf({ umd: [umdOutput({ sourcemap: true })] }))
    expect(outputDir.read('bundle/index.umd.js')).toBe(`${PRAGMA}\n${CODE}`)
  })

  it('honors the per-format output subdirectory override', () => {
    outputDir.write('custom/index.umd.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputDir.path, outputsOf({ umd: [umdOutput({ output: 'custom' })] }))
    expect(outputDir.read('custom/index.umd.js')).toBe(CODE)
  })

  it('reports the bytes removed across all rewritten files', () => {
    outputDir.write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    outputDir.write('bundle/index.umd.js', `${PRAGMA}\n${CODE}`)
    const result = stripBundleCommentsPass(outputDir.path, outputsOf({ iife: [iifeOutput()], umd: [umdOutput()] }))
    expect(result).toEqual({ commentBytesRemoved: Buffer.byteLength(`${PRAGMA}\n`) * 2 })
  })

  it('returns zero when the outputs contain nothing removable', () => {
    outputDir.write('bundle/index.iife.js', CODE)
    const result = stripBundleCommentsPass(outputDir.path, outputsOf({ iife: [iifeOutput()] }))
    expect(result).toEqual({ commentBytesRemoved: 0 })
  })
})
