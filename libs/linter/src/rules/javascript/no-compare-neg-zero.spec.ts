import { testRule } from '../../testing/rule-tester'
import rule from './no-compare-neg-zero'

testRule(rule, {
  valid: [
    { name: "#5 x === '0'", path: '/root/file.ts', text: "x === '0'" },
    { name: '#15 x < 0', path: '/root/file.ts', text: 'x < 0' },
    { name: '#16 0 < x', path: '/root/file.ts', text: '0 < x' },
    { name: '#21 x >= 0', path: '/root/file.ts', text: 'x >= 0' },
    { name: '#27 Object.is(x, -0)', path: '/root/file.ts', text: 'Object.is(x, -0)' },
    { name: '#28 a negative bigint zero is not the number zero', path: '/root/file.ts', text: 'x === -0n' },
    { name: '#31 a zero with a fraction', path: '/root/file.ts', text: 'x === 0.0' },
    { name: '#32 arithmetic with negative zero', path: '/root/file.ts', text: 'x + -0; x - -0; x * -0; x / -0; x % -0; x ** -0' },
    { name: '#34 relational operators that are not comparisons', path: '/root/file.ts', text: 'x instanceof -0; -0 in x' },
    { name: '#35 negative zero outside a comparison', path: '/root/file.ts', text: 'const z = -0; f(-0); [-0]' },
  ],
  invalid: [
    {
      name: '#46 x < -0',
      path: '/root/file.ts',
      text: 'x < -0',
      errors: [{ message: "Do not use the '<' operator to compare against -0.", line: 1, column: 1, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#56 a parenthesised zero is still the literal zero',
      path: '/root/file.ts',
      text: 'x === -(0)',
      errors: [{ message: "Do not use the '===' operator to compare against -0.", line: 1, column: 1, endLine: 1, endColumn: 11 }],
    },
    {
      name: '#58 a hexadecimal zero',
      path: '/root/file.ts',
      text: 'x === -0x0',
      errors: [{ message: "Do not use the '===' operator to compare against -0.", line: 1, column: 1, endLine: 1, endColumn: 11 }],
    },
    {
      name: '#59 each comparison of a condition',
      path: '/root/file.ts',
      text: 'if (a === -0 || b > -0) {}',
      errors: [
        { message: "Do not use the '===' operator to compare against -0.", line: 1, column: 5, endLine: 1, endColumn: 13 },
        { message: "Do not use the '>' operator to compare against -0.", line: 1, column: 17, endLine: 1, endColumn: 23 },
      ],
    },
    {
      name: '#60 a comparison across lines',
      path: '/root/file.ts',
      text: 'const same =\n  value ===\n  -0',
      errors: [{ message: "Do not use the '===' operator to compare against -0.", line: 2, column: 3, endLine: 3, endColumn: 5 }],
    },
    {
      name: '#61 a comparison with a typed operand',
      path: '/root/file.ts',
      text: 'function f(x: number) { return x == -0 }',
      errors: [{ message: "Do not use the '==' operator to compare against -0.", line: 1, column: 32, endLine: 1, endColumn: 39 }],
    },
  ],
})
