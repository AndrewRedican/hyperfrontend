import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-explicit-any.ts'

// why: the workspace runs the rule without the fix and without the rest-argument allowance; the cases that switch either on are left out.
testRule(rule, {
  valid: [
    { name: '#1 const number: number = 1;', path: '/root/file.ts', text: 'const number: number = 1;' },
    { name: '#12 class Greeter {', path: '/root/file.ts', text: '\nclass Greeter {\n  message: Array<string[]>;\n}\n    ' },
    { name: '#13 interface Greeter {', path: '/root/file.ts', text: '\ninterface Greeter {\n  message: string;\n}\n    ' },
    { name: '#26 type obj = {', path: '/root/file.ts', text: '\ntype obj = {\n  message: string | Array<Array<string>>;\n};\n    ' },
    { name: '#27 type obj = {', path: '/root/file.ts', text: '\ntype obj = {\n  message: string & number;\n};\n    ' },
    { name: '#76 an identifier named any is not the keyword', path: '/root/file.ts', text: 'const any = 1;\ntype T = typeof any;' },
    { name: '#78 a string literal type any', path: '/root/file.ts', text: "type T = 'any';" },
    {
      name: '#82 the rest allowance explicitly off on a plain type',
      path: '/root/file.ts',
      text: 'const a: string = "";',
      options: { ignoreRestArgs: false },
    },
  ],
  invalid: [
    {
      name: '#92 class Greeter {',
      path: '/root/file.ts',
      text: '\nclass Greeter {\n  constructor(param: Array<any>) {}\n}\n      ',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 3, column: 28, endLine: 3, endColumn: 31 }],
    },
    {
      name: '#119 abstract class Foo<t = any> extends Bar<any> {}',
      path: '/root/file.ts',
      text: 'abstract class Foo<t = any> extends Bar<any> {}',
      errors: [
        { message: 'Unexpected any. Specify a different type.', line: 1, column: 24, endLine: 1, endColumn: 27 },
        { message: 'Unexpected any. Specify a different type.', line: 1, column: 41, endLine: 1, endColumn: 44 },
      ],
    },
    {
      name: '#120 abstract class Foo<t = any> implements Bar<any>, Baz<any> {}',
      path: '/root/file.ts',
      text: 'abstract class Foo<t = any> implements Bar<any>, Baz<any> {}',
      errors: [
        { message: 'Unexpected any. Specify a different type.', line: 1, column: 24, endLine: 1, endColumn: 27 },
        { message: 'Unexpected any. Specify a different type.', line: 1, column: 44, endLine: 1, endColumn: 47 },
        { message: 'Unexpected any. Specify a different type.', line: 1, column: 54, endLine: 1, endColumn: 57 },
      ],
    },
    {
      name: '#121 new Foo<any>();',
      path: '/root/file.ts',
      text: 'new Foo<any>();',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 9, endLine: 1, endColumn: 12 }],
    },
    {
      name: '#122 Foo<any>();',
      path: '/root/file.ts',
      text: 'Foo<any>();',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 5, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#123 function test<T extends Partial<any>>() {}',
      path: '/root/file.ts',
      text: '\nfunction test<T extends Partial<any>>() {}\nconst test = <T extends Partial<any>>() => {};\n      ',
      errors: [
        { message: 'Unexpected any. Specify a different type.', line: 2, column: 33, endLine: 2, endColumn: 36 },
        { message: 'Unexpected any. Specify a different type.', line: 3, column: 33, endLine: 3, endColumn: 36 },
      ],
    },
    {
      name: '#124 function foo(a: number, ...rest: any[]): void {',
      path: '/root/file.ts',
      text: '\n        function foo(a: number, ...rest: any[]): void {\n          return;\n        }\n      ',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 2, column: 42, endLine: 2, endColumn: 45 }],
    },
    {
      name: '#131 function quuz5(): (...args: any) => void {}',
      path: '/root/file.ts',
      text: 'function quuz5(): (...args: any) => void {}',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 29, endLine: 1, endColumn: 32 }],
    },
    {
      name: '#138 const integer = <',
      path: '/root/file.ts',
      text: '\nconst integer = <\n  TKey extends keyof any,\n  TTarget extends { [K in TKey]: number },\n>(\n  target: TTarget,\n  key: TKey,\n) => {\n  /* ... */\n};\n      ',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 3, column: 22, endLine: 3, endColumn: 25 }],
    },
    {
      name: '#149 every any of a file is reported',
      path: '/root/file.ts',
      text: 'let a: any;\nlet b: any;',
      errors: [
        { message: 'Unexpected any. Specify a different type.', line: 1, column: 8, endLine: 1, endColumn: 11 },
        { message: 'Unexpected any. Specify a different type.', line: 2, column: 8, endLine: 2, endColumn: 11 },
      ],
    },
    {
      name: '#153 an any in a type assertion',
      path: '/root/file.ts',
      text: 'const a = b as any;',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 16, endLine: 1, endColumn: 19 }],
    },
    {
      name: '#154 an any in an angle-bracket assertion',
      path: '/root/file.ts',
      text: 'const a = <any>b;',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 12, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#155 an any as the this parameter type',
      path: '/root/file.ts',
      text: 'function f(this: any) {}',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 18, endLine: 1, endColumn: 21 }],
    },
    {
      name: '#156 an any as an index signature type',
      path: '/root/file.ts',
      text: 'type T = { [key: string]: any };',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 27, endLine: 1, endColumn: 30 }],
    },
    {
      name: '#157 an any as a type parameter default',
      path: '/root/file.ts',
      text: 'type T<U = any> = U;',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 12, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#158 an any as a type argument',
      path: '/root/file.ts',
      text: 'type T = Record<string, any>;',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 25, endLine: 1, endColumn: 28 }],
    },
    {
      name: '#160 a parenthesised keyof any is still a keyof any',
      path: '/root/file.ts',
      text: 'type T = keyof (any);',
      errors: [{ message: 'Unexpected any. Specify a different type.', line: 1, column: 17, endLine: 1, endColumn: 20 }],
    },
  ],
})
