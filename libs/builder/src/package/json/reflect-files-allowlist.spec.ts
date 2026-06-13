import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { reflectFilesAllowlist } from './reflect-files-allowlist'

const writeTree = (root: string, relPaths: string[]): void => {
  for (const rel of relPaths) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, '')
  }
}

describe('reflectFilesAllowlist', () => {
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-reflect-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  it('reflects the exact sorted allowlist from a materialized output tree', () => {
    writeTree(outputPath, [
      'package.json',
      'index.cjs.js',
      'index.esm.js',
      'index.d.ts',
      'index.d.ts.map',
      'models.d.ts',
      'models.d.ts.map',
      'actions/actions.d.ts',
      'sub/index.d.ts',
      '_dependencies/@scope/pkg/index.d.ts',
      'bundle/index.umd.min.js',
      'bin/hf-build.js',
      'bin/hf-build.d.ts',
      'README.md',
      'LICENSE.md',
      'THIRD_PARTY_LICENSES.md',
    ])
    expect(reflectFilesAllowlist(outputPath)).toEqual([
      '**/index.*',
      '**/index.d.ts',
      'LICENSE.md',
      'README.md',
      'THIRD_PARTY_LICENSES.md',
      'actions/actions.d.ts',
      'bin/hf-build.d.ts',
      'bin/hf-build.js',
      'models.d.ts',
      'models.d.ts.map',
    ])
  })

  it('covers index files at any depth with the glob rather than naming them', () => {
    writeTree(outputPath, ['index.esm.js', 'sub/index.d.ts', '_dependencies/@scope/pkg/index.d.ts', 'bundle/index.umd.min.js'])
    expect(reflectFilesAllowlist(outputPath)).toEqual(['**/index.*', '**/index.d.ts'])
  })

  it("covers an index file's sourcemap sibling with the glob", () => {
    writeTree(outputPath, ['index.esm.js', 'index.esm.js.map'])
    expect(reflectFilesAllowlist(outputPath)).not.toContain('index.esm.js.map')
  })

  it('names a root-level non-index survivor explicitly', () => {
    writeTree(outputPath, ['index.d.ts', 'models.d.ts'])
    expect(reflectFilesAllowlist(outputPath)).toContain('models.d.ts')
  })

  it('never emits a bare directory bucket', () => {
    writeTree(outputPath, ['models/models.d.ts', 'actions/actions.d.ts', 'bin/hf-build.js'])
    expect(reflectFilesAllowlist(outputPath).some((entry) => entry.endsWith('/'))).toBe(false)
  })

  it('skips the root package.json', () => {
    writeTree(outputPath, ['package.json', 'index.d.ts'])
    expect(reflectFilesAllowlist(outputPath)).not.toContain('package.json')
  })

  it('emits only the index globs for an empty output tree', () => {
    expect(reflectFilesAllowlist(outputPath)).toEqual(['**/index.*', '**/index.d.ts'])
  })

  it('emits only the index globs when the output path does not exist', () => {
    expect(reflectFilesAllowlist(join(outputPath, 'missing'))).toEqual(['**/index.*', '**/index.d.ts'])
  })
})
