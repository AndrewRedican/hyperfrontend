import type { AssetSpec, PackageJson } from '../../models'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyAssets } from './copy-assets'
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  return {
    ...actual,
    logger: { channel: jest.fn(() => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() })) },
  }
})

const PKG: PackageJson = { name: 'foo' }

describe('copyAssets', () => {
  let root: string
  let from: string
  let outputPath: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-assets-'))
    from = join(root, 'src')
    outputPath = join(root, 'out')
    mkdirSync(from, { recursive: true })
    mkdirSync(outputPath, { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('copies an explicit list of files into the dist root by default', () => {
    writeFileSync(join(from, 'README.md'), 'r')
    writeFileSync(join(from, 'CHANGELOG.md'), 'c')
    copyAssets([{ from, files: ['README.md', 'CHANGELOG.md'] }], outputPath, PKG)
    expect(readFileSync(join(outputPath, 'README.md'), 'utf-8')).toBe('r')
    expect(readFileSync(join(outputPath, 'CHANGELOG.md'), 'utf-8')).toBe('c')
  })

  it('honors an explicit `to` subdirectory', () => {
    writeFileSync(join(from, 'doc.md'), 'd')
    copyAssets([{ from, to: 'docs', files: ['doc.md'] }], outputPath, PKG)
    expect(readFileSync(join(outputPath, 'docs', 'doc.md'), 'utf-8')).toBe('d')
  })

  it('treats `to: "."` the same as omitting `to`', () => {
    writeFileSync(join(from, 'README.md'), 'r')
    copyAssets([{ from, to: '.', files: ['README.md'] }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'README.md'))).toBe(true)
  })

  it('silently skips entries from the explicit list that are missing on disk', () => {
    writeFileSync(join(from, 'README.md'), 'r')
    copyAssets([{ from, files: ['README.md', 'MISSING.md'] }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'README.md'))).toBe(true)
    expect(existsSync(join(outputPath, 'MISSING.md'))).toBe(false)
  })

  it('copies files matching a glob pattern under the source root', () => {
    writeFileSync(join(from, 'a.md'), 'a')
    writeFileSync(join(from, 'b.md'), 'b')
    writeFileSync(join(from, 'c.txt'), 'c')
    copyAssets([{ from, glob: '*.md' }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'a.md'))).toBe(true)
    expect(existsSync(join(outputPath, 'b.md'))).toBe(true)
    expect(existsSync(join(outputPath, 'c.txt'))).toBe(false)
  })

  it('preserves nested directory structure when copying glob matches', () => {
    mkdirSync(join(from, 'sub'), { recursive: true })
    writeFileSync(join(from, 'sub', 'nested.md'), 'n')
    copyAssets([{ from, glob: '**/*.md' }], outputPath, PKG)
    expect(readFileSync(join(outputPath, 'sub', 'nested.md'), 'utf-8')).toBe('n')
  })

  it('skips a spec whose condition predicate returns false', () => {
    writeFileSync(join(from, 'README.md'), 'r')
    copyAssets([{ from, files: ['README.md'], condition: () => false }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'README.md'))).toBe(false)
  })

  it('runs a spec when its condition predicate returns true', () => {
    writeFileSync(join(from, 'README.md'), 'r')
    copyAssets([{ from, files: ['README.md'], condition: (pkg) => pkg.name === 'foo' }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'README.md'))).toBe(true)
  })

  it('skips a spec whose source directory does not exist', () => {
    copyAssets([{ from: join(root, 'missing'), files: ['x.md'] }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'x.md'))).toBe(false)
  })

  it('emits nothing when neither files nor glob are configured on a spec', () => {
    writeFileSync(join(from, 'a.md'), 'a')
    copyAssets([{ from }], outputPath, PKG)
    expect(existsSync(join(outputPath, 'a.md'))).toBe(false)
  })

  it('processes multiple specs in declaration order', () => {
    const second = join(root, 'second')
    mkdirSync(second, { recursive: true })
    writeFileSync(join(from, 'a.md'), 'a')
    writeFileSync(join(second, 'b.md'), 'b')
    copyAssets(
      [
        { from, files: ['a.md'] },
        { from: second, files: ['b.md'] },
      ],
      outputPath,
      PKG
    )
    expect(existsSync(join(outputPath, 'a.md'))).toBe(true)
    expect(existsSync(join(outputPath, 'b.md'))).toBe(true)
  })

  it('skips entries from the explicit list that resolve to a directory rather than a file', () => {
    mkdirSync(join(from, 'docs'), { recursive: true })
    writeFileSync(join(from, 'README.md'), 'r')
    const spec: AssetSpec = { from, files: ['README.md', 'docs'] }
    copyAssets([spec], outputPath, PKG)
    expect(existsSync(join(outputPath, 'README.md'))).toBe(true)
    expect(existsSync(join(outputPath, 'docs'))).toBe(false)
  })
})
