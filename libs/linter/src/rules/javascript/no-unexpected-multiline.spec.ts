import { testRule } from '../../testing/rule-tester'
import rule from './no-unexpected-multiline'

testRule(rule, {
  valid: [
    { name: '#2 [a, b, c].forEach(doSomething)', path: '/root/file.ts', text: '[a, b, c].forEach(doSomething)' },
    { name: '#5 var a = b', path: '/root/file.ts', text: 'var a = b\nvoid (x || y).doSomething()' },
    { name: '#8 "abc\\', path: '/root/file.ts', text: '"abc\\\n(123)"' },
    { name: '#9 var a = (', path: '/root/file.ts', text: 'var a = (\n(123)\n)' },
    { name: '#10 f(', path: '/root/file.ts', text: 'f(\n(x)\n)' },
    { name: '#12 let x = function() {};', path: '/root/file.ts', text: 'let x = function() {};\n   `hello`' },
    { name: '#13 let x = function() {}', path: '/root/file.ts', text: 'let x = function() {}\nx `hello`' },
    { name: '#14 String.raw `Hi', path: '/root/file.ts', text: 'String.raw `Hi\n${2+3}!`;' },
    { name: '#23 foo', path: '/root/file.ts', text: '\n            foo\n            / bar /GYM\n        ' },
    { name: '#25 foo /bar/g', path: '/root/file.ts', text: 'foo /bar/g' },
    { name: '#32 var a = b', path: '/root/file.ts', text: 'var a = b\n  ?.(x || y).doSomething()' },
    { name: '#33 var a = b', path: '/root/file.ts', text: 'var a = b\n  ?.[a, b, c].forEach(doSomething)' },
    { name: '#37 class C { field1', path: '/root/file.ts', text: 'class C { field1\n*gen() {} }' },
    { name: '#38 class C { field1 = () => {}', path: '/root/file.ts', text: 'class C { field1 = () => {}\n[field2]; }' },
    { name: '#46 a call with type arguments on the callee line', path: '/root/file.ts', text: 'f<string>(\n  x\n)' },
    { name: '#48 a division by a regular expression literal on the next line', path: '/root/file.ts', text: 'foo /\n/bar/g' },
    { name: '#49 a nested division that is not a regular expression', path: '/root/file.ts', text: 'a / b\n/ c / 2' },
  ],
  invalid: [
    {
      name: '#52 var a = (a || b)',
      path: '/root/file.ts',
      text: 'var a = (a || b)\n(x || y).doSomething()',
      errors: [{ message: 'Unexpected newline between function and ( of function call.', line: 2, column: 1, endLine: 2, endColumn: 2 }],
    },
    {
      name: '#60 foo',
      path: '/root/file.ts',
      text: '\n                foo\n                / bar /gym\n            ',
      errors: [{ message: 'Unexpected newline between numerator and division operator.', line: 3, column: 17, endLine: 3, endColumn: 18 }],
    },
    {
      name: '#65 const x = aaaa<',
      path: '/root/file.ts',
      text: 'const x = aaaa<\n  test\n>/*\ntest\n*/`foo`',
      errors: [{ message: 'Unexpected newline between template tag and template literal.', line: 5, column: 3, endLine: 5, endColumn: 4 }],
    },
    {
      name: '#68 a non-null asserted callee before the newline',
      path: '/root/file.ts',
      text: 'foo!\n(x)',
      errors: [{ message: 'Unexpected newline between function and ( of function call.', line: 2, column: 1, endLine: 2, endColumn: 2 }],
    },
    {
      name: '#69 a parenthesized type assertion before the newline',
      path: '/root/file.ts',
      text: '(a as Foo)\n(x)',
      errors: [{ message: 'Unexpected newline between function and ( of function call.', line: 2, column: 1, endLine: 2, endColumn: 2 }],
    },
    {
      name: '#72 a computed member access after a call on the previous line',
      path: '/root/file.ts',
      text: 'f()\n[0]',
      errors: [{ message: 'Unexpected newline between object and [ of property access.', line: 2, column: 1, endLine: 2, endColumn: 2 }],
    },
    {
      name: '#73 a call and a property access on consecutive lines are both reported',
      path: '/root/file.ts',
      text: 'a\n(b)\n[c]',
      errors: [
        { message: 'Unexpected newline between function and ( of function call.', line: 2, column: 1, endLine: 2, endColumn: 2 },
        { message: 'Unexpected newline between object and [ of property access.', line: 3, column: 1, endLine: 3, endColumn: 2 },
      ],
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a division in parentheses read as a regular expression',
      path: '/w/a.ts',
      text: '(foo\n/ bar) /g',
      errors: [{ message: 'Unexpected newline between numerator and division operator.', line: 2, column: 1, endLine: 2, endColumn: 2 }],
    },
  ],
})
