import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-unsafe-regex'

type TestOptions = readonly [
  {
    maxQuantifierBound?: number
    maxStarHeight?: number
    flagDynamicConstruction?: boolean
    flagTemplateInterpolation?: 'error' | 'warn' | 'off'
    regexpFactoryFunctions?: string[]
    ignorePatterns?: string[]
  }?,
]

type MessageIds = 'unsafeRegexPattern' | 'dynamicRegex' | 'dynamicCreateRegExp' | 'unsafeInterpolation' | 'exponentialBounds'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - safe regex patterns that should NOT trigger errors
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'simple whitespace pattern',
    code: `const pattern = /\\s+/`,
  },
  {
    name: 'simple digit pattern',
    code: `const pattern = /\\d+/`,
  },
  {
    name: 'simple word character pattern',
    code: `const pattern = /\\w+/`,
  },
  {
    name: 'simple letter pattern (case insensitive)',
    code: `const pattern = /[a-z]+/i`,
  },

  {
    name: 'anchored digit validation',
    code: `const pattern = /^\\d+$/`,
  },
  {
    name: 'anchored hex validation',
    code: `const pattern = /^[a-f0-9]+$/i`,
  },
  {
    name: 'anchored bounded length check',
    code: `const pattern = /^.{1,100}$/`,
  },
  {
    name: 'anchored word pattern',
    code: `const pattern = /^\\w+$/`,
  },

  {
    name: 'distinct word alternation',
    code: `const pattern = /cat|dog/`,
  },
  {
    name: 'file extension alternation',
    code: `const pattern = /\\.js$|\\.ts$/`,
  },
  {
    name: 'optional character in alternation',
    code: `const pattern = /\\.tsx?$/`,
  },
  {
    name: 'protocol matching',
    code: `const pattern = /^https?:\\/\\//`,
  },

  {
    name: 'escaped dot',
    code: `const pattern = /\\./`,
  },
  {
    name: 'escaped dollar sign',
    code: `const pattern = /\\$/`,
  },
  {
    name: 'multiple escaped special characters',
    code: `const pattern = /\\.\\*\\+\\?/`,
  },

  {
    name: 'non-capturing group for protocol',
    code: `const pattern = /(?:https?):\\/\\//`,
  },

  {
    name: 'hex character class',
    code: `const pattern = /[0-9a-fA-F]/`,
  },

  // Note: safe-regex2 may not fully support lookbehind assertions
  {
    name: 'positive lookahead',
    code: `const pattern = /(?=\\d)/`,
  },

  {
    name: 'RegExp constructor with string literal',
    code: `const pattern = new RegExp('^\\\\d+$')`,
  },
  {
    name: 'RegExp constructor with string and flags',
    code: `const pattern = new RegExp('test', 'gi')`,
  },
  {
    name: 'RegExp function call with string literal',
    code: `const pattern = RegExp('\\\\d+')`,
  },

  {
    name: 'createRegExp with string literal',
    code: `const pattern = createRegExp('^\\\\d+$')`,
  },
  {
    name: 'createRegExp with string and flags',
    code: `const pattern = createRegExp('\\\\d+', 'g')`,
  },
  {
    name: 'createRegExp with escaped literal pattern',
    code: `const pattern = createRegExp('\\\\]\\\\(\\\\.?\\\\/?file\\\\.ts\\\\)', 'g')`,
  },

  {
    name: 'RegExp with simple template literal',
    code: 'const pattern = new RegExp(`^\\\\d+$`)',
  },
  {
    name: 'createRegExp with simple template literal',
    code: 'const pattern = createRegExp(`test`)',
  },

  {
    name: 'dynamic RegExp allowed when flagDynamicConstruction is false',
    code: `const pattern = new RegExp(userInput)`,
    options: [{ flagDynamicConstruction: false }],
  },
  {
    name: 'dynamic createRegExp allowed when flagDynamicConstruction is false',
    code: `const pattern = createRegExp(userInput)`,
    options: [{ flagDynamicConstruction: false }],
  },

  {
    name: 'template interpolation allowed when flagTemplateInterpolation is off',
    code: 'const pattern = new RegExp(`${prefix}test`)',
    options: [{ flagTemplateInterpolation: 'off' }],
  },

  {
    name: 'ignored pattern via ignorePatterns option',
    code: `const pattern = /(a+)+/`,
    options: [{ ignorePatterns: ['(a+)+'] }],
  },

  {
    name: 'email-like pattern (simplified)',
    code: `const pattern = /^[^@]+@[^@]+$/`,
  },
  {
    name: 'version string pattern',
    code: `const pattern = /^\\d+\\.\\d+\\.\\d+$/`,
  },
  {
    name: 'ISO date pattern',
    code: `const pattern = /^\\d{4}-\\d{2}-\\d{2}$/`,
  },
  {
    name: 'UUID pattern',
    code: `const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`,
  },
]

