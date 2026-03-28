import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './no-deprecated-tag'

type TestOptions = readonly []
type MessageIds = 'noDeprecatedTag'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - code without the deprecated tag
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // Standard JSDoc without deprecated tag
  {
    code: `
      /**
       * A useful function.
       * @param x - The input value.
       * @returns The output value.
       */
      function foo(x: number): number {
        return x * 2
      }
    `,
  },
  // Line comments mentioning deprecated (not a JSDoc tag)
  {
    code: `
      // This is deprecated but in a line comment
      function oldFunction() {}
    `,
  },
  // Word "deprecated" in description (not a tag)
  {
    code: `
      /**
       * This function replaces the deprecated old approach.
       */
      function newApproach() {}
    `,
  },
  // Empty JSDoc block
  {
    code: `
      /**
       */
      const x = 1
    `,
  },
  // JSDoc with various tags but no deprecated
  {
    code: `
      /**
       * Process data.
       * @param data - Input data.
       * @throws Error if data is invalid.
       * @example
       * processData({ value: 1 })
       */
      function processData(data: object): void {}
    `,
  },
  // Class with standard JSDoc
  {
    code: `
      /**
       * A sample class.
       */
      class MyClass {
        /**
         * Constructor.
         */
        constructor() {}
      }
    `,
  },
  // Interface without deprecated
  {
    code: `
      /**
       * Configuration interface.
       */
      interface Config {
        value: string
      }
    `,
  },
  // Tag that starts with "deprecated" but is not the deprecated tag itself
  {
    code: `
      /**
       * Custom annotation.
       * @deprecatedSince 2.0.0
       */
      function annotated() {}
    `,
  },
  // Multiple similar tags but none exactly "@deprecated"
  {
    code: `
      /**
       * @deprecatedReason This is not the deprecated tag
       * @deprecatedVersion 1.0
       */
      const value = 1
    `,
  },
]

/**
 * Invalid test cases - code with the deprecated tag
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  // Basic deprecated function
  {
    code: `
      /**
       * @deprecated Use newFunction instead.
       */
      function oldFunction() {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated with other tags
  {
    code: `
      /**
       * An old function.
       * @deprecated Since v2.0.0.
       * @param x - Input value.
       */
      function legacyFn(x: number) {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated class
  {
    code: `
      /**
       * @deprecated This class will be removed.
       */
      class OldClass {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated constant
  {
    code: `
      /**
       * @deprecated
       */
      const OLD_VALUE = 42
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Single-line JSDoc with deprecated
  {
    code: `/** @deprecated */
const x = 1`,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated interface
  {
    code: `
      /**
       * @deprecated Use NewInterface.
       */
      interface OldInterface {
        value: string
      }
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated type alias
  {
    code: `
      /**
       * @deprecated Use NewType.
       */
      type OldType = string | number
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Case-insensitive: uppercase D
  {
    code: `
      /**
       * @Deprecated This should also be caught.
       */
      function caseInsensitive() {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated method in class
  {
    code: `
      class MyClass {
        /**
         * @deprecated Use newMethod instead.
         */
        oldMethod() {}
      }
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Deprecated property in interface
  {
    code: `
      interface Config {
        /**
         * @deprecated Use newProp instead.
         */
        oldProp: string
      }
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  // Non-matching prefix followed by real deprecated tag in same comment
  {
    code: `
      /**
       * @deprecatedReason Not the real tag
       * @deprecated Real deprecated tag here.
       */
      function mixedTags() {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
]

ruleTester.run('no-deprecated-tag', rule, {
  valid: validCases,
  invalid: invalidCases,
})
