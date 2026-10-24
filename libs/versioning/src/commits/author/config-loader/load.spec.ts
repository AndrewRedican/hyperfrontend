import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadCommitConfig } from './load'

describe('loadCommitConfig', () => {
  const dir = useTempDir({ prefix: 'commit-config-', tree: { 'package.json': '{}' } })

  it('returns an empty config when no file is found', async () => {
    dir.mkdir('.git')
    const result = await loadCommitConfig({ cwd: dir.path })
    expect(result).toEqual({ config: {} })
  })

  it('loads a .cjs config exposing module.exports', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { scopeMulti: true }')

    const result = await loadCommitConfig({ cwd: dir.path })

    expect(result).toEqual(
      expect.objectContaining({
        config: { scopeMulti: true },
        sourcePath: dir.resolve('commit.config.cjs'),
      })
    )
  })

  it('walks upward until the .git boundary when the config lives higher up', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { skipCommit: true }')
    const nested = dir.mkdir('apps/demo')

    const result = await loadCommitConfig({ cwd: nested })

    expect(result).toEqual(
      expect.objectContaining({
        config: { skipCommit: true },
        sourcePath: dir.resolve('commit.config.cjs'),
      })
    )
  })

  it('honors an explicit overridePath over the discovery walk', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { skipCommit: false }')
    const overridePath = dir.write('other.config.cjs', 'module.exports = { skipCommit: true }')

    const result = await loadCommitConfig({ cwd: dir.path, overridePath })

    expect(result).toEqual(
      expect.objectContaining({
        config: { skipCommit: true },
        sourcePath: overridePath,
      })
    )
  })

  it('throws when the override path is missing', async () => {
    await expect(loadCommitConfig({ cwd: dir.path, overridePath: dir.resolve('nope.cjs') })).rejects.toThrow(/Config file not found/)
  })

  it('throws when the module export is not an object', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = 42')

    await expect(loadCommitConfig({ cwd: dir.path })).rejects.toThrow(/must export an object/)
  })

  it('rejects configs whose headerMaxLength is not number|null', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { headerMaxLength: "nope" }')

    await expect(loadCommitConfig({ cwd: dir.path })).rejects.toThrow(/headerMaxLength/)
  })

  it('rejects configs whose types entries lack a name', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { types: [{ desc: "x" }] }')

    await expect(loadCommitConfig({ cwd: dir.path })).rejects.toThrow(/types/)
  })

  it('rejects configs whose types field is not an array', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { types: "nope" }')

    await expect(loadCommitConfig({ cwd: dir.path })).rejects.toThrow(/types/)
  })

  it('accepts an absolute override path without reinterpreting against cwd', async () => {
    const overridePath = dir.write('other.cjs', 'module.exports = { skipCommit: true }')

    const result = await loadCommitConfig({ cwd: dir.path, overridePath })

    expect(result).toEqual(expect.objectContaining({ config: { skipCommit: true }, sourcePath: overridePath }))
  })

  it('accepts a config with a fully-formed types array', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { types: [{ name: "feat", description: "A feature" }] }')

    const result = await loadCommitConfig({ cwd: dir.path })

    expect(result.config.types).toEqual([{ name: 'feat', description: 'A feature' }])
  })

  it('rejects configs whose types array holds a primitive entry', async () => {
    dir.mkdir('.git')
    dir.write('commit.config.cjs', 'module.exports = { types: [42] }')

    await expect(loadCommitConfig({ cwd: dir.path })).rejects.toThrow(/types/)
  })
})
