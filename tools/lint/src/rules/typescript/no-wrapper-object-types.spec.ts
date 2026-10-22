import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-wrapper-object-types.ts'

testRule(rule, {
  valid: [
    { name: '#1 let value: NumberLike;', path: '/root/file.ts', text: 'let value: NumberLike;' },
    { name: '#12 let value: () => void;', path: '/root/file.ts', text: 'let value: () => void;' },
    { name: '#41 class MyClass extends Number {}', path: '/root/file.ts', text: 'class MyClass extends Number {}' },
    { name: '#42 type Number = 0 | 1;', path: '/root/file.ts', text: '\n      type Number = 0 | 1;\n      let value: Number;\n    ' },
    {
      name: '#44 type T<Symbol> = Symbol;',
      path: '/root/file.ts',
      text: '\n      type T<Symbol> = Symbol;\n      type U<UU> = UU extends T<infer Function> ? Function : never;\n    ',
    },
    { name: '#45 a qualified global name is not an identifier', path: '/root/file.ts', text: 'let value: globalThis.Number;' },
    {
      name: '#46 a qualified heritage expression is not an identifier',
      path: '/root/file.ts',
      text: 'interface A extends globalThis.String {}',
    },
    { name: '#47 a type query of the constructor', path: '/root/file.ts', text: 'let value: typeof String;' },
    { name: '#48 the wrapper as a value', path: '/root/file.ts', text: 'const s = String(1);\nconst o = new Object();' },
    {
      name: '#49 an imported type of the name',
      path: '/root/file.ts',
      text: "import type { String } from './types';\nlet value: String;",
    },
    {
      name: '#50 a class implementing a shadowing interface',
      path: '/root/file.ts',
      text: '{\n  interface Object {}\n  class A implements Object {}\n}',
    },
    { name: '#51 a type parameter named like a wrapper', path: '/root/file.ts', text: 'function f<Boolean>(value: Boolean) {}' },
  ],
  invalid: [
    {
      name: '#60 let value: { property: Number };',
      path: '/root/file.ts',
      text: 'let value: { property: Number };',
      errors: [
        {
          message: 'Prefer using the primitive `number` as a type name, rather than the upper-cased `Number`.',
          line: 1,
          column: 24,
          endLine: 1,
          endColumn: 30,
        },
      ],
      output: 'let value: { property: number };',
    },
    {
      name: '#61 0 as Number;',
      path: '/root/file.ts',
      text: '0 as Number;',
      errors: [
        {
          message: 'Prefer using the primitive `number` as a type name, rather than the upper-cased `Number`.',
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 12,
        },
      ],
      output: '0 as number;',
    },
    {
      name: '#63 type MyType = [Number];',
      path: '/root/file.ts',
      text: 'type MyType = [Number];',
      errors: [
        {
          message: 'Prefer using the primitive `number` as a type name, rather than the upper-cased `Number`.',
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 22,
        },
      ],
      output: 'type MyType = [number];',
    },
    {
      name: '#66 type MyType = Number & String;',
      path: '/root/file.ts',
      text: 'type MyType = Number & String;',
      errors: [
        {
          message: 'Prefer using the primitive `number` as a type name, rather than the upper-cased `Number`.',
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 21,
        },
        {
          message: 'Prefer using the primitive `string` as a type name, rather than the upper-cased `String`.',
          line: 1,
          column: 24,
          endLine: 1,
          endColumn: 30,
        },
      ],
      output: 'type MyType = number & string;',
    },
    {
      name: '#70 an extended Boolean among other supertypes is reported without a fix',
      path: '/root/file.ts',
      text: 'interface B {}\ninterface A extends B, Boolean {}',
      errors: [
        {
          message: 'Prefer using the primitive `boolean` as a type name, rather than the upper-cased `Boolean`.',
          line: 2,
          column: 24,
          endLine: 2,
          endColumn: 31,
        },
      ],
      output: null,
    },
    {
      name: '#71 a parameter, a return type and a generic default are fixed together',
      path: '/root/file.ts',
      text: 'function f<T = Symbol>(a: String): Number {\n  return 0;\n}',
      errors: [
        {
          message: 'Prefer using the primitive `symbol` as a type name, rather than the upper-cased `Symbol`.',
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 22,
        },
        {
          message: 'Prefer using the primitive `string` as a type name, rather than the upper-cased `String`.',
          line: 1,
          column: 27,
          endLine: 1,
          endColumn: 33,
        },
        {
          message: 'Prefer using the primitive `number` as a type name, rather than the upper-cased `Number`.',
          line: 1,
          column: 36,
          endLine: 1,
          endColumn: 42,
        },
      ],
      output: 'function f<T = symbol>(a: string): number {\n  return 0;\n}',
    },
  ],
})
