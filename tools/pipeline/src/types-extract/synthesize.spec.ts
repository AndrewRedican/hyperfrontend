import ts from 'typescript'
import { describe, expect, it } from '@hyperfrontend/testing'
import { classToInterface, enumMemberType, enumToAlias } from './synthesize'

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

describe('classToInterface', () => {
  it('keeps public instance properties, methods and index signatures and drops the rest', () => {
    const { node, sourceFile } = statementOf<ts.ClassDeclaration>(`
      /** A tree. */
      export class FsTree implements Tree {
        private recorded = {};
        protected locked = false;
        static create(): FsTree { return new FsTree('') }
        #secret = 1;
        [key: string]: unknown;
        /** The root. */
        readonly root: string;
        constructor(root: string, private readonly verbose: boolean, public name?: string) { this.root = root }
        read(path: string): Buffer | null;
        read(path: string, encoding: BufferEncoding): string | null;
        read(path: string, encoding?: BufferEncoding): Buffer | string | null { return null }
        write(path: string, content = '', ...rest: string[]) {}
        get size(): number { return 0 }
        get label(): string { return '' }
        set label(value: string) {}
        set only(value: number) {}
        ;
      }`)
    const result = classToInterface(node, sourceFile)
    expect(result).toEqual({
      text: [
        '/** A tree. */',
        'export interface FsTree extends Tree {',
        '    [key: string]: unknown;',
        '    /** The root. */',
        '    readonly root: string;',
        '    name?: string;',
        '    read(path: string): Buffer | null;',
        '    read(path: string, encoding: BufferEncoding): string | null;',
        '    write(path: string, content?: unknown, ...rest: string[]): unknown;',
        '    readonly size: number;',
        '    label: string;',
        '    only: number;',
        '}',
      ].join('\n'),
      notes: [
        'a class, carried as the interface of its public instance members',
        'the member recorded is dropped: static, private or protected',
        'the member locked is dropped: static, private or protected',
        'the member create is dropped: static, private or protected',
        'the member #secret is dropped: static, private or protected',
        'the constructor is dropped',
      ],
    })
  })

  it('carries a class with neither heritage nor members as an empty interface', () => {
    const { node, sourceFile } = statementOf<ts.ClassDeclaration>('class Empty<T> {}')
    expect(classToInterface(node, sourceFile).text).toBe('export interface Empty<T> {\n}')
  })

  it('types an untyped property as unknown', () => {
    const { node, sourceFile } = statementOf<ts.ClassDeclaration>('class A { value; static { } }')
    expect(classToInterface(node, sourceFile).text).toBe('export interface A {\n    value: unknown;\n}')
  })

  it('names computed members by their text', () => {
    const { node, sourceFile } = statementOf<ts.ClassDeclaration>('class A { [Symbol.iterator](): void {} }')
    expect(classToInterface(node, sourceFile).text).toBe('export interface A {\n    [Symbol.iterator](): void;\n}')
  })
})

describe('enumToAlias', () => {
  it('unions string members and keeps the enum JSDoc', () => {
    const { node, sourceFile } = statementOf<ts.EnumDeclaration>(
      "/** Kinds. */\nexport enum Kind { Static = 'static', Dynamic = 'dynamic' }"
    )
    expect(enumToAlias(node, sourceFile)).toEqual({
      text: "/** Kinds. */\nexport type Kind = 'static' | 'dynamic';",
      notes: ['an enum, carried as the union of its member values'],
    })
  })

  it('numbers uninitialised members from zero and after the last numeric value', () => {
    const { node, sourceFile } = statementOf<ts.EnumDeclaration>('enum N { A, B, C = 10, D, E = -2, F }')
    expect(enumToAlias(node, sourceFile).text).toBe('export type N = 0 | 1 | 10 | 11 | -2 | -1;')
  })

  it('widens a computed member to number and says so', () => {
    const { node, sourceFile } = statementOf<ts.EnumDeclaration>('enum N { A = 1 << 2, B = `tpl` }')
    expect(enumToAlias(node, sourceFile)).toEqual({
      text: "export type N = number | 'tpl';",
      notes: ['an enum, carried as the union of its member values', 'the member A is computed and widens the union to number'],
    })
  })

  it('escapes quotes and backslashes in string members', () => {
    const { node, sourceFile } = statementOf<ts.EnumDeclaration>("enum Q { A = \"it's\", B = 'a\\\\b' }")
    expect(enumToAlias(node, sourceFile).text).toBe("export type Q = 'it\\'s' | 'a\\\\b';")
  })

  it('carries an empty enum as never', () => {
    const { node, sourceFile } = statementOf<ts.EnumDeclaration>('enum E {}')
    expect(enumToAlias(node, sourceFile).text).toBe('export type E = never;')
  })
})

describe('enumMemberType', () => {
  const { node } = statementOf<ts.EnumDeclaration>("enum K { A, B = 'b', C = 5, D, E = A | B }")

  it.each([
    ['A', '0'],
    ['B', "'b'"],
    ['C', '5'],
    ['D', '6'],
    ['E', null],
    ['Z', null],
  ])('types the member %s', (name, expected) => {
    expect(enumMemberType(node, name)).toBe(expected)
  })
})
