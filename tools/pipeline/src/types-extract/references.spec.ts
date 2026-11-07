import ts from 'typescript'
import { describe, expect, it } from '@hyperfrontend/testing'
import { collectReferences, positionOf } from './references'

/**
 * The first statement of a source text, with its file.
 *
 * @param text - The source
 * @returns The statement and the file
 */
function statementOf(text: string): { node: ts.Statement; sourceFile: ts.SourceFile } {
  const sourceFile = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return { node: sourceFile.statements[0] as ts.Statement, sourceFile }
}

/**
 * The references of the first statement, as name, qualifier, depth flag and position.
 *
 * @param text - The source
 * @returns The references, summarised
 */
function referencesOf(text: string): unknown[] {
  const { node, sourceFile } = statementOf(text)
  return collectReferences(node, sourceFile).references.map((reference) => [
    reference.name,
    reference.qualifier,
    reference.deep,
    reference.position,
  ])
}

/**
 * The rewritten constructs of the first statement, as kind, position and inserted text.
 *
 * @param text - The source
 * @returns The oddities, summarised
 */
function odditiesOf(text: string): unknown[] {
  const { node, sourceFile } = statementOf(text)
  return collectReferences(node, sourceFile).oddities.map((oddity) => [
    oddity.kind,
    oddity.position,
    oddity.insertText ?? oddity.node.getText(sourceFile),
  ])
}

describe('collectReferences', () => {
  it('finds property, parameter, return and type-argument references with their positions', () => {
    expect(referencesOf('interface A { p: P; m(x: X): R; r: Record<string, V> }')).toEqual([
      ['P', null, false, 'property'],
      ['X', null, false, 'parameter'],
      ['R', null, false, 'return'],
      ['Record', null, false, 'property'],
      ['V', null, false, 'type-argument'],
    ])
  })

  it('finds heritage references and the type arguments on them', () => {
    expect(referencesOf('interface A extends B<C>, D {}')).toEqual([
      ['B', null, false, 'heritage'],
      ['C', null, false, 'type-argument'],
      ['D', null, false, 'heritage'],
    ])
  })

  it('finds generic constraint and default references', () => {
    expect(referencesOf('type A<T extends C = D> = T')).toEqual([
      ['C', null, false, 'generic-constraint'],
      ['D', null, false, 'generic-default'],
    ])
  })

  it('finds the value of an index signature and the body of an alias', () => {
    expect(referencesOf('type A = { [k: string]: V } | W')).toEqual([
      ['V', null, false, 'index-signature'],
      ['W', null, false, 'alias'],
    ])
  })

  it('reads through unions, arrays, tuples, mapped and conditional types', () => {
    expect(referencesOf('type A<T> = { [K in keyof T]: T[K] extends infer U ? Box<U> : Alt[] }')).toEqual([
      ['Box', null, false, 'alias'],
      ['Alt', null, false, 'alias'],
    ])
  })

  it('skips type parameters, infer names and mapped keys in scope', () => {
    expect(referencesOf('interface A<T> { m<U>(u: U): T; n: { [K in string]: K } }')).toEqual([])
  })

  it('splits a qualified name into qualifier and name', () => {
    expect(referencesOf('type A = ns.Member')).toEqual([['Member', 'ns', false, 'alias']])
  })

  it('flags a name deeper than two segments', () => {
    expect(referencesOf('type A = a.b.C')).toEqual([['C', 'a', true, 'alias']])
  })

  it('reads a property access in a heritage clause as a qualified name', () => {
    expect(referencesOf('class A extends ns.Base {}')).toEqual([['Base', 'ns', false, 'heritage']])
  })

  it('ignores a heritage expression that is not a name', () => {
    expect(referencesOf('class A extends mixin() {}')).toEqual([])
  })

  it('ignores a property access on an expression that is not a name', () => {
    expect(referencesOf('class A extends mixin().Base {}')).toEqual([])
  })

  it('does not descend into typeof, import types or any', () => {
    expect(referencesOf('type A = typeof value | import("./m").T | any')).toEqual([])
  })

  it('reports typeof, import types and any as rewritten', () => {
    expect(odditiesOf('type A = (typeof value)[number] | import("./m").T | any')).toEqual([
      ['typeof', 'alias', 'typeof value'],
      ['import-type', 'alias', 'import("./m").T'],
      ['any', 'alias', 'any'],
    ])
  })

  it('annotates untyped and rest parameters', () => {
    expect(odditiesOf('type A = (tree, ...rest) => void')).toEqual([
      ['untyped-parameter', 'parameter', ': unknown'],
      ['untyped-parameter', 'parameter', ': unknown[]'],
    ])
  })

  it('annotates an optional untyped parameter after its question mark', () => {
    const { node, sourceFile } = statementOf('type A = (tree?) => void')
    const oddity = collectReferences(node, sourceFile).oddities[0]
    expect(sourceFile.text.slice(0, oddity?.insertAt)).toBe('type A = (tree?')
  })

  it('annotates untyped members and missing return types', () => {
    const { node, sourceFile } = statementOf('interface A { p; q?; m(x: number); }')
    const result = collectReferences(node, sourceFile).oddities.map((oddity) => [
      oddity.kind,
      oddity.position,
      sourceFile.text.slice(0, oddity.insertAt),
    ])
    expect(result).toEqual([
      ['untyped-member', 'property', 'interface A { p'],
      ['untyped-member', 'property', 'interface A { p; q?'],
      ['untyped-member', 'return', 'interface A { p; q?; m(x: number)'],
    ])
  })

  it('does not flag typed parameters and members', () => {
    expect(odditiesOf('interface A { p: string; m(x: number): void }')).toEqual([])
  })
})

describe('positionOf', () => {
  it('answers other for the declaration itself', () => {
    const { node } = statementOf('type A = [B]')
    expect(positionOf(node, node)).toBe('other')
  })

  it('answers other for a node whose ancestry names no position', () => {
    const { node } = statementOf('declare function f(): [B]')
    const tuple = (node as ts.FunctionDeclaration).type as ts.TupleTypeNode
    expect(positionOf(tuple.elements[0] as ts.Node, tuple)).toBe('other')
  })

  it('answers return for a function type', () => {
    const { node } = statementOf('type A = () => R')
    const reference = ((node as ts.TypeAliasDeclaration).type as ts.FunctionTypeNode).type
    expect(positionOf(reference, node)).toBe('return')
  })

  it('answers return for a method declaration of a class', () => {
    const { node } = statementOf('class A { m(): R { return r } }')
    const method = (node as ts.ClassDeclaration).members[0] as ts.MethodDeclaration
    expect(positionOf(method.type as ts.TypeNode, node)).toBe('return')
  })
})
