jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-terser', () => jest.fn(() => ({ name: 'terser' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))

import type { BuildContext, EntryPoint, IifeConfig } from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createIifeConfig, createIifeEntryConfig } from './config-iife'

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

describe('createIifeEntryConfig', () => {
  it('emits an unminified output at <outputPath>/<bundleDir>/index.iife.js', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[0]).toEqual(expect.objectContaining({ file: '/abs/dist/libs/foo/bundle/index.iife.js', format: 'iife', name: 'MyLib' }))
  })

  it('emits a minified twin when minify defaults to true', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[1]).toEqual(expect.objectContaining({ file: '/abs/dist/libs/foo/bundle/index.iife.min.js' }))
  })

  it('skips the minified twin when minify is false', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib', minify: false }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs).toHaveLength(1)
  })

  it('honors a custom output subdirectory', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib', output: 'dist-bundle' }, makeContext())
    const outputs = isArray(result.output) ? result.output : [result.output]
    expect(outputs[0]).toEqual(expect.objectContaining({ file: '/abs/dist/libs/foo/dist-bundle/index.iife.js' }))
  })

  it('marks listed external dependencies as external while inlining everything else', () => {
    const result = createIifeEntryConfig(
      ROOT_ENTRY,
      <IifeConfig>{ globalName: 'MyLib', external: ['react'], globals: { react: 'React' } },
      makeContext()
    )
    const isExternal = <(id: string) => boolean>result.external
    expect([isExternal('react'), isExternal('lodash')]).toEqual([true, false])
  })

  it('throws when external is non-empty but globals lacks a matching entry', () => {
    expect(() => createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib', external: ['react'] }, makeContext())).toThrow(
      /Missing globals mapping/
    )
  })

  it('suppresses TS2307 typescript warnings', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ plugin: 'typescript', message: 'TS2307: Cannot find module' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses EMPTY_BUNDLE warnings', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ code: 'EMPTY_BUNDLE' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses UNRESOLVED_IMPORT warnings emitted by the bundle pipeline', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ code: 'UNRESOLVED_IMPORT' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards every other warning to the default handler', () => {
    const result = createIifeEntryConfig(ROOT_ENTRY, <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    const handler = jest.fn()
    const warning = { code: 'CIRCULAR_DEPENDENCY' }
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })
})

describe('createIifeConfig', () => {
  it('produces one rollup configuration per supplied entry', () => {
    const result = createIifeConfig([ROOT_ENTRY, ROOT_ENTRY], <IifeConfig>{ globalName: 'MyLib' }, makeContext())
    expect(result).toHaveLength(2)
  })
})
