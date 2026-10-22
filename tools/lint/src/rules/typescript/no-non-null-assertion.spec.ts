import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-non-null-assertion.ts'

testRule(rule, {
  valid: [
    { name: '#6 !x;', path: '/root/file.ts', text: '!x;' },
    { name: '#8 a definite assignment assertion is not a non-null assertion', path: '/root/file.ts', text: 'let x!: number;' },
  ],
  invalid: [
    {
      name: '#19 x!!!;',
      path: '/root/file.ts',
      text: 'x!!!;',
      errors: [
        { message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 5 },
        { message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 4 },
        { message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 3 },
      ],
    },
    {
      name: '#23 x!?.[y].z;',
      path: '/root/file.ts',
      text: 'x!?.[y].z;',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 3 }],
    },
    {
      name: '#25 x.y.z!?.();',
      path: '/root/file.ts',
      text: 'x.y.z!?.();',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#28 x!',
      path: '/root/file.ts',
      text: '\nx!\n // comment\n    . /* comment */\n      y\n      ',
      errors: [{ message: 'Forbidden non-null assertion.', line: 2, column: 1, endLine: 2, endColumn: 3 }],
    },
    {
      name: "#30 document.querySelector('input')!.files = new FileList();",
      path: '/root/file.ts',
      text: "\ndocument.querySelector('input')!.files = new FileList();\n      ",
      errors: [{ message: 'Forbidden non-null assertion.', line: 2, column: 1, endLine: 2, endColumn: 33 }],
    },
    {
      name: '#33 a compound assignment target has no suggestion',
      path: '/root/file.ts',
      text: 'x!.y += 1;',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 3 }],
    },
    {
      name: '#34 a deleted member has no suggestion',
      path: '/root/file.ts',
      text: 'delete x!.y;',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 8, endLine: 1, endColumn: 10 }],
    },
    {
      name: '#35 an incremented member has no suggestion',
      path: '/root/file.ts',
      text: 'x!.y++;',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 3 }],
    },
    {
      name: '#37 a member in a rest destructuring target has no suggestion',
      path: '/root/file.ts',
      text: '[...x!.y] = [1];',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 5, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#41 a multi-line asserted expression is the range',
      path: '/root/file.ts',
      text: 'foo(\n  a,\n)!.b;',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 3, endColumn: 3 }],
    },
    {
      name: '#42 an assertion inside a type argument call is the callee',
      path: '/root/file.ts',
      text: 'x.y!<T>();',
      errors: [{ message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 5 }],
    },
    {
      name: '#43 two assertions in one statement each get their suggestion',
      path: '/root/file.ts',
      text: 'a!.b + c![d];',
      errors: [
        { message: 'Forbidden non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 3 },
        { message: 'Forbidden non-null assertion.', line: 1, column: 8, endLine: 1, endColumn: 10 },
      ],
    },
  ],
})
