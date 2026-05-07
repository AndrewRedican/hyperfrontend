jest.mock('./json/read-package-json', () => ({ readProjectPackageJson: jest.fn() }))
jest.mock('./json/synthesize', () => ({ synthesizePackageJson: jest.fn() }))
jest.mock('./json/write', () => ({ writeOutputPackageJson: jest.fn() }))
jest.mock('./assets/copy-assets', () => ({ copyAssets: jest.fn() }))
jest.mock('./licenses/collect', () => ({ collectThirdPartyLicenses: jest.fn() }))
jest.mock('./licenses/generate-content', () => ({ generateThirdPartyLicensesContent: jest.fn() }))
jest.mock('./licenses/write', () => ({ writeThirdPartyLicensesFile: jest.fn() }))

import type { BuildConfig, BuildContext, FormatOutputs, PackageJson } from '../models'
import { copyAssets } from './assets/copy-assets'
import { readProjectPackageJson } from './json/read-package-json'
import { synthesizePackageJson } from './json/synthesize'
import { writeOutputPackageJson } from './json/write'
import { collectThirdPartyLicenses } from './licenses/collect'
import { generateThirdPartyLicensesContent } from './licenses/generate-content'
import { writeThirdPartyLicensesFile } from './licenses/write'
import { runPackagePhase } from './run-package-phase'

const isHyperfrontend = (name: string): boolean => name.startsWith('@hyperfrontend/')

const makeContext = (overrides?: Partial<BuildContext>): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [{ from: '/abs/libs/foo', files: ['README.md'] }],
  isWorkspacePackage: isHyperfrontend,
  entryPointDiscovery: { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  bundledDeps: [],
  startedAt: 0,
  ...overrides,
})

const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }

const baseConfig: BuildConfig = { projectRoot: '/abs/libs/foo', workspaceRoot: '/abs/repo' }

beforeEach(() => {
  ;(<jest.Mock>readProjectPackageJson).mockReset().mockReturnValue(<PackageJson>{ name: 'foo' })
  ;(<jest.Mock>synthesizePackageJson).mockReset().mockReturnValue(<PackageJson>{ name: 'foo', dependencies: { rollup: '*' } })
  ;(<jest.Mock>writeOutputPackageJson).mockReset()
  ;(<jest.Mock>copyAssets).mockReset()
  ;(<jest.Mock>collectThirdPartyLicenses).mockReset().mockReturnValue([])
  ;(<jest.Mock>generateThirdPartyLicensesContent).mockReset().mockReturnValue('content')
  ;(<jest.Mock>writeThirdPartyLicensesFile).mockReset()
})

