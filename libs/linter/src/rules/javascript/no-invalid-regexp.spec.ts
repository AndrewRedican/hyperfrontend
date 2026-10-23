import { testRule } from '../../testing/rule-tester'
import rule from './no-invalid-regexp'

// why: the workspace allows no extra constructor flags; the cases recorded with `allowConstructorFlags` are left out.
testRule(rule, {
  valid: [
    { name: '#5 new RegExp', path: '/root/file.ts', text: 'new RegExp' },
    { name: "#7 global.RegExp('\\\\')", path: '/root/file.ts', text: "global.RegExp('\\\\')" },
    { name: "#51 new RegExp('[A--B]', flags)", path: '/root/file.ts', text: "new RegExp('[A--B]', flags)" },
    {
      name: '#72 flags in a template literal cannot be determined, so a pattern valid without the unicode flags passes',
      path: '/root/file.ts',
      text: "new RegExp('{', `g`)",
    },
    { name: '#73 a pattern behind a type assertion is not a string literal', path: '/root/file.ts', text: "new RegExp('[' as string)" },
    {
      name: '#74 a pattern valid only with a class set, with unknown flags',
      path: '/root/file.ts',
      text: "new RegExp('[[a]&&b]', flags)",
    },
  ],
  invalid: [
    {
      name: "#96 new RegExp(')');",
      path: '/root/file.ts',
      text: "new RegExp(')');",
      errors: [{ message: "Invalid regular expression: /)/: Unmatched ')'.", line: 1, column: 1, endLine: 1, endColumn: 16 }],
    },
    {
      name: "#97 new RegExp('\\\\a', 'u');",
      path: '/root/file.ts',
      text: "new RegExp('\\\\a', 'u');",
      errors: [{ message: 'Invalid regular expression: /\\a/u: Invalid escape.', line: 1, column: 1, endLine: 1, endColumn: 23 }],
    },
    {
      name: "#99 RegExp('\\\\u{0}*');",
      path: '/root/file.ts',
      text: "RegExp('\\\\u{0}*');",
      errors: [{ message: 'Invalid regular expression: /\\u{0}*/: Nothing to repeat.', line: 1, column: 1, endLine: 1, endColumn: 18 }],
    },
    {
      name: "#104 new RegExp('\\\\');",
      path: '/root/file.ts',
      text: "new RegExp('\\\\');",
      errors: [{ message: 'Invalid regular expression: /\\/: \\ at end of pattern.', line: 1, column: 1, endLine: 1, endColumn: 17 }],
    },
    {
      name: "#105 RegExp(')' + '', 'a');",
      path: '/root/file.ts',
      text: "RegExp(')' + '', 'a');",
      errors: [{ message: "Invalid flags supplied to RegExp constructor 'a'.", line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
    {
      name: "#108 new RegExp('[[]', 'v');",
      path: '/root/file.ts',
      text: "new RegExp('[[]', 'v');",
      errors: [
        { message: 'Invalid regular expression: /[[]/v: Unterminated character class.', line: 1, column: 1, endLine: 1, endColumn: 23 },
      ],
    },
    {
      name: "#109 new RegExp('.', 'uv');",
      path: '/root/file.ts',
      text: "new RegExp('.', 'uv');",
      errors: [{ message: "Regex 'u' and 'v' flags cannot be used together.", line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
    {
      name: "#111 new RegExp('[A--B]' /* valid only with `v` flag */, 'u')",
      path: '/root/file.ts',
      text: "new RegExp('[A--B]' /* valid only with `v` flag */, 'u')",
      errors: [
        {
          message: 'Invalid regular expression: /[A--B]/u: Range out of order in character class.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 57,
        },
      ],
    },
    {
      name: "#112 new RegExp('[[]\\\\u{0}*' /* valid only with `u` flag */, 'v')",
      path: '/root/file.ts',
      text: "new RegExp('[[]\\\\u{0}*' /* valid only with `u` flag */, 'v')",
      errors: [
        {
          message: 'Invalid regular expression: /[[]\\u{0}*/v: Unterminated character class.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 61,
        },
      ],
    },
    {
      name: "#113 new RegExp('(?<k>a)(?<k>b)')",
      path: '/root/file.ts',
      text: "new RegExp('(?<k>a)(?<k>b)')",
      errors: [
        {
          message: 'Invalid regular expression: /(?<k>a)(?<k>b)/: Duplicate capture group name.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 29,
        },
      ],
    },
    {
      name: "#114 new RegExp('(?ii:foo)')",
      path: '/root/file.ts',
      text: "new RegExp('(?ii:foo)')",
      errors: [{ message: "Invalid regular expression: /(?ii:foo)/: Duplicated flag 'i'.", line: 1, column: 1, endLine: 1, endColumn: 24 }],
    },
    {
      name: "#115 new RegExp('(?-ii:foo)')",
      path: '/root/file.ts',
      text: "new RegExp('(?-ii:foo)')",
      errors: [
        { message: "Invalid regular expression: /(?-ii:foo)/: Duplicated flag 'i'.", line: 1, column: 1, endLine: 1, endColumn: 25 },
      ],
    },
    {
      name: "#116 new RegExp('(?i-i:foo)')",
      path: '/root/file.ts',
      text: "new RegExp('(?i-i:foo)')",
      errors: [
        { message: "Invalid regular expression: /(?i-i:foo)/: Duplicated flag 'i'.", line: 1, column: 1, endLine: 1, endColumn: 25 },
      ],
    },
    {
      name: "#117 new RegExp('(?-:foo)')",
      path: '/root/file.ts',
      text: "new RegExp('(?-:foo)')",
      errors: [{ message: 'Invalid regular expression: /(?-:foo)/: Invalid empty flags.', line: 1, column: 1, endLine: 1, endColumn: 23 }],
    },
    {
      name: "#118 new RegExp('(?g:foo)')",
      path: '/root/file.ts',
      text: "new RegExp('(?g:foo)')",
      errors: [{ message: 'Invalid regular expression: /(?g:foo)/: Invalid group.', line: 1, column: 1, endLine: 1, endColumn: 23 }],
    },
    {
      name: "#119 new RegExp('(?-u:foo)')",
      path: '/root/file.ts',
      text: "new RegExp('(?-u:foo)')",
      errors: [{ message: 'Invalid regular expression: /(?-u:foo)/: Invalid group.', line: 1, column: 1, endLine: 1, endColumn: 24 }],
    },
    {
      name: '#121 the whole construction is reported, and the message names the unicode flags only',
      path: '/root/file.ts',
      text: "var r = new RegExp(\n  '[',\n  'g'\n);",
      errors: [{ message: 'Invalid regular expression: /[/: Unterminated character class.', line: 1, column: 9, endLine: 4, endColumn: 2 }],
    },
    {
      name: '#122 a valid flag given twice',
      path: '/root/file.ts',
      text: "new RegExp('.', 'gg')",
      errors: [{ message: "Duplicate flags ('g') supplied to RegExp constructor.", line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#126 a pattern invalid with and without the unicode flags, with unknown flags',
      path: '/root/file.ts',
      text: "new RegExp('[', flags)",
      errors: [
        { message: 'Invalid regular expression: /[/: Unterminated character class.', line: 1, column: 1, endLine: 1, endColumn: 23 },
      ],
    },
    {
      name: '#127 a named backreference to a missing group, with unknown flags',
      path: '/root/file.ts',
      text: "new RegExp('(?<a>.)\\\\k<b>', flags)",
      errors: [
        {
          message: 'Invalid regular expression: /(?<a>.)\\k<b>/: Invalid named capture referenced.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#128 a quantifier out of order',
      path: '/root/file.ts',
      text: "new RegExp('a{2,1}')",
      errors: [
        {
          message: 'Invalid regular expression: /a{2,1}/: numbers out of order in {} quantifier.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 21,
        },
      ],
    },
    {
      name: '#129 a code point escape above the last code point',
      path: '/root/file.ts',
      text: "new RegExp('\\\\u{110000}', 'u')",
      errors: [
        { message: 'Invalid regular expression: /\\u{110000}/u: Invalid unicode escape.', line: 1, column: 1, endLine: 1, endColumn: 31 },
      ],
    },
    {
      name: '#131 each invalid call in a file',
      path: '/root/file.ts',
      text: "RegExp('[')\nnew RegExp('.', 'z')",
      errors: [
        { message: 'Invalid regular expression: /[/: Unterminated character class.', line: 1, column: 1, endLine: 1, endColumn: 12 },
        { message: "Invalid flags supplied to RegExp constructor 'z'.", line: 2, column: 1, endLine: 2, endColumn: 21 },
      ],
    },
  ],
})

// why: the parser takes an unknown property name the engine refuses; the message then carries the engine's reason.
testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'an unknown unicode property',
      path: '/root/file.ts',
      text: "new RegExp('\\\\p{Foo}', 'u')",
      errors: [
        { message: 'Invalid regular expression: /\\p{Foo}/u: Invalid property name.', line: 1, column: 1, endLine: 1, endColumn: 28 },
      ],
    },
  ],
})
