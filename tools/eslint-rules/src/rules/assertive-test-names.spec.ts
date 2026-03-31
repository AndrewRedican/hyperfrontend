import { createTypeScriptRuleTester } from '../testing'
import { assertiveTestNames } from './assertive-test-names'

const ruleTester = createTypeScriptRuleTester()

ruleTester.run('assertive-test-names', assertiveTestNames, {
  valid: [
    { code: `it('returns the correct value', () => {})` },
    { code: `it('handles errors gracefully', () => {})` },
    { code: `it('does not throw an exception', () => {})` },
    { code: `it('triggers callback on success', () => {})` },

    { code: `test('rejects invalid input with TypeError', () => {})` },
    { code: `test('parses JSON correctly', () => {})` },

    { code: `describe('UserService', () => {})` },
    { code: `describe('when user is authenticated', () => {})` },
    { code: `describe('should handle authentication', () => {})` },
    { code: `fdescribe('should authenticate users', () => {})` },
    { code: `xdescribe('should work correctly', () => {})` },

    { code: `fit('handles edge cases', () => {})` },
    { code: `xit('processes data correctly', () => {})` },

    { code: 'it(`returns ${expected} for input`, () => {})' },
    { code: 'test(`handles multiple inputs`, () => {})' },

    { code: `it('shoulder tap triggers notification', () => {})` },

    { code: `myFunction('should do something', () => {})` },
    { code: `custom('should work', () => {})` },

    { code: `obj.it('should work', () => {})` },
    { code: `suite.describe('should run', () => {})` },
    { code: `test.only('should execute', () => {})` },

    { code: `it(testName, () => {})` },
    { code: `describe(suiteName, () => {})` },

    { code: `it(123, () => {})` },
    { code: `test(456, () => {})` },

    { code: 'it(`should ${verb} the data`, () => {})' },
    { code: 'test(`value is ${expected}`, () => {})' },

    { code: `it()` },
    { code: `test()` },
  ],

  invalid: [
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

    {
      code: `test('should reject invalid input', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    {
      code: `fit('should handle edge cases', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `xit('should process data', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    {
      code: `it('SHOULD return true', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it('Should handle errors', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    {
      code: `it('the function should return null', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    {
      code: 'it(`should work with template literals`, () => {})',
      errors: [{ messageId: 'noShouldInTestName' }],
    },
  ],
})
