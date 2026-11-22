import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { amendJson, readJson, updateJson, writeJson } from './tree'

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

describe('amendJson', () => {
  it('writes what the updater returns when that differs from the parsed file', () => {
    const tree = createMemoryTree({ 'p.json': '{"name":"old","keep":true}\n' })
    amendJson<{ name: string; keep: boolean }>(tree, 'p.json', (json) => ({ ...json, name: 'new' }))
    expect(tree.read('p.json', 'utf-8')).toBe('{\n  "name": "new",\n  "keep": true\n}\n')
  })

  it('writes a value the updater changed in place', () => {
    const tree = createMemoryTree({ 'p.json': '{"tags":["a"]}\n' })
    amendJson<{ tags: string[] }>(tree, 'p.json', (json) => {
      json.tags.push('b')
      return json
    })
    expect(readJson(tree, 'p.json')).toEqual({ tags: ['a', 'b'] })
  })

  it('leaves the file as it is written when the updater changes nothing', () => {
    const tree = createMemoryTree({ 'p.json': '{ "name": "same",   "tags": ["a",\n"b"] }' })
    amendJson<{ name: string }>(tree, 'p.json', (json) => ({ ...json, name: 'same' }))
    expect({ text: tree.read('p.json', 'utf-8'), changes: tree.listChanges() }).toEqual({
      text: '{ "name": "same",   "tags": ["a",\n"b"] }',
      changes: [],
    })
  })

  it.each([
    ['a change', 'new', true],
    ['no change', 'old', false],
  ])('answers whether it wrote, for %s', (_case, name, wrote) => {
    expect(amendJson<{ name: string }>(createMemoryTree({ 'p.json': '{"name":"old"}' }), 'p.json', (json) => ({ ...json, name }))).toBe(
      wrote
    )
  })
})
