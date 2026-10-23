import { testRule } from '../../testing/rule-tester'
import rule from './no-this-alias'

// why: the workspace allows destructuring and no alias name; the cases recorded with other settings are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 const { props, state } = this;',
      path: '/root/file.ts',
      text: '\nconst { props, state } = this;\nconst { length } = this;\nconst { length, toString } = this;\nconst [foo] = this;\nconst [foo, bar] = this;\n      ',
      options: { allowDestructuring: true },
    },
    {
      name: "#4 declare module 'foo' {",
      path: '/root/file.ts',
      text: "\ndeclare module 'foo' {\n  declare const aVar: string;\n}\n    ",
    },
    {
      name: '#5 object destructuring in an assignment under the workspace defaults',
      path: '/root/file.ts',
      text: 'let a;\n({ a } = this);',
    },
    { name: '#6 array destructuring in an assignment under the workspace defaults', path: '/root/file.ts', text: 'let a;\n[a] = this;' },
    { name: '#9 a member assigned from this', path: '/root/file.ts', text: 'obj.self = foo(this);' },
  ],
  invalid: [
    {
      name: '#15 var unscoped = this;',
      path: '/root/file.ts',
      text: '\nvar unscoped = this;\n\nfunction testFunction() {\n  let inFunction = this;\n}\nconst testLambda = () => {\n  const inLambda = this;\n};\n      ',
      errors: [
        { message: "Unexpected aliasing of 'this' to local variable.", line: 2, column: 5, endLine: 2, endColumn: 13 },
        { message: "Unexpected aliasing of 'this' to local variable.", line: 5, column: 7, endLine: 5, endColumn: 17 },
        { message: "Unexpected aliasing of 'this' to local variable.", line: 8, column: 9, endLine: 8, endColumn: 17 },
      ],
    },
    {
      name: '#19 an annotated identifier covers its annotation',
      path: '/root/file.ts',
      text: 'const self: this = this;',
      errors: [{ message: "Unexpected aliasing of 'this' to local variable.", line: 1, column: 7, endLine: 1, endColumn: 17 }],
    },
  ],
})
