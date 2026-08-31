import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { loadCommitConfig } from './load'

describe('loadCommitConfig', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'commit-config-'))
    writeFileSync(join(tempDir, 'package.json'), '{}')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns an empty config when no file is found', async () => {
    mkdirSync(join(tempDir, '.git'))
    const result = await loadCommitConfig({ cwd: tempDir })
    expect(result).toEqual({ config: {} })
  })

  it('loads a .cjs config exposing module.exports', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { scopeMulti: true }')

    const result = await loadCommitConfig({ cwd: tempDir })

    expect(result).toEqual(
      expect.objectContaining({
        config: { scopeMulti: true },
        sourcePath: join(tempDir, 'commit.config.cjs'),
      })
    )
  })

  it('walks upward until the .git boundary when the config lives higher up', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { skipCommit: true }')
    const nested = join(tempDir, 'apps', 'demo')
    mkdirSync(nested, { recursive: true })

    const result = await loadCommitConfig({ cwd: nested })

    expect(result).toEqual(
      expect.objectContaining({
        config: { skipCommit: true },
        sourcePath: join(tempDir, 'commit.config.cjs'),
      })
    )
  })

  it('honors an explicit overridePath over the discovery walk', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { skipCommit: false }')
    const overridePath = join(tempDir, 'other.config.cjs')
    writeFileSync(overridePath, 'module.exports = { skipCommit: true }')

    const result = await loadCommitConfig({ cwd: tempDir, overridePath })

    expect(result).toEqual(
      expect.objectContaining({
        config: { skipCommit: true },
        sourcePath: overridePath,
      })
    )
  })

  it('throws when the override path is missing', async () => {
    await expect(loadCommitConfig({ cwd: tempDir, overridePath: join(tempDir, 'nope.cjs') })).rejects.toThrow(/Config file not found/)
  })

  it('throws when the module export is not an object', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = 42')

    await expect(loadCommitConfig({ cwd: tempDir })).rejects.toThrow(/must export an object/)
  })

  it('rejects configs whose headerMaxLength is not number|null', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { headerMaxLength: "nope" }')

    await expect(loadCommitConfig({ cwd: tempDir })).rejects.toThrow(/headerMaxLength/)
  })

  it('rejects configs whose types entries lack a name', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { types: [{ desc: "x" }] }')

    await expect(loadCommitConfig({ cwd: tempDir })).rejects.toThrow(/types/)
  })

  it('rejects configs whose types field is not an array', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { types: "nope" }')

    await expect(loadCommitConfig({ cwd: tempDir })).rejects.toThrow(/types/)
  })

  it('accepts an absolute override path without reinterpreting against cwd', async () => {
    const overridePath = join(tempDir, 'other.cjs')
    writeFileSync(overridePath, 'module.exports = { skipCommit: true }')

    const result = await loadCommitConfig({ cwd: tempDir, overridePath })

    expect(result).toEqual(expect.objectContaining({ config: { skipCommit: true }, sourcePath: overridePath }))
  })

  it('accepts a config with a fully-formed types array', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { types: [{ name: "feat", description: "A feature" }] }')

    const result = await loadCommitConfig({ cwd: tempDir })

    expect(result.config.types).toEqual([{ name: 'feat', description: 'A feature' }])
  })

  it('rejects configs whose types array holds a primitive entry', async () => {
    mkdirSync(join(tempDir, '.git'))
    writeFileSync(join(tempDir, 'commit.config.cjs'), 'module.exports = { types: [42] }')

    await expect(loadCommitConfig({ cwd: tempDir })).rejects.toThrow(/types/)
  })
})
