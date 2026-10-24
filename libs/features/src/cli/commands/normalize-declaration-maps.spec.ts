import type { Mock } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { normalizeDeclarationMaps } from './normalize-declaration-maps'

const stagedMap = (pid: number): string =>
  stringify({
    version: 3,
    file: 'index.d.ts',
    sourceRoot: '',
    sources: [`../../../../apps/demos/clock/.hf-shell--hyperfrontend-demo-clock-${pid}/src/index.ts`],
    names: [],
    mappings: 'AAAA',
  })

describe('normalizeDeclarationMaps', () => {
  const tmp = useTempDir({ prefix: 'hf-normalize-' })
  let warn: Mock

  beforeEach(() => {
    warn = jest.fn()
  })

  it('rewrites a staging-dir source to a stable feature-derived path', () => {
    tmp.write('index.d.ts.map', stagedMap(28949))
    normalizeDeclarationMaps(tmp.path, '@hyperfrontend/demo-clock', warn)
    expect(parse(tmp.read('index.d.ts.map'))).toEqual(expect.objectContaining({ sources: ['-hyperfrontend-demo-clock/src/index.ts'] }))
  })

  it('normalizes maps nested in subdirectories', () => {
    tmp.mkdir('lib/deep')
    tmp.write('lib/deep/inner.d.ts.map', stagedMap(335469))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(tmp.read('lib/deep/inner.d.ts.map')).not.toContain('335469')
  })

  it('produces identical bytes for maps staged under different PIDs', () => {
    tmp.write('a.d.ts.map', stagedMap(1111))
    tmp.write('b.d.ts.map', stagedMap(999999))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(tmp.read('a.d.ts.map')).toBe(tmp.read('b.d.ts.map'))
  })

  it('is idempotent across two runs', () => {
    tmp.write('index.d.ts.map', stagedMap(28949))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    const first = tmp.read('index.d.ts.map')
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(tmp.read('index.d.ts.map')).toBe(first)
  })

  it('preserves the map key order it read', () => {
    tmp.write('index.d.ts.map', stagedMap(28949))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(keys(parse(tmp.read('index.d.ts.map')))).toEqual(['version', 'file', 'sourceRoot', 'sources', 'names', 'mappings'])
  })

  it('falls back to the file name when no staging segment is present', () => {
    tmp.write('index.d.ts.map', stringify({ version: 3, sources: ['/somewhere/else/index.ts'] }))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(parse(tmp.read('index.d.ts.map'))).toEqual(expect.objectContaining({ sources: ['clock/index.ts'] }))
  })

  it('leaves a non-string sources entry as it is', () => {
    tmp.write('index.d.ts.map', stringify({ version: 3, sources: [42] }))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(parse(tmp.read('index.d.ts.map'))).toEqual(expect.objectContaining({ sources: [42] }))
  })

  it('leaves files that are not declaration maps untouched', () => {
    tmp.write('index.d.ts', 'export declare const x: number\n')
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(tmp.read('index.d.ts')).toBe('export declare const x: number\n')
  })

  it('skips an unparsable map file with a note', () => {
    tmp.write('index.d.ts.map', 'not json')
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed declaration map'))
  })

  it('leaves an unparsable map file byte-for-byte intact', () => {
    tmp.write('index.d.ts.map', 'not json')
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(tmp.read('index.d.ts.map')).toBe('not json')
  })

  it('skips a map whose JSON is not an object', () => {
    tmp.write('index.d.ts.map', '[1,2]')
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed declaration map'))
  })

  it('skips a map without a sources array', () => {
    tmp.write('index.d.ts.map', stringify({ version: 3, mappings: 'AAAA' }))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed declaration map'))
  })

  it('does not warn on a well-formed map', () => {
    tmp.write('index.d.ts.map', stagedMap(28949))
    normalizeDeclarationMaps(tmp.path, 'clock', warn)
    expect(warn).not.toHaveBeenCalled()
  })
})
