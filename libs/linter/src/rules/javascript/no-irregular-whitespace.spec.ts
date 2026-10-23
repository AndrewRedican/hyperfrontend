import { testRule } from '../../testing/rule-tester'
import rule from './no-irregular-whitespace'

// why: the workspace skips string literals and nothing else, as upstream does by default; the cases recorded with strings checked or anything else skipped are left out.
testRule(rule, {
  valid: [
    { name: '#1 U+000B written as an escape in a string', path: '/root/file.ts', text: "'\\u000B';" },
    { name: '#43 U+2029 as a line continuation in a string', path: '/root/file.ts', text: "'\\ ';" },
    { name: '#160 a byte order mark at the start of the file', path: '/root/file.ts', text: "﻿console.log('hello BOM');" },
    { name: '#162 a JSX attribute string, which is a string literal', path: '/root/react.tsx', text: '<div title="a b" />;' },
    { name: '#166 a file without irregular whitespace', path: '/root/file.ts', text: "var a = 'b';\n// c\n/* d */\n`e`;\n/f/;" },
  ],
  invalid: [
    {
      name: '#228 U+2028 in a block comment',
      path: '/root/file.ts',
      text: '/*   */',
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 4, endLine: 2, endColumn: 1 }],
    },
    {
      name: '#236 var any = `　`, other = `\u000b`;',
      path: '/root/file.ts',
      text: 'var any = `　`, other = `\u000b`;',
      options: { skipTemplates: false },
      errors: [
        { message: 'Irregular whitespace not allowed.', line: 1, column: 12, endLine: 1, endColumn: 13 },
        { message: 'Irregular whitespace not allowed.', line: 1, column: 25, endLine: 1, endColumn: 26 },
      ],
    },
    {
      name: '#262 foo',
      path: '/root/file.ts',
      text: 'foo  ',
      errors: [
        { message: 'Irregular whitespace not allowed.', line: 1, column: 4, endLine: 2, endColumn: 1 },
        { message: 'Irregular whitespace not allowed.', line: 2, column: 1, endLine: 3, endColumn: 1 },
      ],
    },
    {
      name: '#268 U+0085 in JSX text',
      path: '/root/react.tsx',
      text: '<div></div>;',
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 6, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#270 U+180E in JSX text',
      path: '/root/react.tsx',
      text: '<div>᠎</div>;',
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 6, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#271 U+FEFF in JSX text',
      path: '/root/react.tsx',
      text: '<div>﻿</div>;',
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 6, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#289 a number literal removes nothing',
      path: '/root/file.ts',
      text: 'var a = 1 + 1;',
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 10, endLine: 1, endColumn: 11 }],
    },
    {
      name: '#299 a regular expression, not skipping them explicitly',
      path: '/root/file.ts',
      text: '/ /',
      options: { skipRegExps: false },
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 2, endLine: 1, endColumn: 3 }],
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a string literal when strings are checked',
      path: '/w/a.ts',
      text: "'a b'",
      options: { skipStrings: false },
      errors: [{ message: 'Irregular whitespace not allowed.', line: 1, column: 3, endLine: 1, endColumn: 4 }],
    },
  ],
})
