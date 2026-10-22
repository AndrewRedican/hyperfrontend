import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { BASE_CONFIG, baseConfigRootOf, pathAliases } from './aliases.ts'

const ROOT = mkdtempSync(join(tmpdir(), 'lint-aliases-'))
const write = (name: string, text: string): void => {
  mkdirSync(join(ROOT, name), { recursive: true })
  writeFileSync(join(ROOT, name, BASE_CONFIG), text)
}
write('good', JSON.stringify({ compilerOptions: { paths: { a: ['src/a.ts'], b: [], c: 'src/c.ts', d: [1] } } }))
write('broken', '{')
write('nopaths', JSON.stringify({ compilerOptions: {} }))
write('listpaths', JSON.stringify({ compilerOptions: { paths: ['x'] } }))
mkdirSync(join(ROOT, 'good', 'src', 'deep'), { recursive: true })
mkdirSync(join(ROOT, 'none'), { recursive: true })

describe('baseConfigRootOf', () => {
  it('finds the configuration above a nested directory', () => {
    expect(baseConfigRootOf(join(ROOT, 'good', 'src', 'deep'))).toBe(join(ROOT, 'good'))
  })

  it('answers the same directory again from memory', () => {
    expect(baseConfigRootOf(join(ROOT, 'good', 'src', 'deep'))).toBe(join(ROOT, 'good'))
  })

  it('answers null when no ancestor holds the configuration', () => {
    expect(baseConfigRootOf(join(ROOT, 'none'))).toBe(null)
  })
})

describe('pathAliases', () => {
  it('reads each alias with the first source it maps to', () => {
    expect(pathAliases(join(ROOT, 'good'))).toEqual([
      { alias: 'a', source: join(ROOT, 'good', 'src/a.ts') },
      { alias: 'b', source: null },
      { alias: 'c', source: null },
      { alias: 'd', source: null },
    ])
  })

  it('answers the same root again from memory', () => {
    expect(pathAliases(join(ROOT, 'good'))).toHaveLength(4)
  })

  it('answers nothing for a configuration that does not parse', () => {
    expect(pathAliases(join(ROOT, 'broken'))).toEqual([])
  })

  it('answers nothing for a configuration without paths', () => {
    expect(pathAliases(join(ROOT, 'nopaths'))).toEqual([])
  })

  it('answers nothing for paths that are no object', () => {
    expect(pathAliases(join(ROOT, 'listpaths'))).toEqual([])
  })

  it('answers nothing for a missing configuration', () => {
    expect(pathAliases(join(ROOT, 'none'))).toEqual([])
  })
})

describe('the disposable directory', () => {
  it('is removed once the cases have run', () => {
    rmSync(ROOT, { recursive: true })
    expect(baseConfigRootOf(join(ROOT, 'gone'))).toBe(null)
  })
})
