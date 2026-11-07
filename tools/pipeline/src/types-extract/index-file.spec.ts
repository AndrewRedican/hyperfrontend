import ts from 'typescript'
import { describe, expect, it } from '@hyperfrontend/testing'
import { declaredNames, indexFile } from './index-file'

const SOURCE = `
import { A, B as Bee } from './a'
import type { C } from '../c'
import * as ns from './ns'
import Default from './d'
import './side-effect'
export { X, Y as Z } from './x'
export * from './star'
export { Local, Bee as Exported }
export interface Local { a: A }
export type Alias = string
export enum Kind { One }
export class Thing {}
export function run(): void {}
export const one = 1, two = 2
export namespace Space { export type T = 1 }
export default 1
declare module 'quoted' {}
export const { destructured } = { destructured: 1 }
`

describe('indexFile', () => {
  const index = indexFile('nx/src/file.ts', SOURCE)

  it('records every top-level declaration by name', () => {
    expect([...index.declarations.keys()]).toEqual(['Local', 'Alias', 'Kind', 'Thing', 'run', 'one', 'two', 'Space'])
  })

  it('records named, aliased, type-only, namespace and default imports by local name', () => {
    expect([...index.imports.entries()]).toEqual([
      ['A', { module: './a', name: 'A' }],
      ['Bee', { module: './a', name: 'B' }],
      ['C', { module: '../c', name: 'C' }],
      ['ns', { module: './ns', name: '*' }],
      ['Default', { module: './d', name: 'default' }],
    ])
  })

  it('records re-exports from modules and of local bindings', () => {
    expect(index.reExports).toEqual([
      { module: './x', name: 'X', exported: 'X' },
      { module: './x', name: 'Y', exported: 'Z' },
      { module: null, name: 'Local', exported: 'Local' },
      { module: null, name: 'Bee', exported: 'Exported' },
    ])
  })

  it('records star exports', () => {
    expect(index.starExports).toEqual(['./star'])
  })

  it('lists every statement declaring a merged name', () => {
    const merged = indexFile('nx/src/merged.ts', 'export interface A { x: 1 }\nexport interface A { y: 2 }\nexport namespace A {}')
    expect((merged.declarations.get('A') ?? []).map((statement) => ts.SyntaxKind[statement.kind])).toEqual([
      'InterfaceDeclaration',
      'InterfaceDeclaration',
      'ModuleDeclaration',
    ])
  })
})

describe('declaredNames', () => {
  it('names nothing for an expression statement', () => {
    const file = ts.createSourceFile('x.ts', 'run()', ts.ScriptTarget.Latest, true)
    expect(declaredNames(file.statements[0] as ts.Statement)).toEqual([])
  })
})
