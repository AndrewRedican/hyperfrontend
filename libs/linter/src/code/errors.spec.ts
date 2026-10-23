import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from './parse'

/** An invalid text with what the parser must say about it. */
interface Case {
  /** The text. */
  readonly text: string
  /** The message expected. */
  readonly message: string
  /** The text at the offset expected, found by searching the text; the start of the text when empty, its end when `<eof>`. */
  readonly at: string
  /** The extension, `.ts` by default. */
  readonly extension?: string
}

const CASES: readonly Case[] = [
  { text: 'const = 1', message: 'Identifier expected.', at: '= 1' },
  { text: 'const x = ;', message: 'Expression expected.', at: ';' },
  { text: 'const x = )', message: 'Expression expected.', at: ')' },
  { text: 'const x = < 1', message: "'>' expected.", at: '<eof>' },
  { text: 'const x = 1 const y = 2', message: "';' expected.", at: 'const y' },
  { text: '1 += 1', message: 'The left-hand side of an assignment expression must be a variable or a property access.', at: '' },
  { text: '[1] = b', message: 'Invalid left-hand side in assignment.', at: '1]' },
  { text: '[a += 1] = b', message: 'Invalid left-hand side in assignment.', at: 'a +=' },
  { text: 'for (1 of b) {}', message: 'The left-hand side of a for statement must be a variable or a property access.', at: '1 of' },
  { text: 'for (let a, b of c) {}', message: "Only a single variable declaration is allowed in a 'for...of' statement.", at: 'let' },
  { text: 'for (let a = 1 in c) {}', message: "The variable declaration of a 'for...in' statement cannot have an initializer.", at: 'let' },
  {
    text: 'for (let a: number of c) {}',
    message: "The variable declaration of a 'for...of' statement cannot have a type annotation.",
    at: 'let',
  },
  { text: 'const a', message: "'const' declarations must be initialized.", at: 'a' },
  { text: 'const a!: number = 1', message: "A definite assignment assertion '!' is not permitted in this context.", at: 'a!' },
  { text: 'let a!: number = 1', message: 'Declarations with initializers cannot also have definite assignment assertions.', at: 'a!' },
  { text: 'let a! = 1', message: 'Declarations with initializers cannot also have definite assignment assertions.', at: 'a!' },
  { text: 'let a!', message: 'Declarations with definite assignment assertions must also have type annotations.', at: 'a!' },
  { text: 'declare const a = 1', message: 'Initializers are not permitted in ambient contexts.', at: '1' },
  { text: 'declare function f() {}', message: 'An implementation cannot be declared in ambient contexts.', at: '{}' },
  { text: 'declare function* f(): void', message: 'Generators are not allowed in an ambient context.', at: 'function' },
  { text: 'function* f(): void', message: 'A function signature cannot be declared as a generator.', at: 'function' },
  { text: 'with (a) {}', message: "'with' statements are not allowed in strict mode.", at: 'with' },
  { text: 'throw\n1', message: 'Line break not permitted here.', at: '1' },
  { text: 'try {}', message: "'catch' or 'finally' expected.", at: '<eof>' },
  { text: 'do {}', message: "'while' expected.", at: '<eof>' },
  { text: 'await', message: 'Expression expected.', at: '<eof>' },
  { text: 'const o = { m() }', message: "'{' expected.", at: '}' },
  { text: 'let x:', message: 'Type expected.', at: '<eof>' },
  { text: 'const x = <1 />', message: 'Identifier expected.', at: '1', extension: '.tsx' },
  { text: 'const x = <a 1="x" />', message: 'Identifier expected.', at: '1', extension: '.tsx' },
  { text: 'const x = <a.1 />', message: 'Identifier expected.', at: '.1', extension: '.tsx' },
  { text: 'const x = <a:/>', message: 'Identifier expected.', at: '/>', extension: '.tsx' },
  { text: 'enum E { [a] = 1 }', message: 'Computed property names are not allowed in enums.', at: 'a]' },
  { text: 'enum E { 1 = 1 }', message: 'An enum member cannot have a numeric name.', at: '1 =' },
  { text: 'declare x', message: 'Declaration expected.', at: 'x' },
  { text: 'class A { abstract x = 1 }', message: 'Abstract property cannot have an initializer.', at: '1 }' },
  { text: 'class A { get x }', message: "'(' expected.", at: '}' },
  {
    text: 'class A { constructor(public x) {} } function f(public y) {}',
    message: 'A parameter property is only allowed in a constructor implementation.',
    at: 'public y',
  },
  { text: 'class', message: 'Identifier expected.', at: '<eof>' },
  { text: 'class A extends B, C {}', message: "'{' expected.", at: ', C' },
  { text: 'const o = { get x }', message: "'(' expected.", at: '}' },
  { text: 'const o = { [a] }', message: "':' expected.", at: '}' },
  { text: 'const { [a] } = b', message: "':' expected.", at: '}' },
  {
    text: 'import type A, { B } from "c"',
    message: 'A type-only import can specify a default import or named bindings, but not both.',
    at: 'import',
  },
  { text: 'export { "a" }', message: 'A string literal cannot be used as a local exported binding without `from`.', at: '"a"' },
  { text: 'import { "a" } from "b"', message: 'Identifier expected.', at: '"a"' },
  { text: 'export', message: 'Declaration or statement expected.', at: '<eof>' },
  { text: 'a?.b`x`', message: 'Tagged template expressions are not permitted in an optional chain.', at: '`x`' },
  { text: 'a?.#b', message: 'An optional chain cannot contain private identifiers.', at: '#b' },
  { text: 'a?.b.#c', message: 'An optional chain cannot contain private identifiers.', at: '#c' },
  { text: 'a?.(', message: 'Expression expected.', at: '<eof>' },
  { text: 'new a?.()', message: 'Unexpected token.', at: '(' },
  { text: 'let x: ;', message: 'Type expected.', at: ';' },
  { text: 'let x: )', message: 'Type expected.', at: ')' },
  { text: 'let x: -a', message: 'Type expected.', at: 'a' },
  { text: 'let x: A<>', message: 'Type argument list cannot be empty.', at: '>' },
  { text: 'function f<>() {}', message: 'Type parameter list cannot be empty.', at: '>' },
  { text: 'type A = { [K in Keys]: V, }', message: "'}' expected.", at: ', }' },
  { text: 'type A = { + "x', message: 'Identifier expected.', at: '+' },
  { text: 'interface A { x: string y: number }', message: "';' expected.", at: 'y' },
  { text: 'const x = <div', message: 'Identifier expected.', at: '<eof>', extension: '.tsx' },
  {
    text: 'const x = <div a=1 />',
    message: 'JSX value should be either an expression or a quoted JSX text.',
    at: '1 />',
    extension: '.tsx',
  },
  { text: 'const x = <div></span>', message: "Expected corresponding JSX closing tag for 'div'.", at: '</span>', extension: '.tsx' },
  { text: 'const x = <div>}</div>', message: "Unexpected token. Did you mean `{'}'}` or `&rbrace;`?", at: '}</div>', extension: '.tsx' },
  { text: 'const x = <div>></div>', message: "Unexpected token. Did you mean `{'>'}` or `&gt;`?", at: '></div>', extension: '.tsx' },
  { text: 'const x = <a><b></b>', message: "JSX element 'a' has no corresponding closing tag.", at: '<eof>', extension: '.tsx' },
  { text: 'const x = <><b></b>', message: 'JSX fragment has no corresponding closing tag.', at: '<eof>', extension: '.tsx' },
  { text: 'const x = `abc', message: 'Unterminated template literal.', at: '`abc' },
  { text: "const x = '\\101'", message: 'Octal escape sequences are not allowed in strict mode.', at: "'" },
  { text: "const x = '\\08'", message: 'Octal escape sequences are not allowed in strict mode.', at: "'" },
  { text: "const x = '\\8'", message: "Escape sequence '\\8' is not allowed.", at: "'" },
  { text: "const x = '\\xZZ'", message: 'Hexadecimal digit expected.', at: "'" },
  { text: "const x = '\\u12'", message: 'Hexadecimal digit expected.', at: "'" },
  { text: "const x = '\\u{110000}'", message: 'Unterminated Unicode escape sequence.', at: "'" },
  { text: "const x = '\\'", message: 'Unterminated string literal.', at: "'" },
  { text: 'const x = "abc', message: 'Unterminated string literal.', at: '"abc' },
  { text: 'const x = /abc', message: 'Unterminated regular expression literal.', at: '/abc' },
  { text: 'const x = 017', message: 'Octal literals are not allowed.', at: '017' },
  { text: 'const x = 0x', message: 'Numeric literal expected.', at: '0x' },
  { text: 'const x = 1e', message: 'Digit expected.', at: '<eof>' },
  { text: 'const x = 1abc', message: 'An identifier or keyword cannot immediately follow a numeric literal.', at: 'abc' },
  { text: 'const x = §', message: 'Invalid character.', at: '§' },
  { text: 'const x = \\x', message: 'Invalid character.', at: '\\x' },
  { text: 'const x = \\u{41', message: 'Unexpected end of text.', at: '\\u{41' },
  { text: 'const x = /* open', message: "'*/' expected.", at: '/* open' },
  { text: 'const o = { a: 1 b: 2 }', message: "',' expected.", at: 'b: 2' },
  { text: 'let x = async foo', message: "';' expected.", at: 'foo' },
]

describe('parse errors', () => {
  for (const { text, message, at, extension } of CASES) {
    it(`reports ${message} on ${text.replace(/\n/g, '\\n')}`, () => {
      expect(parseCode(text, extension ?? '.ts').error).toEqual({
        message,
        offset: at === '' ? 0 : at === '<eof>' ? text.length : text.indexOf(at),
      })
    })
  }
})
