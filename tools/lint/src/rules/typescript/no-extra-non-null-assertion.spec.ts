import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-extra-non-null-assertion.ts'

testRule(rule, {
  valid: [
    {
      name: '#1 const foo: { bar: number } | null = null;',
      path: '/root/file.ts',
      text: '\nconst foo: { bar: number } | null = null;\nconst bar = foo!.bar;\n      ',
    },
    { name: '#4 checksCounter?.textContent!.trim();', path: '/root/file.ts', text: '\nchecksCounter?.textContent!.trim();\n      ' },
    {
      name: '#5 function foo(key: string | null) {',
      path: '/root/file.ts',
      text: '\nfunction foo(key: string | null) {\n  const obj = {};\n  return obj?.[key!];\n}\n      ',
    },
    { name: '#9 an assertion on an argument of an optional call', path: '/root/file.ts', text: 'foo?.(bar!);' },
    { name: '#10 an assertion on a non-optional computed member', path: '/root/file.ts', text: 'foo![bar]!;' },
    { name: '#12 an assertion inside a parenthesised binary expression', path: '/root/file.ts', text: '(foo! + bar!)!;' },
  ],
  invalid: [
    {
      name: '#18 function foo(bar?: { n: number }) {',
      path: '/root/file.ts',
      text: '\nfunction foo(bar?: { n: number }) {\n  return (bar!)?.n;\n}\n      ',
      errors: [{ message: 'Forbidden extra non-null assertion.', line: 3, column: 11, endLine: 3, endColumn: 15 }],
      output: '\nfunction foo(bar?: { n: number }) {\n  return (bar)?.n;\n}\n      ',
    },
    {
      name: '#21 three assertions in a row report the two inner ones and are fixed in two passes',
      path: '/root/file.ts',
      text: 'foo!!!;',
      errors: [
        { message: 'Forbidden extra non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 6 },
        { message: 'Forbidden extra non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 5 },
      ],
      output: 'foo!;',
    },
    {
      name: '#22 an assertion before an optional computed member',
      path: '/root/file.ts',
      text: 'foo!?.[0];',
      errors: [{ message: 'Forbidden extra non-null assertion.', line: 1, column: 1, endLine: 1, endColumn: 5 }],
      output: 'foo?.[0];',
    },
  ],
})
