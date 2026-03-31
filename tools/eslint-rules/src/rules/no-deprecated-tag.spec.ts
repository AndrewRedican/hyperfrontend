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
  {
    code: `
      // This is deprecated but in a line comment
      function oldFunction() {}
    `,
  },
  {
    code: `
      /**
       * This function replaces the deprecated old approach.
       */
      function newApproach() {}
    `,
  },
  {
    code: `
      /**
       */
      const x = 1
    `,
  },
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
  {
    code: `
      /**
       * Custom annotation.
       * @deprecatedSince 2.0.0
       */
      function annotated() {}
    `,
  },
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
  {
    code: `
      /**
       * @deprecated Use newFunction instead.
       */
      function oldFunction() {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
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
  {
    code: `
      /**
       * @deprecated This class will be removed.
       */
      class OldClass {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  {
    code: `
      /**
       * @deprecated
       */
      const OLD_VALUE = 42
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  {
    code: `/** @deprecated */
const x = 1`,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
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
  {
    code: `
      /**
       * @deprecated Use NewType.
       */
      type OldType = string | number
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
  {
    code: `
      /**
       * @Deprecated This should also be caught.
       */
      function caseInsensitive() {}
    `,
    errors: [{ messageId: 'noDeprecatedTag' }],
  },
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
