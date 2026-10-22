import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-control-regex.ts'

testRule(rule, {
  valid: [
    { name: "#6 RegExp('[')", path: '/root/file.ts', text: "RegExp('[')" },
    { name: "#7 new (function foo(){})('\\x1f')", path: '/root/file.ts', text: "new (function foo(){})('\\x1f')" },
    { name: '#14 new RegExp("\\\\u{1F}", flags)', path: '/root/file.ts', text: 'new RegExp("\\\\u{1F}", flags)' },
    { name: '#15 new RegExp("[\\\\q{\\\\u{20}}]", "v")', path: '/root/file.ts', text: 'new RegExp("[\\\\q{\\\\u{20}}]", "v")' },
    { name: '#17 control escapes written as letters', path: '/root/file.ts', text: '/\\t\\n\\r\\v\\f\\0/' },
    { name: '#18 a caret control escape', path: '/root/file.ts', text: '/\\cA\\cJ/' },
    { name: '#22 a number as the pattern', path: '/root/file.ts', text: 'new RegExp(1)' },
    { name: '#24 a template literal as the pattern', path: '/root/file.ts', text: 'new RegExp(`\\x1f`)' },
    { name: '#26 a RegExp member callee', path: '/root/file.ts', text: "RegExp.call(null, '\\x1f')" },
    { name: '#29 an invalid pattern without control characters', path: '/root/file.ts', text: "new RegExp('(', 'u')" },
  ],
  invalid: [
    {
      name: "#35 var regex = new RegExp('\\x1f\\x1e')",
      path: '/root/file.ts',
      text: "var regex = new RegExp('\\x1f\\x1e')",
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f, \\x1e.', line: 1, column: 24, endLine: 1, endColumn: 34 },
      ],
    },
    {
      name: "#36 var regex = new RegExp('\\x1fFOO\\x00')",
      path: '/root/file.ts',
      text: "var regex = new RegExp('\\x1fFOO\\x00')",
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f, \\x00.', line: 1, column: 24, endLine: 1, endColumn: 37 },
      ],
    },
    {
      name: "#37 var regex = new RegExp('FOO\\x1fFOO\\x1f')",
      path: '/root/file.ts',
      text: "var regex = new RegExp('FOO\\x1fFOO\\x1f')",
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f, \\x1f.', line: 1, column: 24, endLine: 1, endColumn: 40 },
      ],
    },
    {
      name: '#39 var regex = /(?<a>\\x1f)/',
      path: '/root/file.ts',
      text: 'var regex = /(?<a>\\x1f)/',
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 13, endLine: 1, endColumn: 25 },
      ],
    },
    {
      name: '#40 var regex = /(?<\\u{1d49c}>.)\\x1f/',
      path: '/root/file.ts',
      text: 'var regex = /(?<\\u{1d49c}>.)\\x1f/',
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 13, endLine: 1, endColumn: 34 },
      ],
    },
    {
      name: '#42 /\\u{1111}*\\x1F/u',
      path: '/root/file.ts',
      text: '/\\u{1111}*\\x1F/u',
      errors: [{ message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 1, endLine: 1, endColumn: 17 }],
    },
    {
      name: '#49 /[\\u{1F}--B]/v',
      path: '/root/file.ts',
      text: '/[\\u{1F}--B]/v',
      errors: [{ message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 1, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#50 /\\x11/; RegExp("foo", "uv");',
      path: '/root/file.ts',
      text: '/\\x11/; RegExp("foo", "uv");',
      errors: [{ message: 'Unexpected control character(s) in regular expression: \\x11.', line: 1, column: 1, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#54 every control character of a pattern, in order',
      path: '/root/file.ts',
      text: '/\\x00a\\x1fb\\u001fc\\x01/',
      errors: [
        {
          message: 'Unexpected control character(s) in regular expression: \\x00, \\x1f, \\x1f, \\x01.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#59 a control character inside a character class',
      path: '/root/file.ts',
      text: '/[\\x00-\\x1f]/',
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x00, \\x1f.', line: 1, column: 1, endLine: 1, endColumn: 14 },
      ],
    },
    {
      name: '#60 a control character in a pattern with the unicode sets flag',
      path: '/root/file.ts',
      text: '/[\\x1f&&\\p{L}]/v',
      errors: [{ message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 1, endLine: 1, endColumn: 17 }],
    },
    {
      name: '#61 each literal of a file',
      path: '/root/file.ts',
      text: "const a = /\\x1f/\nconst b = new RegExp('\\\\x1e')",
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 11, endLine: 1, endColumn: 17 },
        { message: 'Unexpected control character(s) in regular expression: \\x1e.', line: 2, column: 22, endLine: 2, endColumn: 29 },
      ],
    },
    {
      name: '#62 a regular expression literal as a typed property value',
      path: '/root/file.ts',
      text: 'const o: { r: RegExp } = { r: /\\x1f/ }',
      errors: [
        { message: 'Unexpected control character(s) in regular expression: \\x1f.', line: 1, column: 31, endLine: 1, endColumn: 37 },
      ],
    },
  ],
})
