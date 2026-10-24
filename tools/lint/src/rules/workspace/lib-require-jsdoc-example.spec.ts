import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createLibraryWorkspace } from './__test-utils__/library-workspace.ts'
import rule from './lib-require-jsdoc-example.ts'

const workspace = createLibraryWorkspace()

// why: the cases were recorded in temporary libraries, the first in one that is not publishable; each is linted in the fixture library its setup describes.
testRule(rule, {
  valid: [
    {
      name: '#1 skips non-publishable library',
      path: join(workspace.root, 'internal', 'src', 'index.ts'),
      text: '\n      /**\n       * A function without example.\n       */\n      export function noExample(): void {}\n    ',
    },
    {
      name: '#2 passes exported function with @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Adds two numbers.\n       *\n       * @param a - First number\n       * @param b - Second number\n       * @returns The sum\n       *\n       * @example\n       * add(1, 2) // => 3\n       */\n      export function add(a: number, b: number): number {\n        return a + b\n      }\n    ',
    },
    {
      name: '#3 passes exported arrow function with @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Multiplies two numbers.\n       *\n       * @param a - First number\n       * @param b - Second number\n       * @returns The product\n       *\n       * @example\n       * multiply(2, 3) // => 6\n       */\n      export const multiply = (a: number, b: number): number => a * b\n    ',
    },
    {
      name: '#4 passes exported class with @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * A simple counter class.\n       *\n       * @example\n       * const counter = new Counter()\n       * counter.increment()\n       */\n      export class Counter {\n        private value = 0\n        increment(): void {\n          this.value++\n        }\n      }\n    ',
    },
    {
      name: '#5 passes type alias (exempt from @example)',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Configuration options.\n       */\n      export type Config = {\n        value: string\n      }\n    ',
    },
    {
      name: '#6 passes interface (exempt from @example)',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * User interface.\n       */\n      export interface User {\n        name: string\n        age: number\n      }\n    ',
    },
    {
      name: '#7 passes non-exported function',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Internal helper.\n       */\n      function helper(): void {}\n    ',
    },
    {
      name: '#9 passes exported default function with @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Default export function.\n       *\n       * @example\n       * myDefault()\n       */\n      export default function myDefault(): void {}\n    ',
    },
    {
      name: '#10 passes function expression with @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "\n      /**\n       * A function expression.\n       *\n       * @example\n       * greet('World')\n       */\n      export const greet = function(name: string): string {\n        return 'Hello ' + name\n      }\n    ",
    },
  ],
  invalid: [
    {
      name: '#12 flags exported arrow function without @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Arrow function without example.\n       */\n      export const arrowNoExample = (): void => {}\n    ',
      errors: [
        {
          message:
            'Exported API must include an @example block in its JSDoc comment. Examples improve documentation quality and help users understand usage patterns.',
          line: 5,
          column: 20,
          endLine: 5,
          endColumn: 51,
        },
      ],
    },
    {
      name: '#14 flags exported function without JSDoc',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      export function noJsDoc(): void {}\n    ',
      errors: [
        {
          message:
            'Exported API must include an @example block in its JSDoc comment. Examples improve documentation quality and help users understand usage patterns.',
          line: 2,
          column: 14,
          endLine: 2,
          endColumn: 41,
        },
      ],
    },
    {
      name: '#19 flags default exported class without @example',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: '\n      /**\n       * Default class.\n       */\n      export default class DefaultClass {}\n    ',
      errors: [
        {
          message:
            'Exported API must include an @example block in its JSDoc comment. Examples improve documentation quality and help users understand usage patterns.',
          line: 5,
          column: 22,
          endLine: 5,
          endColumn: 43,
        },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter hold no variable declaration outside an export.
testRule(rule, {
  valid: [
    {
      name: 'a function variable that is not exported',
      path: join(workspace.publishable, 'src', 'index.ts'),
      text: 'const helper = () => {}',
    },
  ],
  invalid: [],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(workspace.root, { recursive: true, force: true })
    expect(existsSync(workspace.root)).toBe(false)
  })
})
