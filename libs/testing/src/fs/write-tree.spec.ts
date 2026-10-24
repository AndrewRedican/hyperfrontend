import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { within, writeFile, writeTree } from './write-tree'

const ROOT = mkdtempSync(join(tmpdir(), 'hf-write-tree-'))
after(() => rmSync(ROOT, { recursive: true, force: true }))

describe('writeFile', () => {
  it('writes text as given', () => {
    writeFile(ROOT, 'text.txt', 'plain\n')
    assert.equal(readFileSync(join(ROOT, 'text.txt'), 'utf8'), 'plain\n')
  })

  it('writes bytes as given', () => {
    writeFile(ROOT, 'bytes.bin', new Uint8Array([0, 255]))
    assert.deepEqual([...readFileSync(join(ROOT, 'bytes.bin'))], [0, 255])
  })

  it('writes any other value as pretty-printed JSON with a trailing newline', () => {
    writeFile(ROOT, 'package.json', { name: 'app' })
    assert.equal(readFileSync(join(ROOT, 'package.json'), 'utf8'), '{\n  "name": "app"\n}\n')
  })

  it('creates the parent directories a path names', () => {
    writeFile(ROOT, 'deep/nested/file.ts', 'export {}\n')
    assert.equal(readFileSync(join(ROOT, 'deep', 'nested', 'file.ts'), 'utf8'), 'export {}\n')
  })

  it('returns the absolute path of the written file', () => {
    assert.equal(writeFile(ROOT, 'returned.txt', ''), join(ROOT, 'returned.txt'))
  })
})

describe('writeTree', () => {
  it('writes every file in the tree', () => {
    const root = join(ROOT, 'tree')
    writeTree(root, { 'a.txt': 'a', 'b/c.json': [1] })
    assert.deepEqual([readFileSync(join(root, 'a.txt'), 'utf8'), readFileSync(join(root, 'b', 'c.json'), 'utf8')], ['a', '[\n  1\n]\n'])
  })
})

describe('within', () => {
  it('resolves a relative path inside the root', () => {
    assert.equal(within(ROOT, 'src/index.ts'), join(ROOT, 'src', 'index.ts'))
  })

  it('refuses a path that climbs out of the root', () => {
    assert.throws(() => within(ROOT, '../escape.ts'), /outside/)
  })

  it('refuses an absolute path', () => {
    assert.throws(() => within(ROOT, join(ROOT, 'inside.ts')), /outside/)
  })
})
