import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { after, describe, it } from 'node:test'
import { createTempDir, useTempDir } from './temp-dir'

describe('createTempDir', () => {
  const dir = createTempDir({ tree: { 'package.json': { name: 'app' }, 'src/index.ts': 'export {}\n' } })
  after(() => dir.remove())

  it('creates the directory', () => {
    assert.equal(statSync(dir.path).isDirectory(), true)
  })

  it('reports the path with symbolic links resolved', () => {
    assert.equal(realpathSync(dir.path), dir.path)
  })

  it('names the directory with the default prefix', () => {
    assert.equal(basename(dir.path).startsWith('hf-test-'), true)
  })

  it('writes the initial tree', () => {
    assert.equal(dir.read('src/index.ts'), 'export {}\n')
  })

  it('reads and parses a JSON file', () => {
    assert.deepEqual(dir.readJson('package.json'), { name: 'app' })
  })

  it('writes a file and returns its absolute path', () => {
    assert.equal(dir.write('notes/a.txt', 'a'), join(dir.path, 'notes', 'a.txt'))
  })

  it('writes a further tree', () => {
    dir.writeTree({ 'more/b.txt': 'b' })
    assert.equal(dir.read('more/b.txt'), 'b')
  })

  it('reports whether a path exists', () => {
    assert.deepEqual({ manifest: dir.exists('package.json'), missing: dir.exists('missing.txt') }, { manifest: true, missing: false })
  })

  it('creates a directory and returns its absolute path', () => {
    const created = dir.mkdir('empty/inner')
    assert.equal(statSync(created).isDirectory(), true)
  })

  it('refuses to create a directory outside itself', () => {
    assert.throws(() => dir.mkdir('../outside'), /outside/)
  })

  it('joins segments onto its path', () => {
    assert.equal(dir.resolve('src', 'index.ts'), join(dir.path, 'src', 'index.ts'))
  })
})

describe('createTempDir options', () => {
  const parent = mkdtempSync(join(tmpdir(), 'hf-temp-parent-'))
  after(() => rmSync(parent, { recursive: true, force: true }))

  it('creates the directory in the given parent, with the given prefix', () => {
    const dir = createTempDir({ parent: join(parent, 'made'), prefix: 'custom-' })
    // why: on Windows the temporary directory can carry an 8.3 short name (RUNNER~1), which only the native resolution expands, as createTempDir does.
    assert.deepEqual(
      { parent: dirname(dir.path), named: basename(dir.path).startsWith('custom-') },
      { parent: realpathSync.native(join(parent, 'made')), named: true }
    )
  })

  it('deletes the directory on remove, and a second remove is harmless', () => {
    const dir = createTempDir({ parent })
    dir.remove()
    dir.remove()
    assert.equal(existsSync(dir.path), false)
  })
})

describe('useTempDir for each test', () => {
  const dir = useTempDir({ tree: { 'seed.txt': 'seed' } })
  const seen: string[] = []
  let outside: unknown
  try {
    void dir.path
  } catch (error) {
    outside = error
  }

  it('gives a test a directory holding the initial tree', () => {
    seen.push(dir.path)
    assert.equal(dir.read('seed.txt'), 'seed')
  })

  it('gives the next test a different directory and deletes the previous one', () => {
    assert.deepEqual({ fresh: dir.path !== seen[0], previousGone: !existsSync(seen[0] ?? '') }, { fresh: true, previousGone: true })
  })

  it('throws when read outside a test', () => {
    assert.match(String(outside), /exists only while a test or hook of the suite runs/)
  })
})

describe('useTempDir shared by the suite', () => {
  const dir = useTempDir({ scope: 'all' })
  const seen: string[] = []

  it('gives the first test the shared directory', () => {
    seen.push(dir.path)
    dir.write('shared.txt', 'kept')
    assert.equal(dir.exists('shared.txt'), true)
  })

  it('gives the next test the same directory, with what earlier tests wrote', () => {
    assert.deepEqual({ same: dir.path === seen[0], kept: dir.read('shared.txt') }, { same: true, kept: 'kept' })
  })
})
