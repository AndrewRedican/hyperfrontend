import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import {
  createTempWorkspaceManager,
  createTypeScriptRuleTester,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule, { RULE_NAME } from './lib-require-jsdoc-example-label'

type TestOptions = readonly []
type MessageIds = 'missingLabel'

const ruleTester = createTypeScriptRuleTester()
const manager = createTempWorkspaceManager()

/**
 * Creates a publishable library workspace with a TypeScript file.
 *
 * @param code - The TypeScript code to write to src/index.ts
 * @returns Configuration for a valid test case
 *
 * @example Create workspace for testing
 * ```typescript
 * const { code, filename } = createPublishableLibraryCase('export const x = 1')
 * ```
 */
function createPublishableLibraryCase(code: string): { code: string; filename: string } {
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    files: {
      'src/index.ts': code,
    },
  })
  return {
    code,
    filename: workspace.getPath('src/index.ts'),
  }
}

/**
 * Creates a non-publishable library workspace with a TypeScript file.
 *
 * @param code - The TypeScript code to write to src/index.ts
 * @returns Configuration for a valid test case
 *
 * @example Create non-publishable workspace
 * ```typescript
 * const { code, filename } = createNonPublishableLibraryCase('export const x = 1')
 * ```
 */
function createNonPublishableLibraryCase(code: string): { code: string; filename: string } {
  const workspace = manager.create({
    projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
    files: {
      'src/index.ts': code,
    },
  })
  return {
    code,
    filename: workspace.getPath('src/index.ts'),
  }
}

