jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => ({ __esModule: true, default: jest.fn(() => ({ name: 'json' })) }))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn((options?: unknown) => ({ name: 'node-resolve', __options: options })))
jest.mock('@rollup/plugin-terser', () => jest.fn(() => ({ name: 'terser' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn((options?: unknown) => ({ name: 'typescript', __options: options })))

import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import {
  createBrowserNodeResolvePlugin,
  createBundleTypescriptPlugin,
  createCommonJsPlugin,
  createJsonPlugin,
  createNodeResolvePlugin,
  createTerserPlugin,
  createTypescriptPlugin,
} from './plugins'

interface PluginWithOptions {
  __options?: { [key: string]: unknown }
}

beforeEach(() => {
  ;(<jest.Mock>nodeResolve).mockClear()
  ;(<jest.Mock>typescript).mockClear()
})

describe('createNodeResolvePlugin', () => {
  it('configures resolution for both .ts and .js extensions', () => {
    createNodeResolvePlugin()
    expect(nodeResolve).toHaveBeenCalledWith(expect.objectContaining({ extensions: ['.ts', '.js'] }))
  })
})

describe('createBrowserNodeResolvePlugin', () => {
  it('enables the browser flag and disables preferBuiltins for browser-targeted bundles', () => {
    createBrowserNodeResolvePlugin()
    expect(nodeResolve).toHaveBeenCalledWith(expect.objectContaining({ browser: true, preferBuiltins: false }))
  })
})

describe('createCommonJsPlugin', () => {
  it('returns a plugin object with the commonjs name', () => {
    expect(createCommonJsPlugin()).toEqual(expect.objectContaining({ name: 'commonjs' }))
  })
})

describe('createJsonPlugin', () => {
  it('returns a plugin object with the json name', () => {
    expect(createJsonPlugin()).toEqual(expect.objectContaining({ name: 'json' }))
  })
})

describe('createTerserPlugin', () => {
  it('returns a plugin object with the terser name', () => {
    expect(createTerserPlugin()).toEqual(expect.objectContaining({ name: 'terser' }))
  })
})

describe('createTypescriptPlugin', () => {
  it('disables declaration emission so the dedicated tsc primitive controls .d.ts output', () => {
    createTypescriptPlugin({
      tsConfigPath: '/abs/tsconfig.lib.json',
      projectRoot: '/abs/libs/foo',
      outputPath: '/abs/dist/libs/foo',
      sourcemap: true,
      bundleWorkspaceDeps: false,
    })
    expect(typescript).toHaveBeenCalledWith(expect.objectContaining({ declaration: false, declarationMap: false }))
  })

  it('clears compilerOptions.paths when not bundling workspace deps to keep workspace imports unresolved', () => {
    createTypescriptPlugin({
      tsConfigPath: '/abs/tsconfig.lib.json',
      projectRoot: '/abs/libs/foo',
      outputPath: '/abs/dist/libs/foo',
      sourcemap: true,
      bundleWorkspaceDeps: false,
    })
    expect(typescript).toHaveBeenCalledWith(expect.objectContaining({ compilerOptions: expect.objectContaining({ paths: {} }) }))
  })

  it('sets workspaceRoot as baseUrl when bundling workspace deps so imports resolve normally', () => {
    createTypescriptPlugin({
      tsConfigPath: '/abs/tsconfig.lib.json',
      projectRoot: '/abs/libs/foo',
      outputPath: '/abs/dist/libs/foo',
      sourcemap: false,
      bundleWorkspaceDeps: true,
      workspaceRoot: '/abs/repo',
    })
    expect(typescript).toHaveBeenCalledWith(expect.objectContaining({ compilerOptions: expect.objectContaining({ baseUrl: '/abs/repo' }) }))
  })

  it('throws when bundleWorkspaceDeps is true but workspaceRoot is omitted', () => {
    expect(() =>
      createTypescriptPlugin({
        tsConfigPath: '/abs/tsconfig.lib.json',
        projectRoot: '/abs/libs/foo',
        outputPath: '/abs/dist/libs/foo',
        sourcemap: true,
        bundleWorkspaceDeps: true,
      })
    ).toThrow(/workspaceRoot/)
  })
})

describe('createBundleTypescriptPlugin', () => {
  it('uses the workspace root as baseUrl so workspace imports resolve in IIFE/UMD bundles', () => {
    const plugin = <PluginWithOptions>createBundleTypescriptPlugin({
      tsConfigPath: '/abs/tsconfig.lib.json',
      workspaceRoot: '/abs/repo',
      bundlePath: '/abs/dist/libs/foo/bundle',
      sourcemap: true,
    })
    expect(plugin.__options).toEqual(
      expect.objectContaining({ compilerOptions: expect.objectContaining({ baseUrl: '/abs/repo', outDir: '/abs/dist/libs/foo/bundle' }) })
    )
  })
})
