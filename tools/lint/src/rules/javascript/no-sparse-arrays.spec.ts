import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-sparse-arrays.ts'

testRule(rule, {
  valid: [
    { name: '#1 var a = [ 1, 2, ]', path: '/root/file.ts', text: 'var a = [ 1, 2, ]' },
    { name: '#3 a dense array with a spread', path: '/root/file.ts', text: 'var a = [...b, 1];' },
    {
      name: '#4 an array pattern with a hole is a destructuring target, not an expression',
      path: '/root/file.ts',
      text: 'var [, b] = c;',
    },
    { name: '#6 a dense tuple assertion', path: '/root/file.ts', text: 'var a = [1, 2] as const;' },
  ],
  invalid: [
    {
      name: '#9 [',
      path: '/root/file.ts',
      text: '[\r\n\t/* comment */,\n// comment\n ,];',
      errors: [
        { message: 'Unexpected comma in middle of array.', line: 2, column: 15, endLine: 2, endColumn: 16 },
        { message: 'Unexpected comma in middle of array.', line: 4, column: 2, endLine: 4, endColumn: 3 },
      ],
    },
    {
      name: '#10 [(( [a,] )),,,];',
      path: '/root/file.ts',
      text: '[(( [a,] )),,,];',
      errors: [
        { message: 'Unexpected comma in middle of array.', line: 1, column: 13, endLine: 1, endColumn: 14 },
        { message: 'Unexpected comma in middle of array.', line: 1, column: 14, endLine: 1, endColumn: 15 },
      ],
    },
    {
      name: '#18 a hole in an array with a type assertion',
      path: '/root/file.ts',
      text: 'var a = [1,, 2] as number[];',
      errors: [{ message: 'Unexpected comma in middle of array.', line: 1, column: 12, endLine: 1, endColumn: 13 }],
    },
  ],
})
