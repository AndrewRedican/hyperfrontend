import type { FormatOutputs, IifeConfig, IifeOutput, UmdConfig, UmdOutput } from '../models'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { stripBundleCommentsPass } from './strip-bundle-comments'

const PRAGMA = '// eslint-disable-next-line workspace/no-unsafe-builtin-methods'
const CODE = 'var MyLib = { value: 1 };\n'

describe('stripBundleCommentsPass', () => {
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-bundle-strip-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  const write = (relPath: string, content: string): void => {
    const abs = join(outputPath, relPath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  const read = (relPath: string): string => readFileSync(join(outputPath, relPath), 'utf8')

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
    write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputPath, outputsOf({ iife: [iifeOutput()] }))
    expect(read('bundle/index.iife.js')).toBe(CODE)
  })

  it('strips lint pragmas from the non-minified UMD output', () => {
    write('bundle/index.umd.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputPath, outputsOf({ umd: [umdOutput()] }))
    expect(read('bundle/index.umd.js')).toBe(CODE)
  })

  it('leaves the minified twin untouched', () => {
    write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    write('bundle/index.iife.min.js', 'var MyLib={/* kept as-is */};')
    stripBundleCommentsPass(outputPath, outputsOf({ iife: [iifeOutput()] }))
    expect(read('bundle/index.iife.min.js')).toBe('var MyLib={/* kept as-is */};')
  })

  it('skips an IIFE output whose config enables sourcemaps', () => {
    write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputPath, outputsOf({ iife: [iifeOutput({ sourcemap: true })] }))
    expect(read('bundle/index.iife.js')).toBe(`${PRAGMA}\n${CODE}`)
  })

  it('skips a UMD output whose config enables sourcemaps', () => {
    write('bundle/index.umd.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputPath, outputsOf({ umd: [umdOutput({ sourcemap: true })] }))
    expect(read('bundle/index.umd.js')).toBe(`${PRAGMA}\n${CODE}`)
  })

  it('honors the per-format output subdirectory override', () => {
    write('custom/index.umd.js', `${PRAGMA}\n${CODE}`)
    stripBundleCommentsPass(outputPath, outputsOf({ umd: [umdOutput({ output: 'custom' })] }))
    expect(read('custom/index.umd.js')).toBe(CODE)
  })

  it('reports the bytes removed across all rewritten files', () => {
    write('bundle/index.iife.js', `${PRAGMA}\n${CODE}`)
    write('bundle/index.umd.js', `${PRAGMA}\n${CODE}`)
    const result = stripBundleCommentsPass(outputPath, outputsOf({ iife: [iifeOutput()], umd: [umdOutput()] }))
    expect(result).toEqual({ commentBytesRemoved: Buffer.byteLength(`${PRAGMA}\n`) * 2 })
  })

  it('returns zero when the outputs contain nothing removable', () => {
    write('bundle/index.iife.js', CODE)
    const result = stripBundleCommentsPass(outputPath, outputsOf({ iife: [iifeOutput()] }))
    expect(result).toEqual({ commentBytesRemoved: 0 })
  })
})
