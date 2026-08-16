import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
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
  let dir: string
  let warn: jest.Mock

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-normalize-'))
    warn = jest.fn()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rewrites a staging-dir source to a stable feature-derived path', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stagedMap(28949))
    normalizeDeclarationMaps(dir, '@hyperfrontend/demo-clock', warn)
    expect(parse(readFileSync(join(dir, 'index.d.ts.map'), 'utf-8'))).toEqual(
      expect.objectContaining({ sources: ['-hyperfrontend-demo-clock/src/index.ts'] })
    )
  })

  it('normalizes maps nested in subdirectories', () => {
    mkdirSync(join(dir, 'lib', 'deep'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'deep', 'inner.d.ts.map'), stagedMap(335469))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(readFileSync(join(dir, 'lib', 'deep', 'inner.d.ts.map'), 'utf-8')).not.toContain('335469')
  })

  it('produces identical bytes for maps staged under different PIDs', () => {
    writeFileSync(join(dir, 'a.d.ts.map'), stagedMap(1111))
    writeFileSync(join(dir, 'b.d.ts.map'), stagedMap(999999))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(readFileSync(join(dir, 'a.d.ts.map'), 'utf-8')).toBe(readFileSync(join(dir, 'b.d.ts.map'), 'utf-8'))
  })

  it('is idempotent across two runs', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stagedMap(28949))
    normalizeDeclarationMaps(dir, 'clock', warn)
    const first = readFileSync(join(dir, 'index.d.ts.map'), 'utf-8')
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(readFileSync(join(dir, 'index.d.ts.map'), 'utf-8')).toBe(first)
  })

  it('preserves the map key order it read', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stagedMap(28949))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(keys(parse(readFileSync(join(dir, 'index.d.ts.map'), 'utf-8')))).toEqual([
      'version',
      'file',
      'sourceRoot',
      'sources',
      'names',
      'mappings',
    ])
  })

  it('falls back to the file name when no staging segment is present', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stringify({ version: 3, sources: ['/somewhere/else/index.ts'] }))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(parse(readFileSync(join(dir, 'index.d.ts.map'), 'utf-8'))).toEqual(expect.objectContaining({ sources: ['clock/index.ts'] }))
  })

  it('leaves a non-string sources entry as it is', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stringify({ version: 3, sources: [42] }))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(parse(readFileSync(join(dir, 'index.d.ts.map'), 'utf-8'))).toEqual(expect.objectContaining({ sources: [42] }))
  })

  it('leaves files that are not declaration maps untouched', () => {
    writeFileSync(join(dir, 'index.d.ts'), 'export declare const x: number\n')
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(readFileSync(join(dir, 'index.d.ts'), 'utf-8')).toBe('export declare const x: number\n')
  })

  it('skips an unparsable map file with a note', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), 'not json')
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed declaration map'))
  })

  it('leaves an unparsable map file byte-for-byte intact', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), 'not json')
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(readFileSync(join(dir, 'index.d.ts.map'), 'utf-8')).toBe('not json')
  })

  it('skips a map whose JSON is not an object', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), '[1,2]')
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed declaration map'))
  })

  it('skips a map without a sources array', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stringify({ version: 3, mappings: 'AAAA' }))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed declaration map'))
  })

  it('does not warn on a well-formed map', () => {
    writeFileSync(join(dir, 'index.d.ts.map'), stagedMap(28949))
    normalizeDeclarationMaps(dir, 'clock', warn)
    expect(warn).not.toHaveBeenCalled()
  })
})