/**
 * Invalid test cases - unsafe regex patterns that SHOULD trigger errors
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'nested quantifiers (a+)+',
    code: `const pattern = /(a+)+/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
  {
    name: 'nested quantifiers (.*)+',
    code: `const pattern = /(.*)+/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
  {
    name: 'nested quantifiers (\\d+)+',
    code: `const pattern = /(\\d+)+/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
  {
    name: 'nested quantifiers (a+)*b',
    code: `const pattern = /(a+)*b/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
  {
    name: 'nested quantifiers ((a*)*)*',
    code: `const pattern = /((a*)*)/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },

  // Note: safe-regex2 detects nested quantifiers but may not catch all

  {
    name: 'exponential bounds a{1,100000}',
    code: `const pattern = /a{1,100000}/`,
    errors: [{ messageId: 'exponentialBounds' }],
  },
  {
    name: 'exponential bounds with custom threshold',
    code: `const pattern = /a{1,500}/`,
    options: [{ maxQuantifierBound: 100 }],
    errors: [{ messageId: 'exponentialBounds' }],
  },

  {
    name: 'star-height > 1 pattern',
    code: `const pattern = /((a*b*)*c*)+/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },

  {
    name: 'CVE-2020-7660: serialize-javascript pattern',
    code: `const pattern = /(([^\\s]+)+)+/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
  {
    name: 'CVE-2019-10790: exponential backtracking',
    code: `const pattern = /(a+)+b/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },

  {
    name: 'new RegExp with variable',
    code: `const pattern = new RegExp(userInput)`,
    errors: [{ messageId: 'dynamicRegex' }],
  },
  {
    name: 'RegExp function call with variable',
    code: `const pattern = RegExp(dynamicPattern)`,
    errors: [{ messageId: 'dynamicRegex' }],
  },
  {
    name: 'new RegExp with concatenation',
    code: `const pattern = new RegExp(prefix + '.*')`,
    errors: [{ messageId: 'dynamicRegex' }],
  },
  {
    name: 'new RegExp with function call result',
    code: `const pattern = new RegExp(getPattern())`,
    errors: [{ messageId: 'dynamicRegex' }],
  },

  {
    name: 'createRegExp with variable',
    code: `const pattern = createRegExp(userInput)`,
    errors: [{ messageId: 'dynamicCreateRegExp' }],
  },
  {
    name: 'createRegExp with schema.pattern (variable)',
    code: `const pattern = createRegExp(schema.pattern)`,
    errors: [{ messageId: 'dynamicCreateRegExp' }],
  },
  {
    name: 'createRegExp with function call result',
    code: `const pattern = createRegExp(getPattern())`,
    errors: [{ messageId: 'dynamicCreateRegExp' }],
  },

  {
    name: 'new RegExp with template literal interpolation',
    code: 'const pattern = new RegExp(`${prefix}.*`)',
    errors: [{ messageId: 'unsafeInterpolation' }],
  },
  {
    name: 'RegExp with template literal interpolation',
    code: 'const pattern = RegExp(`^${escaped}$`)',
    errors: [{ messageId: 'unsafeInterpolation' }],
  },
  {
    name: 'createRegExp with template literal interpolation',
    code: 'const pattern = createRegExp(`${prefix}.*`)',
    errors: [{ messageId: 'unsafeInterpolation' }],
  },

  {
    name: 'custom factory function with variable',
    code: `const pattern = myRegExpFactory(userInput)`,
    options: [{ regexpFactoryFunctions: ['createRegExp', 'myRegExpFactory'] }],
    errors: [{ messageId: 'dynamicCreateRegExp' }],
  },

  {
    name: 'unsafe pattern in RegExp constructor string literal',
    code: `const pattern = new RegExp('(a+)+')`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
  {
    name: 'unsafe pattern in createRegExp string literal',
    code: `const pattern = createRegExp('(a+)+')`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },
]

ruleTester.run('no-unsafe-regex', rule, {
  valid: validCases,
  invalid: invalidCases,
})
