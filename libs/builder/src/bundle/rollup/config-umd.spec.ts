jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-terser', () => jest.fn(() => ({ name: 'terser' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))

import type { BuildContext, EntryPoint, UmdConfig } from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createUmdConfig, createUmdEntryConfig } from './config-umd'

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
  startedAt: 0,
})

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/libs/foo/src/index.ts', isRoot: true }

describe('createUmdEntryConfig', () => {
  it('emits an unminified output at <outputPath>/<bundleDir>/index.umd.js', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[0]).toEqual(expect.objectContaining({ file: '/abs/dist/libs/foo/bundle/index.umd.js', format: 'umd', name: 'MyLib' }))
  })

  it('emits a minified twin when minify defaults to true', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[1]).toEqual(expect.objectContaining({ file: '/abs/dist/libs/foo/bundle/index.umd.min.js' }))
  })

  it('skips the minified twin when minify is false', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib', minify: false }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs).toHaveLength(1)
  })

  it('threads the amdId through to the output amd config when supplied', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib', amdId: 'my-lib' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[0]).toEqual(expect.objectContaining({ amd: { id: 'my-lib' } }))
  })

  it('omits the amd config field when amdId is not supplied', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[0]).toEqual(expect.not.objectContaining({ amd: expect.anything() }))
  })

  it('honors a custom output subdirectory', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib', output: 'umd-bundle' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[0]).toEqual(expect.objectContaining({ file: '/abs/dist/libs/foo/umd-bundle/index.umd.js' }))
  })

  it('marks listed external dependencies external while inlining everything else', () => {
    const result = createUmdEntryConfig(
      ROOT_ENTRY,
      <UmdConfig>{ globalName: 'MyLib', external: ['react'], globals: { react: 'React' } },
      makeContext()
    )
    const isExternal = <(id: string) => boolean>result.external
    expect([isExternal('react'), isExternal('lodash')]).toEqual([true, false])
  })

  it('throws when external is non-empty but globals is missing entries', () => {
    expect(() => createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib', external: ['react'] }, makeContext())).toThrow(
      /Missing globals mapping/
    )
  })

  it('suppresses TS2307 typescript warnings', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ plugin: 'typescript', message: 'TS2307: Cannot find module' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses EMPTY_BUNDLE warnings', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ code: 'EMPTY_BUNDLE' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses UNRESOLVED_IMPORT warnings emitted by the bundle pipeline', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ code: 'UNRESOLVED_IMPORT' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards every other warning to the default handler', () => {
    const result = createUmdEntryConfig(ROOT_ENTRY, <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    const warning = { code: 'CIRCULAR_DEPENDENCY' }
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })
})

describe('createUmdConfig', () => {
  it('produces one rollup configuration per supplied entry', () => {
    const result = createUmdConfig([ROOT_ENTRY, ROOT_ENTRY], <UmdConfig>{ globalName: 'MyLib' }, makeContext())
    expect(result).toHaveLength(2)
  })
})
