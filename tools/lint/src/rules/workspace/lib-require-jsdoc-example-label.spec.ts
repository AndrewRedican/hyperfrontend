import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createLibraryWorkspace } from './__fixtures__/library-workspace.ts'
import rule from './lib-require-jsdoc-example-label.ts'

const workspace = createLibraryWorkspace()

// why: the cases were recorded in temporary libraries, the first in one that is not publishable; each is linted in the fixture library its setup describes.
testRule(rule, {
  valid: [
    {
      name: '#1 skips non-publishable library',
      path: join(workspace.root, 'internal', 'src', 'index.ts'),
      text: '\n      /**\n       * A function with unlabeled example.\n       *\n       * @example\n       * noExample()\n       */\n      export function noExample(): void {}\n    ',
    },
    {
      name: '#2 passes exported function with labeled @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Adds two numbers.\n       *\n       * @param a - First number\n       * @param b - Second number\n       * @returns The sum\n       *\n       * @example Basic addition\n       * ```typescript\n       * add(1, 2) // => 3\n       * ```\n       */\n      export function add(a: number, b: number): number {\n        return a + b\n      }\n    ',
    },
    {
      name: '#3 passes exported arrow function with labeled @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Multiplies two numbers.\n       *\n       * @param a - First number\n       * @param b - Second number\n       * @returns The product\n       *\n       * @example Multiply integers\n       * ```typescript\n       * multiply(2, 3) // => 6\n       * ```\n       */\n      export const multiply = (a: number, b: number): number => a * b\n    ',
    },
    {
      name: '#4 passes exported class with labeled @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * A simple counter class.\n       *\n       * @example Creating and incrementing\n       * ```typescript\n       * const counter = new Counter()\n       * counter.increment()\n       * ```\n       */\n      export class Counter {\n        private value = 0\n        increment(): void {\n          this.value++\n        }\n      }\n    ',
    },
    {
      name: '#5 passes multiple labeled @example blocks',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "\n      /**\n       * Fetches user data.\n       *\n       * @param id - User ID\n       * @returns User object\n       *\n       * @example Basic usage\n       * ```typescript\n       * fetchUser(123)\n       * ```\n       *\n       * @example With options\n       * ```typescript\n       * fetchUser(123, { include: ['posts'] })\n       * ```\n       */\n      export function fetchUser(id: number): object {\n        return { id }\n      }\n    ",
    },
    {
      name: '#6 passes type alias (exempt - no @example required)',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Configuration options.\n       */\n      export type Config = {\n        value: string\n      }\n    ',
    },
    {
      name: '#7 passes interface (exempt - no @example required)',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * User interface.\n       */\n      export interface User {\n        name: string\n        age: number\n      }\n    ',
    },
    {
      name: '#8 passes non-exported function',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Internal helper.\n       *\n       * @example\n       * helper()\n       */\n      function helper(): void {}\n    ',
    },
    {
      name: '#10 passes exported default function with labeled @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Default export function.\n       *\n       * @example Default function call\n       * myDefault()\n       */\n      export default function myDefault(): void {}\n    ',
    },
    {
      name: '#16 ignores @exampleUsage - not a complete tag',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * The @exampleUsage pattern is ignored.\n       * Only standalone @example tags are checked.\n       */\n      export function notATag(): void {}\n    ',
    },
    {
      name: '#19 ignores line comments with @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      // @example This is a line comment\n      export function lineComment(): void {}\n    ',
    },
    {
      name: '#21 passes multiple function exports with all labeled examples',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * First function.\n       *\n       * @example First example\n       * first()\n       */\n      export const first = () => {}\n\n      /**\n       * Second function.\n       *\n       * @example Second example\n       * second()\n       */\n      export const second = () => {}\n    ',
    },
  ],
  invalid: [
    {
      name: '#25 flags function expression with unlabeled @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "\n      /**\n       * Function expression without label.\n       *\n       * @example\n       * greet('test')\n       */\n      export const greet = function(name: string): string {\n        return 'Hello ' + name\n      }\n    ",
      errors: [
        {
          message:
            '@example blocks must include a descriptive label on the same line (e.g., "@example Basic usage"). Labels help readers understand what each example demonstrates.',
          line: 2,
          column: 7,
          endLine: 7,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#27 flags @example followed immediately by code block',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Processes data.\n       *\n       * @example\n       * ```typescript\n       * process([1, 2, 3])\n       * ```\n       */\n      export function process(data: number[]): number[] {\n        return data\n      }\n    ',
      errors: [
        {
          message:
            '@example blocks must include a descriptive label on the same line (e.g., "@example Basic usage"). Labels help readers understand what each example demonstrates.',
          line: 2,
          column: 7,
          endLine: 9,
          endColumn: 10,
        },
      ],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(workspace.root, { recursive: true, force: true })
    expect(existsSync(workspace.root)).toBe(false)
  })
})
