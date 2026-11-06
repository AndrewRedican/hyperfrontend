import ts from 'typescript'
import { describe, expect, it } from '@hyperfrontend/testing'
import { applyEdits, dedent, editsWithin, exportEdits, heritageEdit, indentationBefore } from './edits'

/**
 * The first statement of a source text, with its file.
 *
 * @param text - The source
 * @returns The statement and the file
 */
function statementOf<TStatement extends ts.Statement>(text: string): { node: TStatement; sourceFile: ts.SourceFile } {
  const sourceFile = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return { node: sourceFile.statements[0] as TStatement, sourceFile }
}

describe('applyEdits', () => {
  it('applies replacements and insertions in any order', () => {
    expect(
      applyEdits('abcdef', [
        { start: 4, end: 6, text: 'EF' },
        { start: 0, end: 1, text: 'A' },
        { start: 2, end: 2, text: '-' },
      ])
    ).toBe('Ab-cdEF')
  })

  it('drops an edit nested inside another replacement', () => {
    expect(
      applyEdits('Pick<Inner<X>, K>', [
        { start: 0, end: 17, text: 'unknown' },
        { start: 5, end: 13, text: 'Y' },
      ])
    ).toBe('unknown')
  })

  it('applies two edits over one span in order, the first winning', () => {
    expect(
      applyEdits('ab', [
        { start: 0, end: 2, text: 'x' },
        { start: 0, end: 2, text: 'y' },
      ])
    ).toBe('x')
  })

  it('keeps an insertion at the start of a replaced span', () => {
    expect(
      applyEdits('abc', [
        { start: 0, end: 0, text: 'export ' },
        { start: 0, end: 3, text: 'X' },
      ])
    ).toBe('export X')
  })
})

describe('editsWithin', () => {
  it('keeps the edits inside a span, shifted to it', () => {
    const edits = [
      { start: 2, end: 4, text: 'a' },
      { start: 10, end: 12, text: 'b' },
      { start: 0, end: 20, text: 'c' },
    ]
    expect(editsWithin(edits, 2, 12)).toEqual([
      { start: 0, end: 2, text: 'a' },
      { start: 8, end: 10, text: 'b' },
    ])
  })
})

describe('exportEdits', () => {
  it('adds export to an unexported declaration', () => {
    const { node, sourceFile } = statementOf('/** doc */\ninterface A {}')
    expect(exportEdits(node, sourceFile)).toEqual([{ start: 11, end: 11, text: 'export ' }])
  })

  it('removes declare and default and keeps export', () => {
    const { node, sourceFile } = statementOf('export declare interface A {}')
    expect(applyEdits(sourceFile.text, exportEdits(node, sourceFile))).toBe('export interface A {}')
  })

  it('removes a default modifier', () => {
    const { node, sourceFile } = statementOf('export default interface A {}')
    expect(applyEdits(sourceFile.text, exportEdits(node, sourceFile))).toBe('export interface A {}')
  })

  it('leaves an exported declaration alone', () => {
    const { node, sourceFile } = statementOf('export type A = 1')
    expect(exportEdits(node, sourceFile)).toEqual([])
  })
})

describe('heritageEdit', () => {
  it('removes the whole clause when nothing stays', () => {
    const { node, sourceFile } = statementOf<ts.InterfaceDeclaration>('interface A extends B, C {}')
    const clause = (node.heritageClauses ?? [])[0] as ts.HeritageClause
    const edit = heritageEdit(clause, new Set(clause.types), [], sourceFile)
    expect(applyEdits(sourceFile.text, [edit])).toBe('interface A {}')
  })

  it('rewrites the clause with the kept types and their inner edits', () => {
    const { node, sourceFile } = statementOf<ts.InterfaceDeclaration>('interface A extends B<X>, C, D {}')
    const clause = (node.heritageClauses ?? [])[0] as ts.HeritageClause
    const typeArgument = ((clause.types[0] as ts.ExpressionWithTypeArguments).typeArguments ?? [])[0] as ts.TypeNode
    const edits = [{ start: typeArgument.getStart(sourceFile), end: typeArgument.end, text: 'unknown' }]
    const edit = heritageEdit(clause, new Set([clause.types[1] as ts.Node]), edits, sourceFile)
    expect(applyEdits(sourceFile.text, [...edits, edit])).toBe('interface A extends B<unknown>, D {}')
  })

  it('writes implements for an implements clause', () => {
    const { node, sourceFile } = statementOf<ts.ClassDeclaration>('class A implements B, C {}')
    const clause = (node.heritageClauses ?? [])[0] as ts.HeritageClause
    expect(heritageEdit(clause, new Set([clause.types[0] as ts.Node]), [], sourceFile).text).toBe('implements C')
  })

  it('removes a clause that no space precedes', () => {
    const { node, sourceFile } = statementOf<ts.InterfaceDeclaration>('interface A\nextends B {}')
    const clause = (node.heritageClauses ?? [])[0] as ts.HeritageClause
    expect(applyEdits(sourceFile.text, [heritageEdit(clause, new Set(clause.types), [], sourceFile)])).toBe('interface A\n {}')
  })
})

describe('dedent and indentationBefore', () => {
  it('strips the first line indentation from the following lines', () => {
    expect(dedent('interface A {\n    x: 1\n  }\nother', '  ')).toBe('interface A {\n  x: 1\n}\nother')
  })

  it('leaves text alone without indentation', () => {
    expect(dedent('a\n  b', '')).toBe('a\n  b')
  })

  it('reads the whitespace before a declaration on its line', () => {
    const { sourceFile } = statementOf('namespace N {\n    interface A {}\n}')
    const inner = ((sourceFile.statements[0] as ts.ModuleDeclaration).body as ts.ModuleBlock).statements[0] as ts.Statement
    expect(indentationBefore(sourceFile, inner.getStart(sourceFile))).toBe('    ')
  })

  it('reads no indentation when something else precedes the declaration', () => {
    const { sourceFile } = statementOf('namespace N { interface A {} }')
    const inner = ((sourceFile.statements[0] as ts.ModuleDeclaration).body as ts.ModuleBlock).statements[0] as ts.Statement
    expect(indentationBefore(sourceFile, inner.getStart(sourceFile))).toBe('')
  })
})
