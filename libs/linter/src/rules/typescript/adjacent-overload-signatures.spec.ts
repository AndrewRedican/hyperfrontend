import { testRule } from '../../testing/rule-tester'
import rule from './adjacent-overload-signatures'

testRule(rule, {
  valid: [
    {
      name: '#1 function error(a: string);',
      path: '/root/file.ts',
      text: '\nfunction error(a: string);\nfunction error(b: number);\nfunction error(ab: string | number) {}\nexport { error };\n      ',
    },
    {
      name: "#2 import { connect } from 'react-redux';",
      path: '/root/file.ts',
      text: "\nimport { connect } from 'react-redux';\nexport interface ErrorMessageModel {\n  message: string;\n}\nfunction mapStateToProps() {}\nfunction mapDispatchToProps() {}\nexport default connect(mapStateToProps, mapDispatchToProps)(ErrorMessage);\n      ",
    },
    {
      name: '#7 export class Foo {}',
      path: '/root/file.ts',
      text: '\nexport class Foo {}\nexport class Bar {}\nexport type FooBar = Foo | Bar;\n    ',
    },
    {
      name: '#15 type Foo = {',
      path: '/root/file.ts',
      text: "\ntype Foo = {\n  foo(s: string): void;\n  ['foo'](n: number): void;\n  foo(sn: string | number): void;\n  bar(): void;\n  baz(): void;\n};\n    ",
    },
    {
      name: '#24 class Foo {',
      path: '/root/file.ts',
      text: "\nclass Foo {\n  foo(s: string): void;\n  ['foo'](n: number): void;\n  foo(sn: string | number): void {}\n  bar(): void {}\n  baz(): void {}\n}\n    ",
    },
    { name: '#28 export default function <T>(foo: T) {}', path: '/root/file.ts', text: 'export default function <T>(foo: T) {}' },
    {
      name: '#35 a default-exported anonymous class is not an overloadable member',
      path: '/root/file.ts',
      text: '\nfunction foo(s: string);\nfunction foo(sn: string | number) {}\nexport default class {}\nfunction bar() {}\n    ',
    },
    {
      name: '#37 a global augmentation block with adjacent overloads',
      path: '/root/file.ts',
      text: '\ndeclare global {\n  function foo(s: string): void;\n  function foo(n: number): void;\n  interface Window {}\n  function bar(): void;\n}\n    ',
    },
    {
      name: '#38 a type literal nested in a parameter',
      path: '/root/file.ts',
      text: '\nfunction run(handlers: { on(s: string): void; on(n: number): void; off(): void }) {}\n    ',
    },
    {
      name: '#39 abstract methods are not checked',
      path: '/root/file.ts',
      text: '\nabstract class Foo {\n  abstract foo(s: string): void;\n  bar(): void {}\n  abstract foo(n: number): void;\n}\n    ',
    },
    {
      name: '#40 property signatures, index signatures and properties between unrelated methods',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  [key: string]: unknown;\n  foo(): void;\n  bar: string;\n  baz(): void;\n}\nclass Bar {\n  foo(): void {}\n  readonly bar = 1;\n  baz(): void {}\n}\n    ',
    },
  ],
  invalid: [
    {
      name: '#43 if (true) {',
      path: '/root/file.ts',
      text: '\nif (true) {\n  function foo(s: string);\n  function foo(n: number);\n  let a = 1;\n  function foo(sn: string | number) {}\n  foo(a);\n}\n      ',
      errors: [{ message: 'All foo signatures should be adjacent.', line: 6, column: 3, endLine: 6, endColumn: 39 }],
    },
    {
      name: '#52 declare function foo(s: string);',
      path: '/root/file.ts',
      text: "\ndeclare function foo(s: string);\ndeclare function foo(n: number);\nconst a = '';\nconst b = '';\ndeclare function foo(sn: string | number);\n      ",
      errors: [{ message: 'All foo signatures should be adjacent.', line: 6, column: 1, endLine: 6, endColumn: 43 }],
    },
    {
      name: "#53 declare module 'Foo' {",
      path: '/root/file.ts',
      text: "\ndeclare module 'Foo' {\n  export function foo(s: string): void;\n  export function foo(n: number): void;\n  export function bar(): void;\n  export function baz(): void;\n  export function foo(sn: string | number): void;\n}\n      ",
      errors: [{ message: 'All foo signatures should be adjacent.', line: 7, column: 3, endLine: 7, endColumn: 50 }],
    },
    {
      name: '#56 declare namespace Foo {',
      path: '/root/file.ts',
      text: '\ndeclare namespace Foo {\n  export function foo(s: string): void;\n  export function foo(n: number): void;\n  export function foo(sn: string | number): void;\n  function baz(s: string): void;\n  export function bar(): void;\n  function baz(n: number): void;\n  function baz(sn: string | number): void;\n}\n      ',
      errors: [{ message: 'All baz signatures should be adjacent.', line: 8, column: 3, endLine: 8, endColumn: 33 }],
    },
    {
      name: '#66 interface Foo {',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  new (s: string);\n  new (n: number);\n  foo(): void;\n  bar(): void;\n  new (sn: string | number);\n}\n      ',
      errors: [{ message: 'All new signatures should be adjacent.', line: 7, column: 3, endLine: 7, endColumn: 29 }],
    },
    {
      name: '#68 class Foo {',
      path: '/root/file.ts',
      text: '\nclass Foo {\n  constructor(s: string);\n  constructor(n: number);\n  bar(): void {}\n  baz(): void {}\n  constructor(sn: string | number) {}\n}\n      ',
      errors: [{ message: 'All constructor signatures should be adjacent.', line: 7, column: 3, endLine: 7, endColumn: 38 }],
    },
    {
      name: '#71 class Foo {',
      path: '/root/file.ts',
      text: '\nclass Foo {\n  // prettier-ignore\n  "foo"(s: string): void;\n  foo(n: number): void;\n  bar(): void {}\n  baz(): void {}\n  foo(sn: string | number): void {}\n}\n      ',
      errors: [{ message: 'All foo signatures should be adjacent.', line: 8, column: 3, endLine: 8, endColumn: 36 }],
    },
    {
      name: '#74 class Foo {',
      path: '/root/file.ts',
      text: '\nclass Foo {\n  static foo(s: string): void;\n  name: string;\n  static foo(n: number): void;\n  static foo(sn: string | number): void {}\n  bar(): void {}\n  baz(): void {}\n}\n      ',
      errors: [{ message: 'All static foo signatures should be adjacent.', line: 5, column: 3, endLine: 5, endColumn: 31 }],
    },
    {
      name: '#75 class Test {',
      path: '/root/file.ts',
      text: "\nclass Test {\n  #private(): void;\n  '#private'(): void;\n  #private(arg: number): void {}\n  '#private'(arg: number): void {}\n}\n      ",
      errors: [
        { message: 'All #private signatures should be adjacent.', line: 5, column: 3, endLine: 5, endColumn: 33 },
        { message: 'All "#private" signatures should be adjacent.', line: 6, column: 3, endLine: 6, endColumn: 35 },
      ],
    },
    {
      name: '#76 a computed identifier key is the same member as a bare key of its text',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  fooBar(s: string): void;\n  fooBar(n: number): void;\n  baz(): void;\n  [fooBar](): void;\n}\n    ',
      errors: [{ message: 'All fooBar signatures should be adjacent.', line: 6, column: 3, endLine: 6, endColumn: 20 }],
    },
    {
      name: '#77 a multi-line separated overload is reported over its whole range',
      path: '/root/file.ts',
      text: '\nfunction foo(s: string): void;\nfunction bar(): void {}\nfunction foo(\n  n: number,\n): void {}\n    ',
      errors: [{ message: 'All foo signatures should be adjacent.', line: 4, column: 1, endLine: 6, endColumn: 11 }],
    },
    {
      name: '#81 a computed key is matched by its source text',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  [Symbol.iterator](): void;\n  baz(): void;\n  [Symbol.iterator](n: number): void;\n}\n    ',
      errors: [{ message: 'All Symbol.iterator signatures should be adjacent.', line: 5, column: 3, endLine: 5, endColumn: 38 }],
    },
    {
      name: '#82 call signatures separated by a construct signature',
      path: '/root/file.ts',
      text: '\ninterface Foo {\n  (s: string): void;\n  new (s: string): Foo;\n  (n: number): void;\n}\n    ',
      errors: [{ message: 'All call signatures should be adjacent.', line: 5, column: 3, endLine: 5, endColumn: 21 }],
    },
    {
      name: '#84 an accessor shares the name of a method',
      path: '/root/file.ts',
      text: "\nclass Foo {\n  get foo(): string { return '' }\n  bar(): void {}\n  foo(): void {}\n}\n    ",
      errors: [{ message: 'All foo signatures should be adjacent.', line: 5, column: 3, endLine: 5, endColumn: 17 }],
    },
  ],
})
