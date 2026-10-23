import { testRule } from '../../testing/rule-tester'
import rule from './no-namespace'

// why: the workspace reports ambient namespaces and allows definition files; the cases recorded with the opposite settings are left out.
testRule(rule, {
  valid: [
    { name: '#1 declare global {}', path: '/root/file.ts', text: 'declare global {}' },
    { name: "#2 declare module 'foo' {}", path: '/root/file.ts', text: "declare module 'foo' {}" },
    { name: '#15 a namespace in a CommonJS definition file', path: '/root/test.d.cts', text: 'namespace foo {}' },
  ],
  invalid: [
    {
      name: '#36 namespace Foo.Bar {',
      path: '/root/file.ts',
      text: '\nnamespace Foo.Bar {\n  namespace Baz.Bas {\n    interface X {}\n  }\n}\n      ',
      errors: [
        { message: 'ES2015 module syntax is preferred over namespaces.', line: 2, column: 1, endLine: 6, endColumn: 2 },
        { message: 'ES2015 module syntax is preferred over namespaces.', line: 3, column: 3, endLine: 5, endColumn: 4 },
      ],
    },
    {
      name: '#54 the whole multi-line declaration is the range',
      path: '/root/file.ts',
      text: 'namespace foo {\n  export const a = 1\n}',
      errors: [{ message: 'ES2015 module syntax is preferred over namespaces.', line: 1, column: 1, endLine: 3, endColumn: 2 }],
    },
    {
      name: '#59 a namespace in a function body',
      path: '/root/file.ts',
      text: 'function f() {\n  namespace foo {}\n}',
      errors: [{ message: 'ES2015 module syntax is preferred over namespaces.', line: 2, column: 3, endLine: 2, endColumn: 19 }],
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a namespace in a file whose name ends otherwise than .ts',
      path: '/project/file.tsx',
      text: 'namespace foo {}',
      errors: [{ message: 'ES2015 module syntax is preferred over namespaces.', line: 1, column: 1, endLine: 1, endColumn: 17 }],
    },
  ],
})
