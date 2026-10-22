import { testRule } from '../../testing/rule-tester.ts'
import rule from './assertive-test-names.ts'

testRule(rule, {
  valid: [
    { name: "#1 it('returns the correct value', () => {})", path: '/root/file.ts', text: "it('returns the correct value', () => {})" },
    {
      name: '#14 it(`returns ${expected} for input`, () => {})',
      path: '/root/file.ts',
      text: 'it(`returns ${expected} for input`, () => {})',
    },
    { name: '#15 test(`handles multiple inputs`, () => {})', path: '/root/file.ts', text: 'test(`handles multiple inputs`, () => {})' },
    {
      name: "#21 describe.each([1])('should handle %s', () => {})",
      path: '/root/file.ts',
      text: "describe.each([1])('should handle %s', () => {})",
    },
    {
      name: "#26 it['each']([1])('should handle %s', () => {})",
      path: '/root/file.ts',
      text: "it['each']([1])('should handle %s', () => {})",
    },
    { name: "#31 (0, it)('should run', () => {})", path: '/root/file.ts', text: "(0, it)('should run', () => {})" },
    {
      name: "#32 it.each([['should x', 1]])('handles %s', () => {})",
      path: '/root/file.ts',
      text: "it.each([['should x', 1]])('handles %s', () => {})",
    },
    { name: '#37 test.only()', path: '/root/file.ts', text: 'test.only()' },
  ],
  invalid: [
    {
      name: '#61 it.each`',
      path: '/root/file.ts',
      text: "it.each`\n  a\n  ${1}\n`('should handle $a', () => {})",
      errors: [
        {
          message:
            'Test names should be assertive statements of fact. Avoid using "should" - use direct verbs like "returns", "throws", "handles" instead.',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 21,
        },
      ],
    },
  ],
})
