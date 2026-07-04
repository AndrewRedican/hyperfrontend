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

    { code: `describe.each([1])('should handle %s', () => {})` },
    { code: `describe.only('should run the suite', () => {})` },
    { code: `foo.only('should run', () => {})` },
    { code: `it['only']('should run', () => {})` },

    { code: `getFn()('should run', () => {})` },
    { code: `it['each']([1])('should handle %s', () => {})` },
    { code: `obj.method(1)('should run', () => {})` },
    { code: `foo.each([1])('should handle %s', () => {})` },

    { code: "tag`table`('should run', () => {})" },
    { code: "describe.each`a`('should handle %s', () => {})" },

    { code: `(0, it)('should run', () => {})` },

    { code: `it.each([['should x', 1]])('handles %s', () => {})` },

    { code: `it(testName, () => {})` },
    { code: `describe(suiteName, () => {})` },

    { code: `it(123, () => {})` },
    { code: `test(456, () => {})` },
    { code: `test.only()` },

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

    {
      code: `xtest('should be skipped', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    {
      code: `test.only('should execute', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it.skip('should be skipped', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `test.todo('should implement later')`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it.concurrent('should run concurrently', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it.failing('should fail for now', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },

    {
      code: `it.each([1, 2])('should handle %s', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `test.each([['a']])('should parse %s', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: `it.only.each([1])('should handle %s', () => {})`,
      errors: [{ messageId: 'noShouldInTestName' }],
    },
    {
      code: "it.each`\n  a\n  ${1}\n`('should handle $a', () => {})",
      errors: [{ messageId: 'noShouldInTestName' }],
    },
  ],
})
