import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-array-constructor.ts'

testRule(rule, {
  valid: [
    { name: '#9 new Array<Foo>(1, 2, 3);', path: '/root/file.ts', text: 'new Array<Foo>(1, 2, 3);' },
    { name: '#11 Array<Foo>(1, 2, 3);', path: '/root/file.ts', text: 'Array<Foo>(1, 2, 3);' },
    { name: '#15 foo?.Array();', path: '/root/file.ts', text: 'foo?.Array();' },
    { name: '#19 Array?.<Foo>(1, 2, 3);', path: '/root/file.ts', text: 'Array?.<Foo>(1, 2, 3);' },
    { name: '#25 a computed member named Array', path: '/root/file.ts', text: 'foo[Array]();' },
    { name: '#26 a tagged template named Array is not a call', path: '/root/file.ts', text: 'Array`a`;' },
    { name: '#27 a class named Array constructed with one argument', path: '/root/file.ts', text: 'class Array {}\nnew Array(1);' },
  ],
  invalid: [
    {
      name: '#39 /* a */ /* b */ Array /* c */ /* d */ /* e */ /* f */?.(',
      path: '/root/file.ts',
      text: '\n/* a */ /* b */ Array /* c */ /* d */ /* e */ /* f */?.(\n  0,\n  1,\n  2,\n); /* g */ /* h */\n      ',
      errors: [{ message: 'The array literal notation [] is preferable.', line: 2, column: 17, endLine: 6, endColumn: 2 }],
      output: '\n/* a */ /* b */ [\n  0,\n  1,\n  2,\n]; /* g */ /* h */\n      ',
    },
    {
      name: '#42 a parenthesised callee without an argument list is replaced by an empty literal',
      path: '/root/file.ts',
      text: 'new (Array);',
      errors: [{ message: 'The array literal notation [] is preferable.', line: 1, column: 1, endLine: 1, endColumn: 12 }],
      output: '[];',
    },
    {
      name: '#44 a spread with another argument',
      path: '/root/file.ts',
      text: 'new Array(...items, last);',
      errors: [{ message: 'The array literal notation [] is preferable.', line: 1, column: 1, endLine: 1, endColumn: 26 }],
      output: '[...items, last];',
    },
    {
      name: '#46 a shadowed Array binding is still reported',
      path: '/root/file.ts',
      text: 'const Array = () => [];\nArray();',
      errors: [{ message: 'The array literal notation [] is preferable.', line: 2, column: 1, endLine: 2, endColumn: 8 }],
      output: 'const Array = () => [];\n[];',
    },
    {
      name: '#49 every construction of a statement is reported',
      path: '/root/file.ts',
      text: 'f(new Array(), Array(1, 2));',
      errors: [
        { message: 'The array literal notation [] is preferable.', line: 1, column: 3, endLine: 1, endColumn: 14 },
        { message: 'The array literal notation [] is preferable.', line: 1, column: 16, endLine: 1, endColumn: 27 },
      ],
      output: 'f([], [1, 2]);',
    },
    {
      name: '#50 a construction whose result is used',
      path: '/root/file.ts',
      text: 'const a = new Array(1, 2).map(f);',
      errors: [{ message: 'The array literal notation [] is preferable.', line: 1, column: 11, endLine: 1, endColumn: 26 }],
      output: 'const a = [1, 2].map(f);',
    },
  ],
})
