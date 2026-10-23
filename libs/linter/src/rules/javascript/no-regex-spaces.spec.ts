import { testRule } from '../../testing/rule-tester'
import rule from './no-regex-spaces'

testRule(rule, {
  valid: [
    { name: "#2 var foo = RegExp('foo')", path: '/root/file.ts', text: "var foo = RegExp('foo')" },
    { name: '#14 var foo = /  +/;', path: '/root/file.ts', text: 'var foo = /  +/;' },
    { name: '#15 var foo = /  ?/;', path: '/root/file.ts', text: 'var foo = /  ?/;' },
    { name: '#16 var foo = /  */;', path: '/root/file.ts', text: 'var foo = /  */;' },
    { name: '#20 var foo = /bar \\u0020 baz/;', path: '/root/file.ts', text: 'var foo = /bar \\u0020 baz/;' },
    { name: "#25 var foo = new RegExp('bar \\u0020 baz')", path: '/root/file.ts', text: "var foo = new RegExp('bar \\u0020 baz')" },
    { name: "#36 var foo = new RegExp(' \\[   ');", path: '/root/file.ts', text: "var foo = new RegExp(' \\[   ');" },
    { name: '#39 var foo = /[\\q{    }]/v;', path: '/root/file.ts', text: 'var foo = /[\\q{    }]/v;' },
    { name: "#41 var foo = new RegExp('{  ', 'u');", path: '/root/file.ts', text: "var foo = new RegExp('{  ', 'u');" },
    {
      name: "#44 new RegExp('[[abc]\\\\q{  }]', flags + 'v')",
      path: '/root/file.ts',
      text: "new RegExp('[[abc]\\\\q{  }]', flags + 'v')",
    },
    { name: '#46 RegExp shadowed by a parameter', path: '/root/file.ts', text: "function f(RegExp) { return new RegExp('a  b') }" },
    {
      name: '#47 a pattern behind a type assertion is not a string literal',
      path: '/root/file.ts',
      text: "new RegExp('a  b' as string)",
    },
    { name: '#48 a template pattern is not a string literal', path: '/root/file.ts', text: 'new RegExp(`a  b`)' },
    { name: '#49 a pattern that is not a literal', path: '/root/file.ts', text: 'RegExp(x)' },
    { name: '#53 a pattern with a syntax error and a flags string', path: '/root/file.ts', text: "new RegExp('a  (', '')" },
  ],
  invalid: [
    {
      name: "#62 { let RegExp = function() {}; } var foo = RegExp('bar    baz…",
      path: '/root/file.ts',
      text: "{ let RegExp = function() {}; } var foo = RegExp('bar    baz');",
      errors: [{ message: 'Spaces are hard to count. Use {4}.', line: 1, column: 43, endLine: 1, endColumn: 63 }],
      output: "{ let RegExp = function() {}; } var foo = RegExp('bar {4}baz');",
    },
    {
      name: '#75 var foo = /(?:  )/;',
      path: '/root/file.ts',
      text: 'var foo = /(?:  )/;',
      errors: [{ message: 'Spaces are hard to count. Use {2}.', line: 1, column: 11, endLine: 1, endColumn: 19 }],
      output: 'var foo = /(?: {2})/;',
    },
    {
      name: "#76 var foo = RegExp('^foo(?=   )');",
      path: '/root/file.ts',
      text: "var foo = RegExp('^foo(?=   )');",
      errors: [{ message: 'Spaces are hard to count. Use {3}.', line: 1, column: 11, endLine: 1, endColumn: 32 }],
      output: "var foo = RegExp('^foo(?= {3})');",
    },
    {
      name: "#80 var foo = new RegExp('\\\\d  ')",
      path: '/root/file.ts',
      text: "var foo = new RegExp('\\\\d  ')",
      errors: [{ message: 'Spaces are hard to count. Use {2}.', line: 1, column: 11, endLine: 1, endColumn: 30 }],
      output: null,
    },
    {
      name: "#82 var foo = new RegExp('\\\\[  \\\\]');",
      path: '/root/file.ts',
      text: "var foo = new RegExp('\\\\[  \\\\]');",
      errors: [{ message: 'Spaces are hard to count. Use {2}.', line: 1, column: 11, endLine: 1, endColumn: 33 }],
      output: null,
    },
    {
      name: '#83 var foo = /[[    ]    ]    /v;',
      path: '/root/file.ts',
      text: 'var foo = /[[    ]    ]    /v;',
      errors: [{ message: 'Spaces are hard to count. Use {4}.', line: 1, column: 11, endLine: 1, endColumn: 30 }],
      output: 'var foo = /[[    ]    ] {4}/v;',
    },
    {
      name: '#91 spaces before the end anchor',
      path: '/root/file.ts',
      text: '/  $/',
      errors: [{ message: 'Spaces are hard to count. Use {2}.', line: 1, column: 1, endLine: 1, endColumn: 6 }],
      output: '/ {2}$/',
    },
    {
      name: '#93 spaces after a class',
      path: '/root/file.ts',
      text: '/[  ]  b/',
      errors: [{ message: 'Spaces are hard to count. Use {2}.', line: 1, column: 1, endLine: 1, endColumn: 10 }],
      output: '/[  ] {2}b/',
    },
    {
      name: '#96 each pattern in a file',
      path: '/root/file.ts',
      text: "const a = /x  y/\nconst b = RegExp('p   q', 'g')",
      errors: [
        { message: 'Spaces are hard to count. Use {2}.', line: 1, column: 11, endLine: 1, endColumn: 17 },
        { message: 'Spaces are hard to count. Use {3}.', line: 2, column: 11, endLine: 2, endColumn: 31 },
      ],
      output: "const a = /x {2}y/\nconst b = RegExp('p {3}q', 'g')",
    },
  ],
})
