import { testRule } from '../../testing/rule-tester.ts'
import rule from './prefer-namespace-keyword.ts'

testRule(rule, {
  valid: [
    { name: "#1 declare module 'foo';", path: '/root/file.ts', text: "declare module 'foo';" },
    { name: '#5 declare global {}', path: '/root/file.ts', text: 'declare global {}' },
    { name: '#7 a qualified namespace', path: '/root/file.ts', text: 'namespace A.B {}' },
    {
      name: '#9 an ambient module with a body in a definition file',
      path: '/root/types.d.ts',
      text: "declare module 'foo' {\n  export const a: number;\n}",
    },
  ],
  invalid: [
    {
      name: '#12 declare module foo {',
      path: '/root/file.ts',
      text: '\ndeclare module foo {\n  declare module bar {}\n}\n      ',
      errors: [
        {
          message: "Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
          line: 2,
          column: 1,
          endLine: 4,
          endColumn: 2,
        },
        {
          message: "Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 24,
        },
      ],
      output: '\ndeclare namespace foo {\n  declare namespace bar {}\n}\n      ',
    },
    {
      name: '#13 the whole multi-line declaration is the range',
      path: '/root/file.ts',
      text: 'module foo {\n  export const a = 1;\n}',
      errors: [
        {
          message: "Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
          line: 1,
          column: 1,
          endLine: 3,
          endColumn: 2,
        },
      ],
      output: 'namespace foo {\n  export const a = 1;\n}',
    },
    {
      name: '#16 a comment between the keyword and the name is kept',
      path: '/root/file.ts',
      text: 'module /* name */ foo {}',
      errors: [
        {
          message: "Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 25,
        },
      ],
      output: 'namespace /* name */ foo {}',
    },
  ],
})
