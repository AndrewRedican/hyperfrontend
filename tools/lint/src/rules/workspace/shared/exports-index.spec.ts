import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { moduleDeclarations, moduleExports, parsedModule, resolveModule } from './exports-index.ts'

const ROOT = mkdtempSync(join(tmpdir(), 'lint-exports-'))
const write = (path: string, text: string): void => {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true })
  writeFileSync(join(ROOT, path), text)
}
write(
  'src/index.ts',
  [
    "import { inner as renamed, 'odd' as odd } from './inner.js'",
    "import missing from './nowhere'",
    "export * from './star'",
    "export * as ns from './star'",
    "export { one as uno, type Two } from './star'",
    "export { gone } from './nowhere'",
    'export { renamed, local, odd, unbound }',
    'const local = 1',
    'export default function main() {}',
    "export { 'quoted' as spelled } from './star'",
  ].join('\n')
)
write('src/star.ts', "export const one = 1\nexport type Two = string\nexport { one as 'quoted' }")
write('src/inner.ts', 'export function inner() {}\nexport const odd = 2')
write(
  'src/patterns.ts',
  [
    'export const { a, b: [c, , d = 1], ...rest } = source',
    'export const [e, ...f] = list',
    'export function g() {}',
    'export class H {}',
    'export interface I {}',
    'export type J = 1',
    'export enum K {}',
    'export namespace L {}',
    'export declare function m(): void',
    'export default 1',
    'let n = 1',
    'export { n }',
    'if (x) {}',
  ].join('\n')
)
write('src/cycle/a.ts', "export * from './b'\nexport const fromA = 1")
write('src/cycle/b.ts', "export * from './a'\nexport const fromB = 2")
write('src/broken.ts', 'export const = ')
write('src/types.d.ts', 'export declare const typed: number')
write('src/emitted.ts', 'export const emitted = 1')
write('src/folder/index.mts', 'export const folder = 1')

describe('parsedModule', () => {
  it('parses a declaration file', () => {
    expect(parsedModule(join(ROOT, 'src/types.d.ts'))?.kind).toBe('Program')
  })

  it('answers null for a file that does not parse', () => {
    expect(parsedModule(join(ROOT, 'src/broken.ts'))).toBe(null)
  })

  it('answers null for a missing file', () => {
    expect(parsedModule(join(ROOT, 'src/missing.ts'))).toBe(null)
  })

  it('answers the same file again from memory', () => {
    expect(parsedModule(join(ROOT, 'src/missing.ts'))).toBe(null)
  })
})

describe('resolveModule', () => {
  it('answers null for a bare specifier', () => {
    expect(resolveModule(join(ROOT, 'src/index.ts'), 'react')).toBe(null)
  })

  it('maps an emitted extension to its source', () => {
    expect(resolveModule(join(ROOT, 'src/index.ts'), './emitted.js')).toBe(join(ROOT, 'src/emitted.ts'))
  })

  it('tries the index files of a directory', () => {
    expect(resolveModule(join(ROOT, 'src/index.ts'), './folder')).toBe(join(ROOT, 'src/folder/index.mts'))
  })

  it('accepts an absolute specifier', () => {
    expect(resolveModule(join(ROOT, 'src/index.ts'), join(ROOT, 'src/star.ts'))).toBe(join(ROOT, 'src/star.ts'))
  })

  it('answers null for a file that does not exist', () => {
    expect(resolveModule(join(ROOT, 'src/index.ts'), './nowhere')).toBe(null)
  })
})

describe('moduleDeclarations', () => {
  it('lists every binding with its kind and whether it is exported', () => {
    expect(moduleDeclarations(join(ROOT, 'src/patterns.ts')).map((item) => [item.name, item.kind, item.exported])).toEqual([
      ['a', 'variable', true],
      ['c', 'variable', true],
      ['d', 'variable', true],
      ['rest', 'variable', true],
      ['e', 'variable', true],
      ['f', 'variable', true],
      ['g', 'function', true],
      ['H', 'class', true],
      ['I', 'interface', true],
      ['J', 'type', true],
      ['K', 'enum', true],
      ['L', 'namespace', true],
      ['m', 'function', true],
      ['n', 'variable', true],
    ])
  })

  it('answers the same file again from memory', () => {
    expect(moduleDeclarations(join(ROOT, 'src/patterns.ts'))).toHaveLength(14)
  })

  it('answers nothing for a file that does not parse', () => {
    expect(moduleDeclarations(join(ROOT, 'src/broken.ts'))).toEqual([])
  })
})

describe('moduleExports', () => {
  it('follows stars, lists, imports and defaults to the declaring files', () => {
    expect(moduleExports(join(ROOT, 'src/index.ts')).map((item) => [item.name, item.kind, item.file.slice(ROOT.length + 1)])).toEqual([
      ['local', 'variable', 'src/index.ts'],
      ['one', 'variable', 'src/star.ts'],
      ['Two', 'type', 'src/star.ts'],
      ['quoted', 'variable', 'src/star.ts'],
      ['ns', 'namespace', 'src/index.ts'],
      ['uno', 'variable', 'src/star.ts'],
      ['Two', 'type', 'src/star.ts'],
      ['gone', 'unknown', 'src/index.ts'],
      ['renamed', 'function', 'src/inner.ts'],
      ['odd', 'variable', 'src/inner.ts'],
      ['unbound', 'unknown', 'src/index.ts'],
      ['default', 'unknown', 'src/index.ts'],
      ['spelled', 'variable', 'src/star.ts'],
    ])
  })

  it('answers the same file again from memory', () => {
    expect(moduleExports(join(ROOT, 'src/index.ts'))).toHaveLength(13)
  })

  it('cuts a re-export cycle and still lists what each side declares', () => {
    expect([
      moduleExports(join(ROOT, 'src/cycle/a.ts')).map((item) => item.name),
      moduleExports(join(ROOT, 'src/cycle/b.ts')).map((item) => item.name),
    ]).toEqual([
      ['fromA', 'fromB'],
      ['fromB', 'fromA'],
    ])
  })

  it('answers nothing for a missing file', () => {
    expect(moduleExports(join(ROOT, 'src/missing.ts'))).toEqual([])
  })
})

describe('the disposable directory', () => {
  it('is removed once the cases have run', () => {
    rmSync(ROOT, { recursive: true })
    expect(resolveModule(join(ROOT, 'src/index.ts'), './star')).toBe(null)
  })
})
