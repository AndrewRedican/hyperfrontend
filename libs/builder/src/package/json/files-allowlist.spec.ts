import type { BinConfig, BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { computeDefaultFilesAllowlist } from './files-allowlist'

const makeEntry = (srcPath: string): EntryPoint => ({
  exportPath: srcPath ? `./${srcPath}` : '.',
  srcPath,
  inputFile: `/abs/src/${srcPath ? `${srcPath}/index.ts` : 'index.ts'}`,
  isRoot: srcPath === '',
})

const makeDiscovery = (srcPaths: string[]): EntryPointDiscovery => ({
  category: 'hybrid',
  entryPoints: srcPaths.map(makeEntry),
  hasRootEntry: srcPaths.includes(''),
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (srcPaths: string[], bundledDeps: string[] = []): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery(srcPaths),
  bundledDeps,
  startedAt: 0,
})

describe('computeDefaultFilesAllowlist', () => {
  it('includes index.* and index.d.ts when a root entry exists', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['']), [])
    expect(result).toContain('index.*')
    expect(result).toContain('index.d.ts')
  })

  it('omits index.* when the library has no root entry', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['feature']), [])
    expect(result).not.toContain('index.*')
    expect(result).not.toContain('index.d.ts')
  })

  it('emits a single entry per top-level dir even when nested entries exist', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['bundle', 'bundle/declarations', 'bundle/rollup']), [])
    expect(result.filter((p) => p === 'bundle/')).toHaveLength(1)
  })

  it('lists _dependencies/ only when bundled deps are configured', () => {
    expect(computeDefaultFilesAllowlist(makeContext([''], []), [])).not.toContain('_dependencies/')
    expect(computeDefaultFilesAllowlist(makeContext([''], ['rollup']), [])).toContain('_dependencies/')
  })

  it('never emits bin/ as a wildcard, instead enumerating sub-entries explicitly', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['bin', 'bin/script', 'bin/native']), [])
    expect(result).not.toContain('bin/')
    expect(result).toContain('bin/script/')
    expect(result).toContain('bin/native/')
    expect(result).toContain('bin/index.*')
    expect(result).toContain('bin/index.d.ts')
  })

  it('omits bin/index.* when bin/ has only sub-entries (no top-level bin entry)', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['bin/script']), [])
    expect(result).not.toContain('bin/index.*')
    expect(result).not.toContain('bin/index.d.ts')
    expect(result).toContain('bin/script/')
  })

  it('adds the per-bin JS script paths for a CJS-only bin', () => {
    const bin: BinConfig = { name: 'hf-build', format: 'cjs' }
    const result = computeDefaultFilesAllowlist(makeContext(['bin/script']), [bin])
    expect(result).toContain('bin/hf-build.js')
    expect(result).toContain('bin/hf-build.d.ts')
    expect(result).not.toContain('bin/hf-build.cjs.js')
    expect(result).not.toContain('bin/hf-build.mjs')
  })

  it('uses the .cjs.js suffix when both formats are requested', () => {
    const bin: BinConfig = { name: 'hf-build', format: ['cjs', 'esm'] }
    const result = computeDefaultFilesAllowlist(makeContext(['bin/script']), [bin])
    expect(result).toContain('bin/hf-build.cjs.js')
    expect(result).toContain('bin/hf-build.mjs')
    expect(result).toContain('bin/hf-build.d.ts')
  })

  it('produces .mjs only for ESM-only bins', () => {
    const bin: BinConfig = { name: 'esm-only', format: ['esm'] }
    const result = computeDefaultFilesAllowlist(makeContext(['bin/script']), [bin])
    expect(result).toContain('bin/esm-only.mjs')
    expect(result).not.toContain('bin/esm-only.js')
    expect(result).not.toContain('bin/esm-only.cjs.js')
  })

  it('does not include any per-platform SEA artifact patterns', () => {
    const bin: BinConfig = {
      name: 'hf-build',
      format: ['cjs'],
      sea: { platforms: ['linux-x64', 'darwin-arm64'] },
    }
    const result = computeDefaultFilesAllowlist(makeContext(['bin/script', 'bin/native']), [bin])
    for (const path of result) {
      expect(path).not.toMatch(/sea-prep|sea-config|linux-x64|linux-arm64|darwin-x64|darwin-arm64|win32-x64/)
    }
  })

  it('always includes the standard top-level metadata files', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['']), [])
    expect(result).toContain('FUNDING.md')
    expect(result).toContain('LICENSE.md')
    expect(result).toContain('README.md')
    expect(result).toContain('SECURITY.md')
    expect(result).toContain('THIRD_PARTY_LICENSES.md')
  })

  it('emits a deterministic sorted result', () => {
    const result = computeDefaultFilesAllowlist(makeContext(['', 'bundle', 'memory']), [])
    expect([...result].sort()).toEqual(result)
  })
})
