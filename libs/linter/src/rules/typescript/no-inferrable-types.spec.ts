import { testRule } from '../../testing/rule-tester'
import rule from './no-inferrable-types'

// why: the workspace checks parameters and properties alike; the cases that switch either check off are left out.
testRule(rule, {
  valid: [
    {
      name: "#41 const fn = function (a = 5, b = true, c = 'foo') {};",
      path: '/root/file.ts',
      text: "const fn = function (a = 5, b = true, c = 'foo') {};",
    },
    { name: '#45 class Foo {', path: '/root/file.ts', text: '\nclass Foo {\n  readonly a: number = 5;\n}\n    ' },
    { name: '#46 class Foo {', path: '/root/file.ts', text: '\nclass Foo {\n  accessor a = 5;\n}\n    ' },
    { name: '#55 class Foo {', path: '/root/file.ts', text: '\nclass Foo {\n  constructor(public a = true) {}\n}\n      ' },
    { name: '#59 a negated negation is not a literal', path: '/root/file.ts', text: 'const a: number = -(-1);' },
    { name: '#62 an undefined annotation on null', path: '/root/file.ts', text: 'const a: undefined = null;' },
    { name: '#63 a RegExp annotation on another construction', path: '/root/file.ts', text: 'const a: RegExp = new Foo();' },
    { name: '#65 a qualified RegExp reference', path: '/root/file.ts', text: 'const a: Ns.RegExp = /a/;' },
    { name: '#66 a symbol annotation on a member call', path: '/root/file.ts', text: "const a: symbol = Symbol.for('a');" },
    { name: '#69 a boolean annotation on a comparison', path: '/root/file.ts', text: 'const a: boolean = x > 1;' },
    { name: '#70 a declaration without an initial value', path: '/root/file.ts', text: 'let a: number;\na = 1;' },
    { name: '#71 a declared constant', path: '/root/file.ts', text: 'declare const a: number;' },
    {
      name: '#72 a destructured parameter with a type literal default',
      path: '/root/file.ts',
      text: 'const f = ({ a }: { a: number } = {}) => {};',
    },
    { name: '#73 a rest parameter', path: '/root/file.ts', text: 'function f(...a: number[]) {}' },
    { name: '#74 an array annotation on an array literal', path: '/root/file.ts', text: 'const a: number[] = [1];' },
    { name: '#75 a union annotation on a literal', path: '/root/file.ts', text: 'const a: number | string = 1;' },
    { name: '#76 a literal type annotation', path: '/root/file.ts', text: 'const a: 1 = 1;' },
  ],
  invalid: [
    {
      name: '#81 const a: bigint = 10n;',
      path: '/root/file.ts',
      text: 'const a: bigint = 10n;',
      errors: [
        {
          message: 'Type bigint trivially inferred from a bigint literal, remove type annotation.',
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 22,
        },
      ],
      output: 'const a = 10n;',
    },
    {
      name: '#86 const a: bigint = -BigInt?.(10);',
      path: '/root/file.ts',
      text: 'const a: bigint = -BigInt?.(10);',
      errors: [
        {
          message: 'Type bigint trivially inferred from a bigint literal, remove type annotation.',
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 32,
        },
      ],
      output: 'const a = -BigInt?.(10);',
    },
    {
      name: '#91 const a: boolean = !0;',
      path: '/root/file.ts',
      text: 'const a: boolean = !0;',
      errors: [
        {
          message: 'Type boolean trivially inferred from a boolean literal, remove type annotation.',
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 22,
        },
      ],
      output: 'const a = !0;',
    },
    {
      name: '#113 const a: string = `str`;',
      path: '/root/file.ts',
      text: 'const a: string = `str`;',
      errors: [
        {
          message: 'Type string trivially inferred from a string literal, remove type annotation.',
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 24,
        },
      ],
      output: 'const a = `str`;',
    },
    {
      name: "#116 const a: symbol = Symbol('a');",
      path: '/root/file.ts',
      text: "const a: symbol = Symbol('a');",
      errors: [
        {
          message: 'Type symbol trivially inferred from a symbol literal, remove type annotation.',
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 30,
        },
      ],
      output: "const a = Symbol('a');",
    },
    {
      name: '#120 const fn = (a?: number = 5) => {};',
      path: '/root/file.ts',
      text: 'const fn = (a?: number = 5) => {};',
      options: { ignoreParameters: false },
      errors: [
        {
          message: 'Type number trivially inferred from a number literal, remove type annotation.',
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 27,
        },
      ],
      output: 'const fn = (a = 5) => {};',
    },
    {
      name: "#122 const fn = (a: number = 5, b: boolean = true, c: string = 'f…",
      path: '/root/file.ts',
      text: "const fn = (a: number = 5, b: boolean = true, c: string = 'foo') => {};",
      options: { ignoreParameters: false, ignoreProperties: false },
      errors: [
        {
          message: 'Type number trivially inferred from a number literal, remove type annotation.',
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 26,
        },
        {
          message: 'Type boolean trivially inferred from a boolean literal, remove type annotation.',
          line: 1,
          column: 28,
          endLine: 1,
          endColumn: 45,
        },
        {
          message: 'Type string trivially inferred from a string literal, remove type annotation.',
          line: 1,
          column: 47,
          endLine: 1,
          endColumn: 64,
        },
      ],
      output: "const fn = (a = 5, b = true, c = 'foo') => {};",
    },
    {
      name: '#130 a readonly parameter property keeps its modifier',
      path: '/root/file.ts',
      text: 'class A {\n  constructor(readonly a: number = 1) {}\n}',
      errors: [
        {
          message: 'Type number trivially inferred from a number literal, remove type annotation.',
          line: 2,
          column: 24,
          endLine: 2,
          endColumn: 37,
        },
      ],
      output: 'class A {\n  constructor(readonly a = 1) {}\n}',
    },
    {
      name: '#131 a static property',
      path: '/root/file.ts',
      text: 'class A {\n  static a: boolean = true;\n}',
      errors: [
        {
          message: 'Type boolean trivially inferred from a boolean literal, remove type annotation.',
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 28,
        },
      ],
      output: 'class A {\n  static a = true;\n}',
    },
    {
      name: '#132 a method parameter default',
      path: '/root/file.ts',
      text: 'class A {\n  m(a: string = "s") {}\n}',
      errors: [
        {
          message: 'Type string trivially inferred from a string literal, remove type annotation.',
          line: 2,
          column: 5,
          endLine: 2,
          endColumn: 20,
        },
      ],
      output: 'class A {\n  m(a = "s") {}\n}',
    },
    {
      name: '#133 an object method parameter default',
      path: '/root/file.ts',
      text: 'const o = {\n  m(a: null = null) {},\n};',
      errors: [
        {
          message: 'Type null trivially inferred from a null literal, remove type annotation.',
          line: 2,
          column: 5,
          endLine: 2,
          endColumn: 19,
        },
      ],
      output: 'const o = {\n  m(a = null) {},\n};',
    },
    {
      name: '#135 a definite property of a RegExp',
      path: '/root/file.ts',
      text: 'class A {\n  a!: RegExp = /a/;\n}',
      errors: [
        {
          message: 'Type RegExp trivially inferred from a RegExp literal, remove type annotation.',
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 20,
        },
      ],
      output: 'class A {\n  a = /a/;\n}',
    },
    {
      name: '#139 an undefined annotation on void zero',
      path: '/root/file.ts',
      text: 'const a: undefined = void 0;',
      errors: [
        {
          message: 'Type undefined trivially inferred from a undefined literal, remove type annotation.',
          line: 1,
          column: 7,
          endLine: 1,
          endColumn: 28,
        },
      ],
      output: 'const a = void 0;',
    },
  ],
})

testRule(rule, {
  valid: [{ name: 'a null annotation on a regular expression', path: '/project/file.ts', text: 'const a: null = /a/;' }],
  invalid: [],
})
