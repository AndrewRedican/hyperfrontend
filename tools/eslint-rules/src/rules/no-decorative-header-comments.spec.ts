import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-decorative-header-comments'

type TestOptions = readonly []
type MessageIds = 'noDecorativeHeaderComments'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - legitimate JSDoc or non-header comments
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    code: `/**
 * @module myModule
 */
const x = 1`,
  },
  {
    code: `/**
 * @param name The name
 */
function test(name: string) {}`,
  },
  {
    code: `/**
 * @returns The result
 */
function test() { return 1 }`,
  },
  {
    code: `const x = 1
/**
 * This is a description
 * for something.
 */`,
  },
  {
    code: `// This is a line comment
const x = 1`,
  },
  {
    code: `/** Just one line */
const x = 1`,
  },
  {
    code: `const x = 1`,
  },
  {
    code: `/**
 * @vitest-environment jsdom
 */
describe('test', () => {})`,
  },
  {
    code: `/**
 * @example
 * const x = 1
 */
const y = 2`,
  },
  {
    code: `
/**
 * @module test
 */
const x = 1`,
  },
  {
    code: `/**
 * Individual validation error
 */
export interface ValidationError {
  message: string
}`,
  },
  {
    code: `/**
 * A utility class for handling
 * string operations.
 */
export class StringUtils {
  trim(s: string) { return s.trim() }
}`,
  },
  {
    code: `/**
 * Calculates the sum of two numbers
 * and returns the result.
 */
export function add(a: number, b: number) {
  return a + b
}`,
  },
  {
    code: `/**
 * Represents a user identifier
 * which can be string or number.
 */
export type UserId = string | number`,
  },
  {
    code: `/**
 * Default configuration object
 * for the application.
 */
export const DEFAULT_CONFIG = {
  timeout: 1000,
}`,
  },
  {
    code: `/**
 * Available log levels
 * for the logging system.
 */
export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
}`,
  },
]

/**
 * Invalid test cases - decorative header comments
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `/**
 * This is the vfs module.
 * Blah blah etc, etc.
 */

const x = 1`,
    output: `const x = 1`,
    errors: [{ messageId: 'noDecorativeHeaderComments' }],
  },
  {
    code: `/**
 * File: utils.ts
 * Description: Utility functions
 * Author: Someone
 */

export function util() {}`,
    output: `export function util() {}`,
    errors: [{ messageId: 'noDecorativeHeaderComments' }],
  },
  {
    code: `/**
 *
 * Main module file
 *
 * Contains important stuff
 *
 */

const main = true`,
    output: `const main = true`,
    errors: [{ messageId: 'noDecorativeHeaderComments' }],
  },
  {
    code: `/**
 * This file contains all the utility functions
 * that are used throughout the application.
 * It includes helpers for strings, numbers,
 * and various data transformations.
 */

export const utils = {}`,
    output: `export const utils = {}`,
    errors: [{ messageId: 'noDecorativeHeaderComments' }],
  },
]

ruleTester.run('no-decorative-header-comments', rule, {
  valid: validCases,
  invalid: invalidCases,
})
