import type { Mock } from '@hyperfrontend/testing'
import type { BuildConfig, BuildContext, PackageJson } from '../models'
import { beforeEach } from 'node:test'
import { readJsonFile } from '@hyperfrontend/project-scope/core'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { finalizeFilesAllowlist } from './finalize-files'
import { reflectFilesAllowlist } from './json/reflect-files-allowlist'
import { writeOutputPackageJson } from './json/write'
jest.mock('./json/reflect-files-allowlist', () => ({ reflectFilesAllowlist: jest.fn() }))
jest.mock('./json/write', () => ({ writeOutputPackageJson: jest.fn() }))
jest.mock('@hyperfrontend/project-scope/core', () => ({
  ...jest.requireActual<typeof import('@hyperfrontend/project-scope/core')>('@hyperfrontend/project-scope/core'),
  readJsonFile: jest.fn(),
}))

const makeContext = (overrides?: Partial<BuildContext>): BuildContext => ({
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
  workspaceBundledDeps: [],
  startedAt: 0,
  ...overrides,
})

const baseConfig: BuildConfig = { projectRoot: '/abs/libs/foo', workspaceRoot: '/abs/repo' }

beforeEach(() => {
  ;(reflectFilesAllowlist as Mock).mockReset().mockReturnValue(['**/index.*', '**/index.d.ts', 'README.md'])
  ;(readJsonFile as Mock).mockReset().mockReturnValue({ name: 'foo' } as PackageJson)
  ;(writeOutputPackageJson as Mock).mockReset()
})

describe('finalizeFilesAllowlist', () => {
  it('reflects the allowlist from the output tree', () => {
    finalizeFilesAllowlist(makeContext(), baseConfig)
    expect(reflectFilesAllowlist).toHaveBeenCalledWith('/abs/dist/libs/foo')
  })

  it('reads the dist manifest it writes the allowlist onto', () => {
    finalizeFilesAllowlist(makeContext(), baseConfig)
    expect(readJsonFile).toHaveBeenCalledWith(normalizeToNative('/abs/dist/libs/foo/package.json'))
  })

  it('writes the reflected allowlist onto the dist manifest', () => {
    finalizeFilesAllowlist(makeContext(), baseConfig)
    expect(writeOutputPackageJson).toHaveBeenCalledWith('/abs/dist/libs/foo', {
      name: 'foo',
      files: ['**/index.*', '**/index.d.ts', 'README.md'],
    })
  })

  it('skips reflecting when config.files is set explicitly', () => {
    finalizeFilesAllowlist(makeContext(), { ...baseConfig, files: ['only-this.js'] })
    expect(reflectFilesAllowlist).not.toHaveBeenCalled()
  })

  it('writes an explicit config.files override onto the dist manifest', () => {
    finalizeFilesAllowlist(makeContext(), { ...baseConfig, files: ['only-this.js'] })
    expect(writeOutputPackageJson).toHaveBeenCalledWith('/abs/dist/libs/foo', { name: 'foo', files: ['only-this.js'] })
  })

  it('leaves the manifest untouched when the allowlist is empty', () => {
    finalizeFilesAllowlist(makeContext(), { ...baseConfig, files: [] })
    expect({ reads: (readJsonFile as Mock).mock.calls, writes: (writeOutputPackageJson as Mock).mock.calls }).toEqual({
      reads: [],
      writes: [],
    })
  })
})
