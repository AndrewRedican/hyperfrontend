jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))

import type { BuildContext, CjsConfig, EntryPoint } from '../../models'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCjsConfig, createCjsEntryConfig } from './config-cjs'

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

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/libs/foo/src/index.ts', isRoot: true }
const SUB_ENTRY: EntryPoint = {
  exportPath: './node',
  srcPath: 'node',
  inputFile: '/abs/libs/foo/src/node/index.ts',
  isRoot: false,
  platform: 'node',
}

describe('createCjsEntryConfig', () => {
  let workspaceRoot: string
  let projectRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-cfg-cjs-'))
    projectRoot = join(workspaceRoot, 'libs', 'foo')
    mkdirSync(projectRoot, { recursive: true })
    writePkg(projectRoot, {})
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('emits a CommonJS file at <outputPath>/index.cjs.js for the root entry', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(ROOT_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect(result.output).toEqual(expect.objectContaining({ file: join(ctx.outputPath, 'index.cjs.js'), format: 'cjs' }))
  })

  it('places the output under a subdirectory matching the entry srcPath', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(SUB_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect(result.output).toEqual(expect.objectContaining({ file: join(ctx.outputPath, 'node', 'index.cjs.js') }))
  })

  it('honors a sourcemap=false override', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(ROOT_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false, sourcemap: false }, ctx)
    expect(result.output).toEqual(expect.objectContaining({ sourcemap: false }))
  })

  it('marks project dependencies as external by default', () => {
    writePkg(projectRoot, { dependencies: { lodash: '*' } })
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(ROOT_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false }, ctx)
    expect((<(id: string) => boolean>result.external)('lodash')).toBe(true)
  })

  it('suppresses TS2307 warnings emitted by the typescript plugin', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(ROOT_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false }, ctx)
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ plugin: 'typescript', message: 'Cannot find module: TS2307' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses EMPTY_BUNDLE warnings', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(ROOT_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false }, ctx)
    const handler = jest.fn()
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)({ code: 'EMPTY_BUNDLE' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards every other warning to the default handler', () => {
    const ctx = makeContext(projectRoot, workspaceRoot)
    const result = createCjsEntryConfig(ROOT_ENTRY, <CjsConfig>{ bundleWorkspaceDeps: false }, ctx)
    const handler = jest.fn()
    const warning = { code: 'CIRCULAR_DEPENDENCY' }
    ;(<(w: unknown, h: typeof handler) => void>result.onwarn)(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })
})

describe('createCjsConfig', () => {
  it('produces one rollup configuration per supplied entry', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-cfg-cjs-'))
    const projectRoot = join(workspaceRoot, 'libs', 'foo')
    mkdirSync(projectRoot, { recursive: true })
    writePkg(projectRoot, {})
    try {
      const result = createCjsConfig(
        [ROOT_ENTRY, SUB_ENTRY],
        <CjsConfig>{ bundleWorkspaceDeps: false },
        makeContext(projectRoot, workspaceRoot)
      )
      expect(result).toHaveLength(2)
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true })
    }
  })
})
