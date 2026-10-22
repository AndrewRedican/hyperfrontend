import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-unused-expressions.ts'

// why: the workspace allows no short circuit, ternary, tagged template or directive-like string and does not enforce JSX; the cases that switch any of those on are left out.
testRule(rule, {
  valid: [
    { name: '#1 test.age?.toLocaleString();', path: '/root/file.ts', text: '\n      test.age?.toLocaleString();\n    ' },
    { name: '#4 let c = one[2]?.[3][4];', path: '/root/file.ts', text: '\n      let c = one[2]?.[3][4];\n    ' },
    { name: '#5 one[2]?.[3][4]?.();', path: '/root/file.ts', text: '\n      one[2]?.[3][4]?.();\n    ' },
    {
      name: '#8 namespace Foo {',
      path: '/root/file.ts',
      text: "\n      namespace Foo {\n        'use strict';\n\n        export class Foo {}\n        export class Bar {}\n      }\n    ",
    },
    {
      name: '#9 function foo() {',
      path: '/root/file.ts',
      text: "\n      function foo() {\n        'use strict';\n\n        return null;\n      }\n    ",
    },
    { name: "#11 import('./foo').then(() => {});", path: '/root/file.ts', text: "\n      import('./foo').then(() => {});\n    " },
    { name: '#12 class Foo<T> {}', path: '/root/file.ts', text: '\n      class Foo<T> {}\n      new Foo<string>();\n    ' },
    {
      name: '#16 a call, an assignment, an update and void under the workspace defaults',
      path: '/root/file.ts',
      text: 'f();\na = b;\na++;\nvoid a;\ndelete a.b;',
    },
    { name: '#24 a JSX element under the default', path: '/root/react.tsx', text: '<div />;' },
    { name: '#25 a JSX fragment under the default', path: '/root/react.tsx', text: '<></>;' },
    { name: '#31 an asserted import expression', path: '/root/file.ts', text: "import('./foo') as Promise<unknown>;" },
    {
      name: '#33 a satisfies expression is unknown to the core rule, which assumes a side effect',
      path: '/root/file.ts',
      text: 'declare const foo: number;\nfoo satisfies number;',
    },
    { name: '#34 a call with type arguments', path: '/root/file.ts', text: 'f<string>();' },
  ],
  invalid: [
    {
      name: '#36 if (0) 0;',
      path: '/root/file.ts',
      text: 'if (0) 0;',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#39 a() &&',
      path: '/root/file.ts',
      text: '\na() &&\n  function namedFunctionInExpressionContext() {\n    f();\n  };\n      ',
      errors: [
        { message: 'Expected an assignment or function call and instead saw an expression.', line: 2, column: 1, endLine: 5, endColumn: 5 },
      ],
    },
    {
      name: '#50 function foo() {',
      path: '/root/file.ts',
      text: "\nfunction foo() {\n  const foo = true;\n\n  ('use strict');\n}\n      ",
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 5,
          column: 3,
          endLine: 5,
          endColumn: 18,
        },
      ],
    },
    {
      name: '#54 Map<string, string>;',
      path: '/root/file.ts',
      text: 'Map<string, string>;',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 21,
        },
      ],
    },
    {
      name: '#57 declare const foo: number | undefined;',
      path: '/root/file.ts',
      text: '\ndeclare const foo: number | undefined;\n<any>foo;\n      ',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#64 a ternary of imports when not allowed',
      path: '/root/file.ts',
      text: "a ? import('./b') : import('./c');",
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#66 a tagged template under the default',
      path: '/root/file.ts',
      text: 'tag`template`;',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#69 a parenthesised string at the top of a program without the option',
      path: '/root/file.ts',
      text: "('use strict');",
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#71 an asserted sequence',
      path: '/root/file.ts',
      text: '(a, b) as any;',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#72 a non-null parenthesised instantiation expression',
      path: '/root/file.ts',
      text: '(Foo<string>)!;',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#76 a multi-line asserted object',
      path: '/root/file.ts',
      text: '({\n  a: 1,\n}) as object;',
      errors: [
        {
          message: 'Expected an assignment or function call and instead saw an expression.',
          line: 1,
          column: 1,
          endLine: 3,
          endColumn: 14,
        },
      ],
    },
  ],
})