describe('runPackagePhase', () => {
  it('reads the source package.json from the project root', async () => {
    await runPackagePhase(makeContext(), baseConfig, formats)
    expect(readProjectPackageJson).toHaveBeenCalledWith('/abs/libs/foo')
  })

  it('forwards inheritance, filtering, and CDN overrides to synthesize', async () => {
    const config: BuildConfig = {
      ...baseConfig,
      inheritFieldsFrom: { from: '/abs/repo/package.json', fields: ['repository'] },
      filterWorkspaceDepsFromOutput: true,
      unpkg: './u.js',
      jsdelivr: './j.js',
    }
    await runPackagePhase(makeContext(), config, formats)
    expect(synthesizePackageJson).toHaveBeenCalledWith(
      { name: 'foo' },
      expect.any(Object),
      formats,
      expect.objectContaining({
        inheritFieldsFrom: { from: '/abs/repo/package.json', fields: ['repository'] },
        filterWorkspaceDepsFromOutput: true,
        isWorkspacePackage: isHyperfrontend,
        unpkg: './u.js',
        jsdelivr: './j.js',
      })
    )
  })

  it('writes the synthesized package.json to the output path', async () => {
    await runPackagePhase(makeContext(), baseConfig, formats)
    expect(writeOutputPackageJson).toHaveBeenCalledWith('/abs/dist/libs/foo', { name: 'foo', dependencies: { rollup: '*' } })
  })

  it('copies the configured assets with the resolved output path and source pkg', async () => {
    const ctx = makeContext()
    await runPackagePhase(ctx, baseConfig, formats)
    expect(copyAssets).toHaveBeenCalledWith(ctx.assets, '/abs/dist/libs/foo', { name: 'foo' })
  })

  it('skips license generation when thirdPartyLicenses is disabled', async () => {
    await runPackagePhase(makeContext(), baseConfig, formats)
    expect(collectThirdPartyLicenses).not.toHaveBeenCalled()
    expect(writeThirdPartyLicensesFile).not.toHaveBeenCalled()
  })

  it('collects licenses from the dist package.json dependencies when enabled', async () => {
    ;(<jest.Mock>synthesizePackageJson).mockReturnValue(<PackageJson>{ name: 'foo', dependencies: { rollup: '*', typescript: '*' } })
    ;(<jest.Mock>collectThirdPartyLicenses).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(collectThirdPartyLicenses).toHaveBeenCalledWith('/abs/libs/foo', '/abs/repo', ['rollup', 'typescript'])
  })

  it('writes THIRD_PARTY_LICENSES.md only when there are entries to render', async () => {
    ;(<jest.Mock>collectThirdPartyLicenses).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(writeThirdPartyLicensesFile).toHaveBeenCalledWith('/abs/dist/libs/foo', 'content')
  })

  it('does not write THIRD_PARTY_LICENSES.md when no licenses were collected', async () => {
    ;(<jest.Mock>collectThirdPartyLicenses).mockReturnValue([])
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(writeThirdPartyLicensesFile).not.toHaveBeenCalled()
  })

  it('passes an empty externals list when the dist package has no dependencies', async () => {
    ;(<jest.Mock>synthesizePackageJson).mockReturnValue(<PackageJson>{ name: 'foo' })
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(collectThirdPartyLicenses).toHaveBeenCalledWith('/abs/libs/foo', '/abs/repo', [])
  })

  it('forwards config.bin and a derived files allowlist to synthesize', async () => {
    const ctx = makeContext({
      bundledDeps: ['rollup'],
      entryPointDiscovery: {
        category: 'root',
        entryPoints: [{ exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }],
        hasRootEntry: true,
        platformEntries: [],
        featureEntries: [],
      },
    })
    await runPackagePhase(ctx, { ...baseConfig, bin: [{ name: 'hf-build', format: ['cjs'] }] }, formats)
    const passed = (<jest.Mock>synthesizePackageJson).mock.calls[0][3]
    expect(passed.bins).toEqual([{ name: 'hf-build', format: ['cjs'] }])
    expect(passed.files).toContain('_dependencies/')
    expect(passed.files).toContain('bin/hf-build.js')
    expect(passed.files).toContain('index.*')
  })

  it('honors config.files as an explicit allowlist override', async () => {
    await runPackagePhase(makeContext(), { ...baseConfig, files: ['only-this/'] }, formats)
    const passed = (<jest.Mock>synthesizePackageJson).mock.calls[0][3]
    expect(passed.files).toEqual(['only-this/'])
  })

  it('defaults thirdPartyLicenses to true when bundled deps are present', async () => {
    ;(<jest.Mock>synthesizePackageJson).mockReturnValue(<PackageJson>{ name: 'foo' })
    ;(<jest.Mock>collectThirdPartyLicenses).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext({ bundledDeps: ['rollup', 'postject'] }), baseConfig, formats)
    expect(collectThirdPartyLicenses).toHaveBeenCalledWith('/abs/libs/foo', '/abs/repo', ['rollup', 'postject'])
    expect(writeThirdPartyLicensesFile).toHaveBeenCalled()
  })

  it('respects an explicit thirdPartyLicenses=false override even when bundled deps are present', async () => {
    await runPackagePhase(makeContext({ bundledDeps: ['rollup'] }), { ...baseConfig, thirdPartyLicenses: false }, formats)
    expect(collectThirdPartyLicenses).not.toHaveBeenCalled()
  })

  it('merges bundledDeps with the dist dependencies for license collection', async () => {
    ;(<jest.Mock>synthesizePackageJson).mockReturnValue(<PackageJson>{ name: 'foo', dependencies: { tslib: '*' } })
    ;(<jest.Mock>collectThirdPartyLicenses).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext({ bundledDeps: ['rollup', 'postject'] }), baseConfig, formats)
    const externals = (<jest.Mock>collectThirdPartyLicenses).mock.calls[0][2]
    expect(externals).toEqual(['rollup', 'postject', 'tslib'])
  })
})
