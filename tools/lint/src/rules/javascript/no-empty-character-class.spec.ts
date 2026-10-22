import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-empty-character-class.ts'

testRule(rule, {
  valid: [
    { name: '#2 var regExp = new RegExp("^abc[]");', path: '/root/file.ts', text: 'var regExp = new RegExp("^abc[]");' },
    { name: '#9 var foo = /[\\[a-z[]]/;', path: '/root/file.ts', text: 'var foo = /[\\[a-z[]]/;' },
    { name: '#11 var foo = /\\s*:\\s*/gim;', path: '/root/file.ts', text: 'var foo = /\\s*:\\s*/gim;' },
    { name: '#19 var foo = /[[\\]]]/v;', path: '/root/file.ts', text: 'var foo = /[[\\]]]/v;' },
    { name: '#22 var foo = /[a&&b]/v;', path: '/root/file.ts', text: 'var foo = /[a&&b]/v;' },
    { name: '#23 var foo = /[[a][b]]/v;', path: '/root/file.ts', text: 'var foo = /[[a][b]]/v;' },
    { name: '#24 var foo = /[\\q{}]/v;', path: '/root/file.ts', text: 'var foo = /[\\q{}]/v;' },
    { name: '#25 var foo = /[[^]--\\p{ASCII}]/v;', path: '/root/file.ts', text: 'var foo = /[[^]--\\p{ASCII}]/v;' },
    { name: '#30 a negated class under the v flag', path: '/root/file.ts', text: 'var foo = /[^a]/v' },
    { name: '#31 a regular expression in a template literal is text', path: '/root/file.ts', text: 'var foo = `/[]/`' },
    {
      name: '#32 a pattern with a quantified lookbehind the regular-expression parser rejects is ignored',
      path: '/root/file.ts',
      text: 'var foo = /(?<=a)+[]/',
    },
    {
      name: '#33 a pattern with a property of strings under the u flag is ignored',
      path: '/root/file.ts',
      text: 'var foo = /[]\\p{RGI_Emoji}/u',
    },
  ],
  invalid: [
    {
      name: '#36 if (foo.match(/^abc[]/)) {}',
      path: '/root/file.ts',
      text: 'if (foo.match(/^abc[]/)) {}',
      errors: [{ message: 'Empty class.', line: 1, column: 15, endLine: 1, endColumn: 23 }],
    },
    {
      name: '#42 var foo = /[(]\\u{0}*[]/u;',
      path: '/root/file.ts',
      text: 'var foo = /[(]\\u{0}*[]/u;',
      errors: [{ message: 'Empty class.', line: 1, column: 11, endLine: 1, endColumn: 25 }],
    },
    {
      name: '#52 an empty class inside a group',
      path: '/root/file.ts',
      text: 'var foo = /([])/',
      errors: [{ message: 'Empty class.', line: 1, column: 11, endLine: 1, endColumn: 17 }],
    },
    {
      name: '#53 two empty classes report twice on the literal',
      path: '/root/file.ts',
      text: 'var foo = /[]a[]/',
      errors: [
        { message: 'Empty class.', line: 1, column: 11, endLine: 1, endColumn: 18 },
        { message: 'Empty class.', line: 1, column: 11, endLine: 1, endColumn: 18 },
      ],
    },
    {
      name: '#56 an empty class in a call argument',
      path: '/root/file.ts',
      text: 'foo(/x[]/)',
      errors: [{ message: 'Empty class.', line: 1, column: 5, endLine: 1, endColumn: 10 }],
    },
    {
      name: '#58 a literal on a later line',
      path: '/root/file.ts',
      text: 'const foo = {\n  re: /a[]b/g,\n}',
      errors: [{ message: 'Empty class.', line: 2, column: 7, endLine: 2, endColumn: 14 }],
    },
  ],
})
