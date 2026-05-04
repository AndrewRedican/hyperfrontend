jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))

import type { BuildContext, EntryPoint, EsmConfig } from '../../models'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEsmConfig, createEsmEntryConfig } from './config-esm'

const writePkg = (root: string, contents: object): void => {
  writeFileSync(join(root, 'package.json'), JSON.stringify(contents))
}

const makeContext = (projectRoot: string, workspaceRoot: string): BuildContext => ({
  projectRoot,
  workspaceRoot,
  projectRelativePath: 'libs/foo',
  outputPath: join(workspaceRoot, 'dist', 'libs', 'foo'),
  tsConfigPath: join(projectRoot, 'tsconfig.lib.json'),
  external: [],
  assets: [],
  isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
  entryPointDiscovery: { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  bundledDeps: [],
  startedAt: 0,
})

const ROOT_ENTRY: EntryPoint = {
  exportPath: '.',
  srcPath: '',
  inputFile: '/abs/libs/foo/src/index.ts',
  isRoot: true,
}

const BROWSER_ENTRY: EntryPoint = {
  exportPath: './browser',
  srcPath: 'browser',
  inputFile: '/abs/libs/foo/src/browser/index.ts',
  isRoot: false,
  platform: 'browser',
}

describe('createEsmEntryConfig', () => {
  let workspaceRoot: string
  let projectRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-cfg-esm-'))
    projectRoot = join(workspaceRoot, 'libs', 'foo')
    mkdirSync(projectRoot, { recursive: true })
    writePkg(projectRoot, {})
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('sets the output file to <outputPath>/index.esm.js for the root entry', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect(result.output).toEqual(expect.objectContaining({ file: join(ctx.outputPath, 'index.esm.js'), format: 'esm' }))
  })

  it('places the output under a subdirectory named after the entry srcPath', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(BROWSER_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect(result.output).toEqual(expect.objectContaining({ file: join(ctx.outputPath, 'browser', 'index.esm.js') }))
  })

  it('passes the resolved entry inputFile through as the rollup input', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    expect(createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx).input).toBe(ROOT_ENTRY.inputFile)
  })

  it('defaults sourcemap to true when the format config omits the flag', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect(result.output).toEqual(expect.objectContaining({ sourcemap: true }))
  })

  it('treats project dependencies as external when bundleWorkspaceDeps is false', () => {
    writePkg(projectRoot, { dependencies: { lodash: '*' } })
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect((<(id: string) => boolean>result.external)('lodash')).toBe(true)
  })

  it('inlines workspace dependencies when bundleWorkspaceDeps is true', () => {
    writePkg(projectRoot, { dependencies: { '@hyperfrontend/logging': '*' } })
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: true }, ctx)
    expect((<(id: string) => boolean>result.external)('@hyperfrontend/logging')).toBe(false)
  })

  it('merges context.external and config.external into the resolved external list', () => {
    const ctx = { ...makeContext(projectRoot, workspaceRoot), external: ['ctx-extra'] }
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false, external: ['cfg-extra'] }, ctx)
    const isExternal = <(id: string) => boolean>result.external
    expect([isExternal('ctx-extra'), isExternal('cfg-extra')]).toEqual([true, true])
  })

  it('suppresses TS2307 warnings emitted by the typescript plugin', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ plugin: 'typescript', message: 'Cannot find module: TS2307' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses EMPTY_BUNDLE warnings', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ code: 'EMPTY_BUNDLE' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards every other warning to the default rollup handler', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false }, ctx)
    const handler = jest.fn()
    const warning = { code: 'CIRCULAR_DEPENDENCY' }
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })

  it('installs the externalize-bundled-deps plugin when bundleAllDeps is on and bundledDeps is non-empty', () => {
    const ctx = { ...makeContext(projectRoot, workspaceRoot), bundledDeps: ['rollup'] }
    const result = createEsmEntryConfig(ROOT_ENTRY, <EsmConfig>{ bundleWorkspaceDeps: false, bundleAllDeps: true }, ctx)
    const pluginNames = (<Array<{ name: string }>>result.plugins).map((p) => p.name)
    expect(pluginNames).toContain('externalize-bundled-deps')
  })
})

describe('createEsmConfig', () => {
  it('produces one rollup configuration per supplied entry', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-cfg-esm-'))
    const projectRoot = join(workspaceRoot, 'libs', 'foo')
    mkdirSync(projectRoot, { recursive: true })
    writePkg(projectRoot, {})
    try {
      const result = createEsmConfig(
        [ROOT_ENTRY, BROWSER_ENTRY],
        <EsmConfig>{ bundleWorkspaceDeps: false },
        makeContext(projectRoot, workspaceRoot)
      )
      expect(result).toHaveLength(2)
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true })
    }
  })
})
