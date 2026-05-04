import type { Plugin } from 'rollup'
import { createExternalizeBundledDepsPlugin, relativeImport } from './externalize-plugin'

type ResolveIdHook = (source: string) => { id: string; external: true } | null

const callResolveId = (plugin: Plugin, source: string): { id: string; external: true } | null => {
  const hook = plugin.resolveId as unknown as ResolveIdHook
  return hook.call({} as ThisParameterType<ResolveIdHook>, source)
}

describe('relativeImport', () => {
  it('produces a leading "./" for sibling targets', () => {
    expect(relativeImport('/abs/dist/libs/foo', '/abs/dist/libs/foo/index.esm.js')).toBe('./index.esm.js')
  })

  it('uses parent-walk segments for deeper-from / shallower-to pairs', () => {
    expect(relativeImport('/abs/dist/libs/foo/bundle/rollup', '/abs/dist/libs/foo/_dependencies/rollup/index.esm.js')).toBe(
      '../../_dependencies/rollup/index.esm.js'
    )
  })

  it('normalizes separators to forward slashes', () => {
    const result = relativeImport('/abs/dist/libs/foo/a', '/abs/dist/libs/foo/b/c.js')
    expect(result.includes('\\')).toBe(false)
  })
})

describe('createExternalizeBundledDepsPlugin', () => {
  const baseOptions = {
    deps: ['rollup', '@rollup/plugin-typescript', 'postject'],
    entryOutDir: '/abs/dist/libs/builder/bundle/rollup',
    depsRoot: '/abs/dist/libs/builder/_dependencies',
  } as const

  it('exposes the expected plugin name', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(plugin.name).toBe('externalize-bundled-deps')
  })

  it('marks node builtins as external without rewriting', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, 'fs')).toEqual({ id: 'fs', external: true })
  })

  it('marks node:* imports as external', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, 'node:path')).toEqual({ id: 'node:path', external: true })
  })

  it('rewrites bundled-dep imports to the matching ESM artifact', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, 'rollup')).toEqual({
      id: '../../_dependencies/rollup/index.esm.js',
      external: true,
    })
  })

  it('rewrites bundled-dep imports to the matching CJS artifact', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'cjs' })
    expect(callResolveId(plugin, 'rollup')).toEqual({
      id: '../../_dependencies/rollup/index.cjs.js',
      external: true,
    })
  })

  it('rewrites bundled-dep imports to the matching d.ts artifact', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'dts' })
    expect(callResolveId(plugin, 'rollup')).toEqual({
      id: '../../_dependencies/rollup/index.d.ts',
      external: true,
    })
  })

  it('rewrites scoped package imports', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, '@rollup/plugin-typescript')).toEqual({
      id: '../../_dependencies/@rollup/plugin-typescript/index.esm.js',
      external: true,
    })
  })

  it('rewrites subpath imports', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, 'rollup/loadConfigFile')).toEqual({
      id: '../../_dependencies/rollup/index.esm.js',
      external: true,
    })
  })

  it('returns null for unrelated imports so the rest of the plugin chain handles them', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, 'lodash')).toBeNull()
  })

  it('returns null for partial-match imports that share a prefix without the / separator', () => {
    const plugin = createExternalizeBundledDepsPlugin({ ...baseOptions, format: 'esm' })
    expect(callResolveId(plugin, 'rollup-plugin-dts')).toBeNull()
  })

  it('produces the correct relative path for the root-entry output directory', () => {
    const plugin = createExternalizeBundledDepsPlugin({
      deps: ['rollup'],
      entryOutDir: '/abs/dist/libs/builder',
      depsRoot: '/abs/dist/libs/builder/_dependencies',
      format: 'esm',
    })
    expect(callResolveId(plugin, 'rollup')).toEqual({
      id: './_dependencies/rollup/index.esm.js',
      external: true,
    })
  })
})
