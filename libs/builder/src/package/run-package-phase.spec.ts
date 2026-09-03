import type { Mock } from '@hyperfrontend/testing'
import type { BuildConfig, BuildContext, FormatOutputs, PackageJson } from '../models'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { copyAssets } from './assets/copy-assets'
import { readProjectPackageJson } from './json/read-package-json'
import { synthesizePackageJson } from './json/synthesize'
import { writeOutputPackageJson } from './json/write'
import { collectThirdPartyLicenses } from './licenses/collect'
import { generateThirdPartyLicensesContent } from './licenses/generate-content'
import { writeThirdPartyLicensesFile } from './licenses/write'
import { runPackagePhase } from './run-package-phase'
jest.mock('./json/read-package-json', () => ({ readProjectPackageJson: jest.fn() }))
jest.mock('./json/synthesize', () => ({ synthesizePackageJson: jest.fn() }))
jest.mock('./json/write', () => ({ writeOutputPackageJson: jest.fn() }))
jest.mock('./assets/copy-assets', () => ({ copyAssets: jest.fn() }))
jest.mock('./licenses/collect', () => ({ collectThirdPartyLicenses: jest.fn() }))
jest.mock('./licenses/generate-content', () => ({ generateThirdPartyLicensesContent: jest.fn() }))
jest.mock('./licenses/write', () => ({ writeThirdPartyLicensesFile: jest.fn() }))

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
  workspaceBundledDeps: [],
  startedAt: 0,
  ...overrides,
})

const formats: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }

const baseConfig: BuildConfig = { projectRoot: '/abs/libs/foo', workspaceRoot: '/abs/repo' }

beforeEach(() => {
  ;(readProjectPackageJson as Mock).mockReset().mockReturnValue({ name: 'foo' } as PackageJson)
  ;(synthesizePackageJson as Mock).mockReset().mockReturnValue({ name: 'foo', dependencies: { rollup: '*' } } as PackageJson)
  ;(writeOutputPackageJson as Mock).mockReset()
  ;(copyAssets as Mock).mockReset()
  ;(collectThirdPartyLicenses as Mock).mockReset().mockReturnValue([])
  ;(generateThirdPartyLicensesContent as Mock).mockReset().mockReturnValue('content')
  ;(writeThirdPartyLicensesFile as Mock).mockReset()
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
    ;(synthesizePackageJson as Mock).mockReturnValue({ name: 'foo', dependencies: { rollup: '*', typescript: '*' } } as PackageJson)
    ;(collectThirdPartyLicenses as Mock).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(collectThirdPartyLicenses).toHaveBeenCalledWith('/abs/repo', ['rollup', 'typescript'])
  })

  it('writes THIRD_PARTY_LICENSES.md only when there are entries to render', async () => {
    ;(collectThirdPartyLicenses as Mock).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(writeThirdPartyLicensesFile).toHaveBeenCalledWith('/abs/dist/libs/foo', 'content')
  })

  it('does not write THIRD_PARTY_LICENSES.md when no licenses were collected', async () => {
    ;(collectThirdPartyLicenses as Mock).mockReturnValue([])
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(writeThirdPartyLicensesFile).not.toHaveBeenCalled()
  })

  it('passes an empty externals list when the dist package has no dependencies', async () => {
    ;(synthesizePackageJson as Mock).mockReturnValue({ name: 'foo' } as PackageJson)
    await runPackagePhase(makeContext(), { ...baseConfig, thirdPartyLicenses: true }, formats)
    expect(collectThirdPartyLicenses).toHaveBeenCalledWith('/abs/repo', [])
  })

  it('forwards config.bin to synthesize', async () => {
    await runPackagePhase(makeContext(), { ...baseConfig, bin: [{ name: 'hf-build', format: ['cjs'] }] }, formats)
    const passed = (synthesizePackageJson as Mock).mock.calls[0][3]
    expect(passed.bins).toEqual([{ name: 'hf-build', format: ['cjs'] }])
  })

  it('no longer computes the files allowlist — finalizeFilesAllowlist owns the field', async () => {
    await runPackagePhase(makeContext(), { ...baseConfig, files: ['only-this/'] }, formats)
    const passed = (synthesizePackageJson as Mock).mock.calls[0][3]
    expect(passed.files).toBeUndefined()
  })

  it('defaults thirdPartyLicenses to true when bundled deps are present', async () => {
    ;(synthesizePackageJson as Mock).mockReturnValue({ name: 'foo' } as PackageJson)
    ;(collectThirdPartyLicenses as Mock).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext({ bundledDeps: ['rollup', 'postject'] }), baseConfig, formats)
    expect(collectThirdPartyLicenses).toHaveBeenCalledWith('/abs/repo', ['rollup', 'postject'])
    expect(writeThirdPartyLicensesFile).toHaveBeenCalled()
  })

  it('respects an explicit thirdPartyLicenses=false override even when bundled deps are present', async () => {
    await runPackagePhase(makeContext({ bundledDeps: ['rollup'] }), { ...baseConfig, thirdPartyLicenses: false }, formats)
    expect(collectThirdPartyLicenses).not.toHaveBeenCalled()
  })

  it('merges bundledDeps with the dist dependencies for license collection', async () => {
    ;(synthesizePackageJson as Mock).mockReturnValue({ name: 'foo', dependencies: { tslib: '*' } } as PackageJson)
    ;(collectThirdPartyLicenses as Mock).mockReturnValue([{ name: 'rollup', licenseType: 'MIT', licenseUrl: null }])
    await runPackagePhase(makeContext({ bundledDeps: ['rollup', 'postject'] }), baseConfig, formats)
    const externals = (collectThirdPartyLicenses as Mock).mock.calls[0][1]
    expect(externals).toEqual(['rollup', 'postject', 'tslib'])
  })
})
