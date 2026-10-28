import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson, updateJson, writeJson } from './tree'

describe('readJson', () => {
  it('parses the file', () => {
    expect(readJson(createMemoryTree({ 'a.json': '{"name":"a"}' }), 'a.json')).toEqual({ name: 'a' })
  })

  it('names a missing file', () => {
    expect(() => readJson(createMemoryTree(), 'missing.json')).toThrow('Cannot find missing.json')
  })

  it('names a file that does not parse', () => {
    expect(() => readJson(createMemoryTree({ 'bad.json': '{' }), 'bad.json')).toThrow(/^Cannot parse bad\.json: /)
  })
})

describe('writeJson', () => {
  it('writes two-space JSON with a trailing newline', () => {
    const tree = createMemoryTree()
    writeJson(tree, 'out.json', { a: [1] })
    expect(tree.read('out.json', 'utf-8')).toBe('{\n  "a": [\n    1\n  ]\n}\n')
  })
})

describe('updateJson', () => {
  it('writes what the updater returns for the parsed file', () => {
    const tree = createMemoryTree({ 'p.json': '{"name":"old","keep":true}\n' })
    updateJson<{ name: string; keep: boolean }>(tree, 'p.json', (json) => ({ ...json, name: 'new' }))
    expect(tree.read('p.json', 'utf-8')).toBe('{\n  "name": "new",\n  "keep": true\n}\n')
  })
})