/**
 * Valid test cases - code with labeled `@example` tags or non-publishable libraries.
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'skips non-publishable library',
    ...createNonPublishableLibraryCase(`
      /**
       * A function with unlabeled example.
       *
       * @example
       * noExample()
       */
      export function noExample(): void {}
    `),
  },
  {
    name: 'passes exported function with labeled @example',
    ...createPublishableLibraryCase(`
      /**
       * Adds two numbers.
       *
       * @param a - First number
       * @param b - Second number
       * @returns The sum
       *
       * @example Basic addition
       * \`\`\`typescript
       * add(1, 2) // => 3
       * \`\`\`
       */
      export function add(a: number, b: number): number {
        return a + b
      }
    `),
  },
  {
    name: 'passes exported arrow function with labeled @example',
    ...createPublishableLibraryCase(`
      /**
       * Multiplies two numbers.
       *
       * @param a - First number
       * @param b - Second number
       * @returns The product
       *
       * @example Multiply integers
       * \`\`\`typescript
       * multiply(2, 3) // => 6
       * \`\`\`
       */
      export const multiply = (a: number, b: number): number => a * b
    `),
  },
  {
    name: 'passes exported class with labeled @example',
    ...createPublishableLibraryCase(`
      /**
       * A simple counter class.
       *
       * @example Creating and incrementing
       * \`\`\`typescript
       * const counter = new Counter()
       * counter.increment()
       * \`\`\`
       */
      export class Counter {
        private value = 0
        increment(): void {
          this.value++
        }
      }
    `),
  },
  {
    name: 'passes multiple labeled @example blocks',
    ...createPublishableLibraryCase(`
      /**
       * Fetches user data.
       *
       * @param id - User ID
       * @returns User object
       *
       * @example Basic usage
       * \`\`\`typescript
       * fetchUser(123)
       * \`\`\`
       *
       * @example With options
       * \`\`\`typescript
       * fetchUser(123, { include: ['posts'] })
       * \`\`\`
       */
      export function fetchUser(id: number): object {
        return { id }
      }
    `),
  },
  {
    name: 'passes type alias (exempt - no @example required)',
    ...createPublishableLibraryCase(`
      /**
       * Configuration options.
       */
      export type Config = {
        value: string
      }
    `),
  },
  {
    name: 'passes interface (exempt - no @example required)',
    ...createPublishableLibraryCase(`
      /**
       * User interface.
       */
      export interface User {
        name: string
        age: number
      }
    `),
  },
  {
    name: 'passes non-exported function',
    ...createPublishableLibraryCase(`
      /**
       * Internal helper.
       *
       * @example
       * helper()
       */
      function helper(): void {}
    `),
  },
  {
    name: 'passes non-exported class',
    ...createPublishableLibraryCase(`
      /**
       * Internal class.
       *
       * @example
       * new InternalClass()
       */
      class InternalClass {}
    `),
  },
  {
    name: 'passes exported default function with labeled @example',
    ...createPublishableLibraryCase(`
      /**
       * Default export function.
       *
       * @example Default function call
       * myDefault()
       */
      export default function myDefault(): void {}
    `),
  },
  {
    name: 'passes function expression with labeled @example',
    ...createPublishableLibraryCase(`
      /**
       * A function expression.
       *
       * @example Greeting a user
       * greet('World')
       */
      export const greet = function(name: string): string {
        return 'Hello ' + name
      }
    `),
  },
  {
    name: 'passes function without @example (not enforced by this rule)',
    ...createPublishableLibraryCase(`
      /**
       * A function without any example.
       *
       * @param x - Input value
       * @returns Output value
       */
      export function noExample(x: number): number {
        return x
      }
    `),
  },
  {
    name: 'passes function without JSDoc',
    ...createPublishableLibraryCase(`
      export function noJsDoc(): void {}
    `),
  },
  {
    name: 'handles case insensitivity - uppercase @EXAMPLE with label',
    ...createPublishableLibraryCase(`
      /**
       * Case insensitivity test.
       *
       * @EXAMPLE Uppercase example tag
       * uppercase()
       */
      export function uppercase(): void {}
    `),
  },
  {
    name: 'handles case insensitivity - mixed case @Example with label',
    ...createPublishableLibraryCase(`
      /**
       * Case insensitivity test.
       *
       * @Example Mixed case example tag
       * mixedCase()
       */
      export function mixedCase(): void {}
    `),
  },
  {
    name: 'ignores @exampleUsage - not a complete tag',
    ...createPublishableLibraryCase(`
      /**
       * The @exampleUsage pattern is ignored.
       * Only standalone @example tags are checked.
       */
      export function notATag(): void {}
    `),
  },
  {
    name: 'handles tab after @example with label',
    ...createPublishableLibraryCase(`
      /**
       * Tab-separated label.
       *
       * @example\tTab-separated label
       * tabLabel()
       */
      export function tabLabel(): void {}
    `),
  },
  {
    name: 'ignores non-JSDoc block comment (no leading asterisk)',
    ...createPublishableLibraryCase(`
      /* Not a JSDoc - no asterisk after opening
       * @example
       * notJsDoc()
       */
      export function notJsDoc(): void {}
    `),
  },
  {
    name: 'ignores line comments with @example',
    ...createPublishableLibraryCase(`
      // @example This is a line comment
      export function lineComment(): void {}
    `),
  },
  {
    name: 'passes exported variable that is not a function',
    ...createPublishableLibraryCase(`
      /**
       * A constant value.
       *
       * @example
       * console.log(VALUE)
       */
      export const VALUE = 42
    `),
  },
  {
    name: 'passes multiple function exports with all labeled examples',
    ...createPublishableLibraryCase(`
      /**
       * First function.
       *
       * @example First example
       * first()
       */
      export const first = () => {}

      /**
       * Second function.
       *
       * @example Second example
       * second()
       */
      export const second = () => {}
    `),
  },
]

/**
 * Invalid test cases - exported items with unlabeled `@example` in publishable libraries.
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'flags exported function with unlabeled @example',
    ...createPublishableLibraryCase(`
      /**
       * A function with unlabeled example.
       *
       * @param x - Input value
       * @returns Output value
       *
       * @example
       * \`\`\`typescript
       * noLabel(5)
       * \`\`\`
       */
      export function noLabel(x: number): number {
        return x
      }
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags exported arrow function with unlabeled @example',
    ...createPublishableLibraryCase(`
      /**
       * Arrow function with unlabeled example.
       *
       * @example
       * arrowNoLabel()
       */
      export const arrowNoLabel = (): void => {}
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags exported class with unlabeled @example',
    ...createPublishableLibraryCase(`
      /**
       * A class with unlabeled example.
       *
       * @example
       * new NoLabelClass()
       */
      export class NoLabelClass {}
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags function expression with unlabeled @example',
    ...createPublishableLibraryCase(`
      /**
       * Function expression without label.
       *
       * @example
       * greet('test')
       */
      export const greet = function(name: string): string {
        return 'Hello ' + name
      }
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags when one of multiple @examples lacks label',
    ...createPublishableLibraryCase(`
      /**
       * Fetches user data.
       *
       * @param id - User ID
       * @returns User object
       *
       * @example Basic usage
       * \`\`\`typescript
       * fetchUser(123)
       * \`\`\`
       *
       * @example
       * \`\`\`typescript
       * fetchUser(456)
       * \`\`\`
       */
      export function fetchUser(id: number): object {
        return { id }
      }
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags @example followed immediately by code block',
    ...createPublishableLibraryCase(`
      /**
       * Processes data.
       *
       * @example
       * \`\`\`typescript
       * process([1, 2, 3])
       * \`\`\`
       */
      export function process(data: number[]): number[] {
        return data
      }
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags @example with only whitespace after tag',
    ...createPublishableLibraryCase(`
      /**
       * Transforms input.
       *
       * @example
       * transform('input')
       */
      export function transform(input: string): string {
        return input
      }
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags exported default function with unlabeled @example',
    ...createPublishableLibraryCase(`
      /**
       * Default export function.
       *
       * @example
       * myDefault()
       */
      export default function myDefault(): void {}
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags uppercase @EXAMPLE without label',
    ...createPublishableLibraryCase(`
      /**
       * Case insensitivity test.
       *
       * @EXAMPLE
       * uppercase()
       */
      export function uppercase(): void {}
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags mixed case @Example without label',
    ...createPublishableLibraryCase(`
      /**
       * Case insensitivity test.
       *
       * @Example
       * mixedCase()
       */
      export function mixedCase(): void {}
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
  {
    name: 'flags @example with tab but no label text',
    ...createPublishableLibraryCase(`
      /**
       * Tab after tag but no label.
       *
       * @example\t
       * tabNoLabel()
       */
      export function tabNoLabel(): void {}
    `),
    errors: [{ messageId: 'missingLabel' }],
  },
]

afterAll(() => {
  manager.cleanupAll()
})

ruleTester.run(RULE_NAME, rule, {
  valid: validCases,
  invalid: invalidCases,
})
