import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import {
  createTempWorkspaceManager,
  createTypeScriptRuleTester,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule, { RULE_NAME } from './lib-require-jsdoc-example'

type TestOptions = readonly []
type MessageIds = 'missingExample'

const ruleTester = createTypeScriptRuleTester()
const manager = createTempWorkspaceManager()

/**
 * Creates a publishable library workspace with a TypeScript file.
 *
 * @param code - The TypeScript code to write to src/index.ts
 * @returns Configuration for a valid test case
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
 * Valid test cases - code with `@example` tags or non-publishable libraries.
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'skips non-publishable library',
    ...createNonPublishableLibraryCase(`
      /**
       * A function without example.
       */
      export function noExample(): void {}
    `),
  },
  {
    name: 'passes exported function with @example',
    ...createPublishableLibraryCase(`
      /**
       * Adds two numbers.
       *
       * @param a - First number
       * @param b - Second number
       * @returns The sum
       *
       * @example
       * add(1, 2) // => 3
       */
      export function add(a: number, b: number): number {
        return a + b
      }
    `),
  },
  {
    name: 'passes exported arrow function with @example',
    ...createPublishableLibraryCase(`
      /**
       * Multiplies two numbers.
       *
       * @param a - First number
       * @param b - Second number
       * @returns The product
       *
       * @example
       * multiply(2, 3) // => 6
       */
      export const multiply = (a: number, b: number): number => a * b
    `),
  },
  {
    name: 'passes exported class with @example',
    ...createPublishableLibraryCase(`
      /**
       * A simple counter class.
       *
       * @example
       * const counter = new Counter()
       * counter.increment()
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
    name: 'passes type alias (exempt from @example)',
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
    name: 'passes interface (exempt from @example)',
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
       */
      function helper(): void {}
    `),
  },
  {
    name: 'passes non-exported class',
    ...createPublishableLibraryCase(`
      /**
       * Internal class.
       */
      class InternalClass {}
    `),
  },
  {
    name: 'passes exported default function with @example',
    ...createPublishableLibraryCase(`
      /**
       * Default export function.
       *
       * @example
       * myDefault()
       */
      export default function myDefault(): void {}
    `),
  },
  {
    name: 'passes function expression with @example',
    ...createPublishableLibraryCase(`
      /**
       * A function expression.
       *
       * @example
       * greet('World')
       */
      export const greet = function(name: string): string {
        return 'Hello ' + name
      }
    `),
  },
]

/**
 * Invalid test cases - exported items without `@example` in publishable libraries.
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'flags exported function without @example',
    ...createPublishableLibraryCase(`
      /**
       * A function without example.
       *
       * @param x - Input value
       * @returns Output value
       */
      export function noExample(x: number): number {
        return x
      }
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags exported arrow function without @example',
    ...createPublishableLibraryCase(`
      /**
       * Arrow function without example.
       */
      export const arrowNoExample = (): void => {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags exported class without @example',
    ...createPublishableLibraryCase(`
      /**
       * A class without example.
       */
      export class NoExampleClass {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags exported function without JSDoc',
    ...createPublishableLibraryCase(`
      export function noJsDoc(): void {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags exported arrow function without JSDoc',
    ...createPublishableLibraryCase(`
      export const noJsDocArrow = (): void => {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags exported class without JSDoc',
    ...createPublishableLibraryCase(`
      export class NoJsDocClass {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags function expression without @example',
    ...createPublishableLibraryCase(`
      /**
       * Function expression.
       */
      export const funcExpr = function(): void {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags default exported function without @example',
    ...createPublishableLibraryCase(`
      /**
       * Default function.
       */
      export default function defaultFn(): void {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
  {
    name: 'flags default exported class without @example',
    ...createPublishableLibraryCase(`
      /**
       * Default class.
       */
      export default class DefaultClass {}
    `),
    errors: [{ messageId: 'missingExample' }],
  },
]

describe('lib-require-jsdoc-example', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run(RULE_NAME, rule, {
    valid: validCases,
    invalid: invalidCases,
  })
})
