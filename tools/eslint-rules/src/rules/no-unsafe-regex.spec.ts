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
  // ============================================
  // Simple character class patterns
  // ============================================
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

  // ============================================
  // Anchored patterns (bounded input)
  // ============================================
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

  // ============================================
  // Simple alternations (non-overlapping)
  // ============================================
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

  // ============================================
  // Escaped special characters
  // ============================================
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

  // ============================================
  // Non-capturing groups without nested quantifiers
  // ============================================
  {
    name: 'non-capturing group for protocol',
    code: `const pattern = /(?:https?):\\/\\//`,
  },

  // ============================================
  // Character class ranges
  // ============================================
  {
    name: 'hex character class',
    code: `const pattern = /[0-9a-fA-F]/`,
  },

  // ============================================
  // Simple lookahead (non-quantified)
  // Note: safe-regex2 may not fully support lookbehind assertions
  // ============================================
  {
    name: 'positive lookahead',
    code: `const pattern = /(?=\\d)/`,
  },

  // ============================================
  // Safe RegExp constructor with string literals
  // ============================================
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

  // ============================================
  // Safe createRegExp with string literals
  // ============================================
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

  // ============================================
  // Safe simple template literal (no interpolation)
  // ============================================
  {
    name: 'RegExp with simple template literal',
    code: 'const pattern = new RegExp(`^\\\\d+$`)',
  },
  {
    name: 'createRegExp with simple template literal',
    code: 'const pattern = createRegExp(`test`)',
  },

  // ============================================
  // Dynamic construction with flagDynamicConstruction: false
  // ============================================
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

  // ============================================
  // Template interpolation with flagTemplateInterpolation: 'off'
  // ============================================
  {
    name: 'template interpolation allowed when flagTemplateInterpolation is off',
    code: 'const pattern = new RegExp(`${prefix}test`)',
    options: [{ flagTemplateInterpolation: 'off' }],
  },

  // ============================================
  // Ignored patterns
  // ============================================
  {
    name: 'ignored pattern via ignorePatterns option',
    code: `const pattern = /(a+)+/`, // normally unsafe
    options: [{ ignorePatterns: ['(a+)+'] }],
  },

  // ============================================
  // Common real-world safe patterns
  // ============================================
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
  // ============================================
  // Category A1: Nested quantifiers (same char class)
  // ============================================
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

  // ============================================
  // Category A2: Overlapping alternations with quantifiers
  // Note: safe-regex2 detects nested quantifiers but may not catch all
  // overlapping alternation patterns. These tests verify patterns that
  // safe-regex2 DOES detect.
  // ============================================

  // ============================================
  // Category A5: Exponential bounded quantifiers
  // ============================================
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

  // ============================================
  // Category A6: Star-height > 1 patterns
  // ============================================
  {
    name: 'star-height > 1 pattern',
    code: `const pattern = /((a*b*)*c*)+/`,
    errors: [{ messageId: 'unsafeRegexPattern' }],
  },

  // ============================================
  // Known CVE vulnerable patterns
  // ============================================
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

  // ============================================
  // Category B1: Dynamic RegExp construction
  // ============================================
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

  // ============================================
  // Category B4: Dynamic createRegExp construction
  // ============================================
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

  // ============================================
  // Category B3/B5: Template literal interpolation
  // ============================================
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

  // ============================================
  // Custom regexpFactoryFunctions
  // ============================================
  {
    name: 'custom factory function with variable',
    code: `const pattern = myRegExpFactory(userInput)`,
    options: [{ regexpFactoryFunctions: ['createRegExp', 'myRegExpFactory'] }],
    errors: [{ messageId: 'dynamicCreateRegExp' }],
  },

  // ============================================
  // Unsafe patterns in RegExp constructor
  // ============================================
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
