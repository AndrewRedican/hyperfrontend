import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-useless-backreference.ts'

// why: the previous linter could turn the `RegExp` global off, through a `/* globals */` comment or its configuration; the new one knows no such setting, so those cases are left out.
testRule(rule, {
  valid: [
    { name: "#1 regExp('\\\\1(a)')", path: '/root/file.ts', text: "regExp('\\\\1(a)')" },
    { name: "#4 new foo.RegExp('\\\\1(a)')", path: '/root/file.ts', text: "new foo.RegExp('\\\\1(a)')" },
    { name: "#7 RegExp('\\\\1(a)' + suffix)", path: '/root/file.ts', text: "RegExp('\\\\1(a)' + suffix)" },
    { name: '#8 new RegExp(`${prefix}\\\\1(a)`)', path: '/root/file.ts', text: 'new RegExp(`${prefix}\\\\1(a)`)' },
    { name: "#9 let RegExp; new RegExp('\\\\1(a)');", path: '/root/file.ts', text: "let RegExp; new RegExp('\\\\1(a)');" },
    {
      name: "#10 function foo() { var RegExp; RegExp('\\\\1(a)', 'u'); }",
      path: '/root/file.ts',
      text: "function foo() { var RegExp; RegExp('\\\\1(a)', 'u'); }",
    },
    {
      name: "#11 function foo(RegExp) { new RegExp('\\\\1(a)'); }",
      path: '/root/file.ts',
      text: "function foo(RegExp) { new RegExp('\\\\1(a)'); }",
    },
    {
      name: "#12 if (foo) { const RegExp = bar; RegExp('\\\\1(a)'); }",
      path: '/root/file.ts',
      text: "if (foo) { const RegExp = bar; RegExp('\\\\1(a)'); }",
    },
    { name: '#19 /^ab|[cd].\\n$/', path: '/root/file.ts', text: '/^ab|[cd].\\n$/' },
    { name: "#22 new RegExp('\\\\n\\\\d(a)')", path: '/root/file.ts', text: "new RegExp('\\\\n\\\\d(a)')" },
    { name: '#24 /\\0(a)/u', path: '/root/file.ts', text: '/\\0(a)/u' },
    { name: '#36 /^[\\1](a)$/', path: '/root/file.ts', text: '/^[\\1](a)$/' },
    { name: '#38 /\\11(a)/', path: '/root/file.ts', text: '/\\11(a)/' },
    { name: '#39 /\\k<foo>(a)/', path: '/root/file.ts', text: '/\\k<foo>(a)/' },
    { name: '#55 /(a)?(b)*(\\1)(c)/', path: '/root/file.ts', text: '/(a)?(b)*(\\1)(c)/' },
    { name: "#91 RegExp('\\\\1(a)[')", path: '/root/file.ts', text: "RegExp('\\\\1(a)[')" },
    { name: "#92 new RegExp('\\\\1(a){', 'u')", path: '/root/file.ts', text: "new RegExp('\\\\1(a){', 'u')" },
    { name: "#93 new RegExp('\\\\1(a)\\\\2', 'ug')", path: '/root/file.ts', text: "new RegExp('\\\\1(a)\\\\2', 'ug')" },
    { name: "#95 RegExp('\\\\1(a)\\\\k<foo>', 'u')", path: '/root/file.ts', text: "RegExp('\\\\1(a)\\\\k<foo>', 'u')" },
    { name: "#97 new RegExp('([[A--B]])\\\\1', 'v')", path: '/root/file.ts', text: "new RegExp('([[A--B]])\\\\1', 'v')" },
    { name: "#98 new RegExp('[[]\\\\1](a)', 'v')", path: '/root/file.ts', text: "new RegExp('[[]\\\\1](a)', 'v')" },
    { name: '#100 a RegExp call without arguments has no pattern', path: '/root/file.ts', text: 'new RegExp()' },
    {
      name: '#101 a pattern behind a type assertion is not a constant',
      path: '/root/file.ts',
      text: "new RegExp(pattern as string, 'u')",
    },
    { name: '#102 a pattern behind a non-null assertion is not a constant', path: '/root/file.ts', text: 'RegExp(pattern!)' },
    {
      name: '#103 a raw template escapes the backslash, so no backreference remains',
      path: '/root/file.ts',
      text: 'new RegExp(String.raw`\\\\1(a)`)',
    },
    { name: '#107 a backreference after the group through globalThis', path: '/root/file.ts', text: "globalThis.RegExp('(a)\\\\1')" },
    {
      name: '#110 duplicate named groups outside disjoint alternatives are a syntax error',
      path: '/root/file.ts',
      text: '/(?<!(?<a>x))(?:(?<a>y)|\\k<a>)/',
    },
  ],
  invalid: [
    {
      name: '#155 /(?<=(?:(a)\\1))b/',
      path: '/root/file.ts',
      text: '/(?<=(?:(a)\\1))b/',
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which appears before in the same lookbehind.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 18,
        },
      ],
    },
    {
      name: '#170 /^(?:(a(?=a))|\\1b)+$/',
      path: '/root/file.ts',
      text: '/^(?:(a(?=a))|\\1b)+$/',
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a(?=a))' which is in another alternative.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 22,
        },
      ],
    },
    {
      name: '#187 /(?!\\1(a)).\\1/',
      path: '/root/file.ts',
      text: '/(?!\\1(a)).\\1/',
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 15,
        },
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which is in a negative lookaround.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
    {
      name: "#188 /(a)\\2(b)/; RegExp('(\\\\1)');",
      path: '/root/file.ts',
      text: "/(a)\\2(b)/; RegExp('(\\\\1)');",
      errors: [
        {
          message: "Backreference '\\2' will be ignored. It references group '(b)' which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 11,
        },
        {
          message: "Backreference '\\1' will be ignored. It references group '(\\1)' from within that group.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 28,
        },
      ],
    },
    {
      name: "#189 RegExp('\\\\1(a){', flags);",
      path: '/root/file.ts',
      text: "RegExp('\\\\1(a){', flags);",
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 25,
        },
      ],
    },
    {
      name: "#190 const r = RegExp, p = '\\\\1', s = '(a)'; new r(p + s);",
      path: '/root/file.ts',
      text: "const r = RegExp, p = '\\\\1', s = '(a)'; new r(p + s);",
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which appears later in the pattern.",
          line: 1,
          column: 41,
          endLine: 1,
          endColumn: 53,
        },
      ],
    },
    {
      name: '#192 /\\k<foo>((?<foo>bar)|(?<foo>baz))/',
      path: '/root/file.ts',
      text: '/\\k<foo>((?<foo>bar)|(?<foo>baz))/',
      errors: [
        {
          message:
            "Backreference '\\k<foo>' will be ignored. It references group '(?<foo>bar)' and another group which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#194 /\\k<foo>((?<foo>bar)|(?<foo>baz)|(?<foo>qux))/',
      path: '/root/file.ts',
      text: '/\\k<foo>((?<foo>bar)|(?<foo>baz)|(?<foo>qux))/',
      errors: [
        {
          message:
            "Backreference '\\k<foo>' will be ignored. It references group '(?<foo>bar)' and other 2 groups which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 47,
        },
      ],
    },
    {
      name: '#196 /((?<foo>bar)|\\k<foo>|(?<foo>baz))/',
      path: '/root/file.ts',
      text: '/((?<foo>bar)|\\k<foo>|(?<foo>baz))/',
      errors: [
        {
          message:
            "Backreference '\\k<foo>' will be ignored. It references group '(?<foo>bar)' and another group which is in another alternative.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#197 /((?<foo>bar)|\\k<foo>|(?<foo>baz)|(?<foo>qux))/',
      path: '/root/file.ts',
      text: '/((?<foo>bar)|\\k<foo>|(?<foo>baz)|(?<foo>qux))/',
      errors: [
        {
          message:
            "Backreference '\\k<foo>' will be ignored. It references group '(?<foo>bar)' and other 2 groups which is in another alternative.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 48,
        },
      ],
    },
    {
      name: '#199 /(?<=((?<foo>bar)|(?<foo>baz))\\k<foo>)/',
      path: '/root/file.ts',
      text: '/(?<=((?<foo>bar)|(?<foo>baz))\\k<foo>)/',
      errors: [
        {
          message:
            "Backreference '\\k<foo>' will be ignored. It references group '(?<foo>bar)' and another group which appears before in the same lookbehind.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 40,
        },
      ],
    },
    {
      name: '#200 /((?!(?<foo>bar))|(?!(?<foo>baz)))\\k<foo>/',
      path: '/root/file.ts',
      text: '/((?!(?<foo>bar))|(?!(?<foo>baz)))\\k<foo>/',
      errors: [
        {
          message:
            "Backreference '\\k<foo>' will be ignored. It references group '(?<foo>bar)' and another group which is in a negative lookaround.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 43,
        },
      ],
    },
    {
      name: '#202 the report covers the whole constructor call',
      path: '/root/file.ts',
      text: "x = new RegExp(\n  '(\\\\1)'\n)",
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(\\1)' from within that group.",
          line: 1,
          column: 5,
          endLine: 3,
          endColumn: 2,
        },
      ],
    },
    {
      name: '#203 a template pattern without substitutions is a constant',
      path: '/root/file.ts',
      text: 'new RegExp(`\\\\1(a)`)',
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 21,
        },
      ],
    },
    {
      name: '#204 a raw template keeps its backslash as a backreference',
      path: '/root/file.ts',
      text: 'new RegExp(String.raw`\\1(a)`)',
      errors: [
        {
          message: "Backreference '\\1' will be ignored. It references group '(a)' which appears later in the pattern.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
  ],
})
