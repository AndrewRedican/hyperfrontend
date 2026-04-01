import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-plain-inline-comments'

type TestOptions = readonly []
type MessageIds = 'noPlainInlineComments'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - comments with allowed prefixes or tooling directives
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    code: `// why: Counter starts at 0 to match the API's 0-based indexing
let counter = 0`,
  },
  {
    code: `// how: Uses binary search for O(log n) performance
function search() {}`,
  },
  {
    code: `// context: This matches the behavior in the legacy system
const x = 1`,
  },
  {
    code: `// magic: 86400 = seconds in a day (60 * 60 * 24)
const SECONDS_PER_DAY = 86400`,
  },
  {
    code: `// todo: Add validation once schema is finalized
function process() {}`,
  },
  {
    code: `// fixme: This throws when input is null
function broken() {}`,
  },
  {
    code: `// note: This is used by the test framework
const testHelper = {}`,
  },
  {
    code: `// ref: https://github.com/org/repo/issues/123
function workaround() {}`,
  },
  {
    code: `// WHY: Uppercase is also allowed
const x = 1`,
  },
  {
    code: `// Note: Mixed case works too
const x = 1`,
  },
  {
    code: `// @ts-expect-error - legacy API returns any
const result = legacyCall()`,
  },
  {
    code: `// @ts-ignore
const x: any = 1`,
  },
  {
    code: `// @ts-nocheck
const y = 2`,
  },
  {
    code: `// @ts-check
const z = 3`,
  },
  {
    // note: Testing directive recognition - eslint-env sets environment (no warning)
    code: `/* eslint-env browser */
const x = 1`,
  },
  {
    // note: eslint-env line format also valid
    code: `// eslint-env node
const y = 1`,
  },
  {
    // note: Global directives are recognized
    code: `/* global myGlobal */
const x = myGlobal`,
  },
  {
    // note: Environment directive
    code: `/* eslint-env node */
const x = process.env`,
  },
  {
    code: `// istanbul ignore next
function ignored() {}`,
  },
  {
    code: `// c8 ignore next
function ignored() {}`,
  },
  {
    code: `import(/* webpackChunkName: "lodash" */ 'lodash')`,
  },
  {
    code: `// prettier-ignore
const x =      1`,
  },
  {
    code: `switch (x) {
  case 1:
    // falls through
  case 2:
    break
}`,
  },
  {
    code: `/* This is a block comment */
const x = 1`,
  },
  {
    code: `/** JSDoc comment */
function test() {}`,
  },
  {
    code: `// Initialize config
const config = {}`,
    filename: '/path/to/jest.config.ts',
  },
  {
    code: `// Setup ESLint
module.exports = {}`,
    filename: '/path/to/eslint.config.js',
  },
  {
    code: `// Vite configuration
export default {}`,
    filename: '/path/to/vite.config.ts',
  },
  {
    code: `// Webpack config
module.exports = {}`,
    filename: '/path/to/webpack.config.js',
  },
  {
    code: `// Base TypeScript config
{}`,
    filename: '/path/to/tsconfig.base.json',
  },
  {
    code: `// sourceMappingURL=app.js.map`,
  },
  {
    code: ``,
  },
  {
    code: `const x = 1
const y = 2`,
  },
  {
    code: `try {
  risky()
} catch (e) {
  // swallow error
}`,
  },
  {
    code: `try {
  risky()
} catch (e) {
  // intentionally ignored
}`,
  },
  {
    code: `try {
  x()
} catch {
  // expected to fail
}`,
  },
  {
    code: `function noop() {
  // intentionally empty
}`,
  },
  {
    code: `const noop = function() {
  // no-op
}`,
  },
  {
    code: `const noop = () => {
  // do nothing
}`,
  },
  {
    code: `class Foo {
  onEvent() {
    // override in subclass
  }
}`,
  },
]

/**
 * Invalid test cases - plain inline comments
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `// Initialize the counter
let counter = 0`,
    output: `let counter = 0`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `const x = 1 // increment later`,
    output: `const x = 1`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `// First comment
// Second comment
const x = 1`,
    output: [
      `// Second comment
const x = 1`,
      `const x = 1`,
    ],
    errors: [{ messageId: 'noPlainInlineComments' }, { messageId: 'noPlainInlineComments' }],
  },
  {
    code: `// why not use const
let x = 1`,
    output: `let x = 1`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `// This handles the edge case
function process() {}`,
    output: `function process() {}`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `const x = 1
// Set up the handler
const y = 2`,
    output: `const x = 1
const y = 2`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `function add(a: number, b: number) { // add numbers
  return a + b
}`,
    output: `function add(a: number, b: number) {
  return a + b
}`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `// Just a comment`,
    output: ``,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `const x = 1
// End of file`,
    output: `const x = 1
`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
  {
    code: `const a = 1 // first
const b = 2 // second`,
    output: `const a = 1
const b = 2`,
    errors: [{ messageId: 'noPlainInlineComments' }, { messageId: 'noPlainInlineComments' }],
  },
  {
    code: `// note: This is allowed
// But this is not
const x = 1`,
    output: `// note: This is allowed
const x = 1`,
    errors: [{ messageId: 'noPlainInlineComments' }],
  },
]

ruleTester.run('no-plain-inline-comments', rule, {
  valid: validCases,
  invalid: invalidCases,
})
