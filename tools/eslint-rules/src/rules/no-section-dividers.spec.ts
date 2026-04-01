import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-section-dividers'

type TestOptions = readonly []
type MessageIds = 'noSectionDividers'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - code without section dividers
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    code: `// This is a normal comment`,
  },
  {
    code: `// Comment with === (only 3 equals)`,
  },
  {
    code: `/* Block comment */`,
  },
  {
    code: `/** JSDoc comment */`,
  },
  {
    code: `const x = 1`,
  },
  {
    code: `// -------- Section --------`,
  },
  {
    code: `// ******** Section ********`,
  },
  {
    code: `const x = '===='`,
  },
  {
    code: `if (a === b && c === d) {}`,
  },
]

/**
 * Invalid test cases - code with section dividers
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `// ====`,
    output: ``,
    errors: [{ messageId: 'noSectionDividers' }],
  },
  {
    code: `// ============================`,
    output: ``,
    errors: [{ messageId: 'noSectionDividers' }],
  },
  {
    code: `// ==== Section ====`,
    output: ``,
    errors: [{ messageId: 'noSectionDividers' }],
  },
  {
    code: `// ============================
// This is some subsection title
// ============================`,
    output: ``,
    errors: [{ messageId: 'noSectionDividers' }],
  },
  {
    code: `const x = 1
// ============================
// Section
// ============================
const y = 2`,
    output: `const x = 1
const y = 2`,
    errors: [{ messageId: 'noSectionDividers' }],
  },
  {
    code: `const x = 1
// ==== END ====`,
    output: `const x = 1
`,
    errors: [{ messageId: 'noSectionDividers' }],
  },
  {
    code: `// ==== First ====
const x = 1
// ==== Second ====`,
    output: `const x = 1
`,
    errors: [{ messageId: 'noSectionDividers' }, { messageId: 'noSectionDividers' }],
  },
  {
    code: `// ====
// Title here
// More description
// ====`,
    output: ``,
    errors: [{ messageId: 'noSectionDividers' }],
  },
]

ruleTester.run('no-section-dividers', rule, {
  valid: validCases,
  invalid: invalidCases,
})
