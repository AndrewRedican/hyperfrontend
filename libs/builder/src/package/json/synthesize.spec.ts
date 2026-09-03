import type { BuildContext, EntryPoint, EntryPointDiscovery, FormatOutputs, PackageJson, UmdConfig } from '../../models'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { synthesizePackageJson } from './synthesize'

const ROOT: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }
const BROWSER: EntryPoint = {
  exportPath: './browser',
  srcPath: 'browser',
  inputFile: '/abs/src/browser/index.ts',
  isRoot: false,
  platform: 'browser',
}

const isHyperfrontend = (name: string): boolean => name.startsWith('@hyperfrontend/')

const baseDiscovery = (overrides?: Partial<EntryPointDiscovery>): EntryPointDiscovery => ({
  category: 'hybrid',
  entryPoints: [ROOT, BROWSER],
  hasRootEntry: true,
  platformEntries: [BROWSER],
  featureEntries: [],
  ...overrides,
})

const makeContext = (discovery: EntryPointDiscovery = baseDiscovery()): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: discovery,
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

describe('synthesizePackageJson', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-synth-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('always sets sideEffects:false on the synthesized output', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.sideEffects).toBe(false)
  })

  it('regenerates the exports field from the format outputs', () => {
    const formats: FormatOutputs = { esm: [ROOT], cjs: [ROOT], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.exports).toEqual({
      './package.json': './package.json',
      '.': { types: './index.d.ts', import: './index.esm.js', require: './index.cjs.js' },
    })
  })

  it('emits main / module / types pointers when a root entry was bundled', () => {
    const formats: FormatOutputs = { esm: [ROOT], cjs: [ROOT], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.main).toBe('./index.cjs.js')
    expect(result.module).toBe('./index.esm.js')
    expect(result.types).toBe('./index.d.ts')
  })

  it('omits the module field when no ESM root output was produced', () => {
    const formats: FormatOutputs = { esm: [], cjs: [ROOT], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.module).toBeUndefined()
    expect(result.main).toBe('./index.cjs.js')
  })

  it('omits the main field when no CJS root output was produced', () => {
    const formats: FormatOutputs = { esm: [ROOT], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.main).toBeUndefined()
    expect(result.module).toBe('./index.esm.js')
  })

  it('removes inherited main / module / types when no root entry exists', () => {
    const ctx = makeContext(baseDiscovery({ hasRootEntry: false, entryPoints: [BROWSER] }))
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo', main: 'old', module: 'old', types: 'old' }, ctx, formats)
    expect(result.main).toBeUndefined()
    expect(result.module).toBeUndefined()
    expect(result.types).toBeUndefined()
  })

  it('appends unpkg / jsdelivr fields when a UMD or IIFE bundle was emitted', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.unpkg).toBe('./bundle/index.umd.min.js')
    expect(result.jsdelivr).toBe('./bundle/index.umd.min.js')
  })

  it('honors explicit unpkg / jsdelivr overrides', () => {
    const umdConfig: UmdConfig = { globalName: 'X' }
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [{ config: umdConfig, entries: [ROOT] }] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, { unpkg: './u.js', jsdelivr: './j.js' })
    expect(result.unpkg).toBe('./u.js')
    expect(result.jsdelivr).toBe('./j.js')
  })

  it('does not emit CDN fields when no UMD or IIFE bundle was produced', () => {
    const formats: FormatOutputs = { esm: [ROOT], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats)
    expect(result.unpkg).toBeUndefined()
    expect(result.jsdelivr).toBeUndefined()
  })

  it('strips workspace dependencies when filtering is enabled', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson(
      { name: 'foo', dependencies: { '@hyperfrontend/logging': '*', lodash: '*' } },
      makeContext(),
      formats,
      { filterWorkspaceDepsFromOutput: true, isWorkspacePackage: isHyperfrontend }
    )
    expect(result.dependencies).toEqual({ lodash: '*' })
  })

  it('does not strip workspace deps when filtering is enabled but predicate is omitted', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo', dependencies: { '@hyperfrontend/logging': '*' } }, makeContext(), formats, {
      filterWorkspaceDepsFromOutput: true,
    })
    expect(result.dependencies).toEqual({ '@hyperfrontend/logging': '*' })
  })

  it('inherits the requested fields from the configured source package.json', () => {
    const sourcePath = join(workspaceRoot, 'package.json')
    writeFileSync(sourcePath, JSON.stringify({ repository: { type: 'git', url: 'https://example.com/x.git' } }))
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, {
      inheritFieldsFrom: { from: sourcePath, fields: ['repository'] },
    })
    expect(result.repository).toEqual({ type: 'git', url: 'https://example.com/x.git' })
  })

  it('preserves arbitrary fields from the source package.json', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const srcPkg: PackageJson = { name: 'foo', version: '1.0.0', license: 'MIT', keywords: ['x'] }
    const result = synthesizePackageJson(srcPkg, makeContext(), formats)
    expect(result.name).toBe('foo')
    expect(result.version).toBe('1.0.0')
    expect(result.license).toBe('MIT')
    expect(result.keywords).toEqual(['x'])
  })

  it('strips bundled deps from output dependencies when ctx.bundledDeps is non-empty', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const ctx = { ...makeContext(), bundledDeps: ['rollup', 'postject'] }
    const result = synthesizePackageJson({ name: 'foo', dependencies: { rollup: '*', postject: '*', lodash: '*' } }, ctx, formats)
    expect(result.dependencies).toEqual({ lodash: '*' })
  })

  it('drops the dependencies field entirely when only bundled deps remain', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const ctx = { ...makeContext(), bundledDeps: ['rollup'] }
    const result = synthesizePackageJson({ name: 'foo', dependencies: { rollup: '*' } }, ctx, formats)
    expect(result.dependencies).toBeUndefined()
  })

  it('synthesizes a bin field from a CJS-only bin declaration', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, {
      bins: [{ name: 'hf-build', format: 'cjs' }],
    })
    expect(result.bin).toEqual({ 'hf-build': './bin/hf-build.js' })
  })

  it('uses the .cjs.js suffix when both CJS and ESM are requested', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, {
      bins: [{ name: 'hf-build', format: ['cjs', 'esm'] }],
    })
    expect(result.bin).toEqual({ 'hf-build': './bin/hf-build.cjs.js' })
  })

  it('points an ESM-only bin at the .mjs output', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, {
      bins: [{ name: 'esm-only', format: ['esm'] }],
    })
    expect(result.bin).toEqual({ 'esm-only': './bin/esm-only.mjs' })
  })

  it('strips the bin field from the source pkg when no bin declarations are passed', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo', bin: { stale: './x.js' } }, makeContext(), formats)
    expect(result.bin).toBeUndefined()
  })

  it('emits the supplied files allowlist verbatim', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, {
      files: ['_dependencies/', 'bin/hf-build.js', 'index.*'],
    })
    expect(result.files).toEqual(['_dependencies/', 'bin/hf-build.js', 'index.*'])
  })

  it('omits the files field when the allowlist is empty', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const result = synthesizePackageJson({ name: 'foo' }, makeContext(), formats, { files: [] })
    expect(result.files).toBeUndefined()
  })

  it('combines workspace and bundled-dep filtering when both are active', () => {
    const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
    const ctx = { ...makeContext(), bundledDeps: ['rollup'] }
    const result = synthesizePackageJson(
      { name: 'foo', dependencies: { rollup: '*', '@hyperfrontend/logging': '*', lodash: '*' } },
      ctx,
      formats,
      { filterWorkspaceDepsFromOutput: true, isWorkspacePackage: isHyperfrontend }
    )
    expect(result.dependencies).toEqual({ lodash: '*' })
  })
})
