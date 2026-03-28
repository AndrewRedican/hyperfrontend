import { createTypeScriptRuleTester } from '../testing'
import { assertiveTestNames } from './assertive-test-names'

const ruleTester = createTypeScriptRuleTester()

ruleTester.run('assertive-test-names', assertiveTestNames, {
  valid: [
    // Assertive test names with 'it'
    { code: `it('returns the correct value', () => {})` },
    { code: `it('handles errors gracefully', () => {})` },
    { code: `it('does not throw an exception', () => {})` },
    { code: `it('triggers callback on success', () => {})` },

    // Assertive test names with 'test'
    { code: `test('rejects invalid input with TypeError', () => {})` },
    { code: `test('parses JSON correctly', () => {})` },

    // describe blocks are not checked (can use "should")
    { code: `describe('UserService', () => {})` },
    { code: `describe('when user is authenticated', () => {})` },
    { code: `describe('should handle authentication', () => {})` },
    { code: `fdescribe('should authenticate users', () => {})` },
    { code: `xdescribe('should work correctly', () => {})` },

    // Focused/skipped 'it' variants without "should"
    { code: `fit('handles edge cases', () => {})` },
    { code: `xit('processes data correctly', () => {})` },

    // Template literals without "should"
    { code: 'it(`returns ${expected} for input`, () => {})' },
    { code: 'test(`handles multiple inputs`, () => {})' },

    // Words containing "should" but not as standalone word
    { code: `it('shoulder tap triggers notification', () => {})` },

    // Non-test functions (should be ignored)
    { code: `myFunction('should do something', () => {})` },
    { code: `custom('should work', () => {})` },

    // Method calls (callee is not an Identifier)
    { code: `obj.it('should work', () => {})` },
    { code: `suite.describe('should run', () => {})` },
    { code: `test.only('should execute', () => {})` },

    // No string argument
    { code: `it(testName, () => {})` },
    { code: `describe(suiteName, () => {})` },

    // Literal that is not a string (number)
    { code: `it(123, () => {})` },
    { code: `test(456, () => {})` },

    // Template literals with expressions (not simple)
    { code: 'it(`should ${verb} the data`, () => {})' },
    { code: 'test(`value is ${expected}`, () => {})' },

    // Empty calls
    { code: `it()` },
    { code: `test()` },
  ],

  invalid: [
    // 'it' with "should"
    {
      code: `it('should return the correct value', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it('should handle errors gracefully', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it('should not throw an exception', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    // 'test' with "should"
    {
      code: `test('should reject invalid input', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    // Focused/skipped 'it' variants with "should"
    {
      code: `fit('should handle edge cases', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `xit('should process data', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    // Case insensitive matching
    {
      code: `it('SHOULD return true', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it('Should handle errors', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    // "should" in the middle of the description
    {
      code: `it('the function should return null', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    // Template literals with "should"
    {
      code: 'it(`should work with template literals`, () => {})',
      errors: [{ messageId: 'noShouldInTestName' }],
    },
  ],
})
