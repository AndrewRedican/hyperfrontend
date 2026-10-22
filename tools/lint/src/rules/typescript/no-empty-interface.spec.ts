import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-empty-interface.ts'

// why: the workspace reports an empty interface extending one type; the cases allowing it are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 interface Foo {',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  name: string;\n}\n\ninterface Bar {\n  age: number;\n}\n\n// valid because extending multiple interfaces can be used instead of a union type\ninterface Baz extends Foo, Bar {}\n    ',
    },
    { name: '#5 an interface with a call signature', path: '/root/file.ts', text: 'interface Foo {\n  (): void;\n}' },
    { name: '#6 an interface with an index signature', path: '/root/file.ts', text: 'interface Foo {\n  [key: string]: unknown;\n}' },
  ],
  invalid: [
    {
      name: '#12 interface Foo {',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  props: string;\n}\n\ninterface Bar extends Foo {}\n\nclass Baz {}\n      ',
      options: { allowSingleExtends: false },
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 6, column: 11, endLine: 6, endColumn: 14 },
      ],
      output: '\ninterface Foo {\n  props: string;\n}\n\ntype Bar = Foo\n\nclass Baz {}\n      ',
    },
    {
      name: '#14 interface Foo {',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  props: string;\n}\n\ninterface Bar extends Foo {}\n\nconst bar = class Bar {};\n      ',
      options: { allowSingleExtends: false },
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 6, column: 11, endLine: 6, endColumn: 14 },
      ],
      output: '\ninterface Foo {\n  props: string;\n}\n\ntype Bar = Foo\n\nconst bar = class Bar {};\n      ',
    },
    {
      name: '#17 interface Foo extends Array<number | {}> {}',
      path: '/root/file.ts',
      text: 'interface Foo extends Array<number | {}> {}',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 1, column: 11, endLine: 1, endColumn: 14 },
      ],
      output: 'type Foo = Array<number | {}>',
    },
    {
      name: '#21 declare module FooBar {',
      path: '/root/test.d.ts',
      text: '\ndeclare module FooBar {\n  type Baz = typeof baz;\n  export interface Bar extends Baz {}\n}\n      ',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 4, column: 20, endLine: 4, endColumn: 23 },
      ],
      output: null,
    },
    {
      name: '#24 an exported empty interface with one supertype is fixed in place',
      path: '/root/file.ts',
      text: 'export interface Foo extends Bar {}',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 1, column: 18, endLine: 1, endColumn: 21 },
      ],
      output: 'export type Foo = Bar',
    },
    {
      name: '#26 an interface in a declared module of a source file is fixed, not suggested',
      path: '/root/file.ts',
      text: "declare module 'foo' {\n  export interface Foo extends Bar {}\n}",
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 2, column: 20, endLine: 2, endColumn: 23 },
      ],
      output: "declare module 'foo' {\n  export type Foo = Bar\n}",
    },
    {
      name: '#28 a generic interface in a declared namespace of a declaration file is fixed in place',
      path: '/root/types.d.mts',
      text: 'declare namespace Foo {\n  interface Bar<T> extends Baz<T> {}\n}',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 2, column: 13, endLine: 2, endColumn: 16 },
      ],
      output: 'declare namespace Foo {\n  type Bar<T> = Baz<T>\n}',
    },
    {
      name: '#30 every empty interface of a file is reported',
      path: '/root/file.ts',
      text: 'interface A {}\ninterface B extends A {}\ninterface C extends A, B {}',
      errors: [
        { message: 'An empty interface is equivalent to `{}`.', line: 1, column: 11, endLine: 1, endColumn: 12 },
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 2, column: 11, endLine: 2, endColumn: 12 },
      ],
      output: 'interface A {}\ntype B = A\ninterface C extends A, B {}',
    },
    {
      name: '#31 a supertype with a qualified name and type arguments',
      path: '/root/file.ts',
      text: 'interface Foo extends Ns.Bar<string, number> {}',
      errors: [
        { message: 'An interface declaring no members is equivalent to its supertype.', line: 1, column: 11, endLine: 1, endColumn: 14 },
      ],
      output: 'type Foo = Ns.Bar<string, number>',
    },
  ],
})
