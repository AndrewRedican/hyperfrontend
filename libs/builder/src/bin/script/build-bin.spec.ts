jest.mock('node:fs', () => ({ chmodSync: jest.fn() }))
jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))
jest.mock('../../bundle/rollup/execute', () => ({ executeRollup: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, ensureDir: jest.fn() }
})

import type { RollupOptions } from 'rollup'
import type { BinConfig, BuildContext } from '../../models'
import { chmodSync } from 'node:fs'
import { ensureDir } from '@hyperfrontend/project-scope/core'
import { executeRollup } from '../../bundle/rollup/execute'
import { buildJsBin } from './build-bin'

const makeContext = (): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  bundledDeps: [],
  startedAt: 0,
})

beforeEach(() => {
  ;(<jest.Mock>executeRollup).mockClear()
  ;(<jest.Mock>chmodSync).mockClear()
  ;(<jest.Mock>ensureDir).mockClear()
})

describe('buildJsBin', () => {
  it('ensures the bin output directory exists before bundling', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/foo/bin')
  })

  it('emits a single CJS output as `<name>.js` when only CJS is declared', async () => {
    const result = await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs', runner: 'runCz' }, makeContext())
    expect(result).toEqual([{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/cz.js' }])
  })

  it('emits an ESM output as `<name>.mjs`', async () => {
    const result = await buildJsBin(<BinConfig>{ name: 'cz', format: 'esm', runner: 'runCz' }, makeContext())
    expect(result).toEqual([{ name: 'cz', kind: 'esm', outputPath: '/abs/dist/libs/foo/bin/cz.mjs' }])
  })

  it('emits both CJS (`<name>.cjs.js`) and ESM (`<name>.mjs`) when an array of formats is declared', async () => {
    const result = await buildJsBin(<BinConfig>{ name: 'hf-build', format: ['cjs', 'esm'] }, makeContext())
    expect(result).toEqual([
      { name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/hf-build.cjs.js' },
      { name: 'hf-build', kind: 'esm', outputPath: '/abs/dist/libs/foo/bin/hf-build.mjs' },
    ])
  })

  it('chmods every emitted bin file to 0o755', async () => {
    await buildJsBin(<BinConfig>{ name: 'hf-build', format: ['cjs', 'esm'] }, makeContext())
    expect(chmodSync).toHaveBeenCalledTimes(2)
    expect(chmodSync).toHaveBeenNthCalledWith(1, '/abs/dist/libs/foo/bin/hf-build.cjs.js', 0o755)
    expect(chmodSync).toHaveBeenNthCalledWith(2, '/abs/dist/libs/foo/bin/hf-build.mjs', 0o755)
  })

  it('reads the source from `src/bin/<name>.ts` under the project root', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())
    const config = <RollupOptions>(<jest.Mock>executeRollup).mock.calls[0][0]
    expect(config.input).toBe('/abs/libs/foo/src/bin/cz.ts')
  })

  it('configures CJS output with shebang banner, named exports, and the bootstrap footer', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs', runner: 'runCz' }, makeContext())
    const config = <RollupOptions>(<jest.Mock>executeRollup).mock.calls[0][0]
    const output = Array.isArray(config.output) ? config.output[0] : config.output
    expect(output).toMatchObject({
      file: '/abs/dist/libs/foo/bin/cz.js',
      format: 'cjs',
      exports: 'named',
      banner: '#!/usr/bin/env node',
      sourcemap: false,
    })
    expect(typeof output?.footer).toBe('string')
    expect(output?.footer).toContain('runCz(')
  })

  it('configures ESM output with the ESM-flavored bootstrap footer', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'esm' }, makeContext())
    const config = <RollupOptions>(<jest.Mock>executeRollup).mock.calls[0][0]
    const output = Array.isArray(config.output) ? config.output[0] : config.output
    expect(output?.format).toBe('esm')
    expect(output?.footer).toContain('await import(import.meta.url)')
  })

  it('honors a per-bin bootstrap override over the default footer', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs', bootstrap: '// custom-footer' }, makeContext())
    const config = <RollupOptions>(<jest.Mock>executeRollup).mock.calls[0][0]
    const output = Array.isArray(config.output) ? config.output[0] : config.output
    expect(output?.footer).toBe('// custom-footer')
  })

  it('labels the executeRollup invocation with `bin:<name>:<format>` for traceability', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: ['cjs', 'esm'] }, makeContext())
    expect(executeRollup).toHaveBeenNthCalledWith(1, expect.any(Object), 'bin:cz:cjs')
    expect(executeRollup).toHaveBeenNthCalledWith(2, expect.any(Object), 'bin:cz:esm')
  })

  it('routes warnings: TS2307 and EMPTY_BUNDLE are silenced, others fall through', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())
    const config = <RollupOptions>(<jest.Mock>executeRollup).mock.calls[0][0]
    const handler = jest.fn()
    config.onwarn?.({ plugin: 'typescript', message: 'TS2307: missing' }, handler)
    config.onwarn?.({ code: 'EMPTY_BUNDLE', message: '' }, handler)
    config.onwarn?.({ code: 'OTHER', message: 'real' }, handler)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ code: 'OTHER', message: 'real' })
  })

  it('routes warnings: typescript-plugin warnings without TS2307 are not silenced', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())
    const config = <RollupOptions>(<jest.Mock>executeRollup).mock.calls[0][0]
    const handler = jest.fn()
    config.onwarn?.({ plugin: 'typescript' }, handler)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
