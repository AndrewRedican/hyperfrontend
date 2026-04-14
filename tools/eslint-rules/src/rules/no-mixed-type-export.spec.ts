import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './no-mixed-type-export'

type TestOptions = readonly []
type MessageIds = 'noMixedTypeExport'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - pure type exports, pure value exports, or export type syntax
 */
const validCases: ValidTestCase<TestOptions>[] = [
  { code: `export type { User, Config } from './types'` },
  { code: `export type { Request, Response } from 'express'` },

  { code: `export { createUser, initConfig } from './module'` },
  { code: `export { readFile, writeFile } from 'node:fs'` },

  { code: `export default function main() {}` },
  { code: `export default class App {}` },

  { code: `export * from './utils'` },

  { code: `export const foo = 1` },
  { code: `export function bar() {}` },
  { code: `export class Baz {}` },

  { code: `export { type User, type Config } from './types'` },

  { code: `export { createUser, updateUser } from './users'` },

  { code: `export type { User }` },
  { code: `export { createUser }` },

  { code: `export {}` },
  { code: `export {} from './module'` },
]

/**
 * Invalid test cases - mixed type and value exports
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `export { type User, createUser } from './module'`,
    output: `export type { User } from './module'
export { createUser } from './module'`,
    errors: [{ messageId: 'noMixedTypeExport' }],
  },
  {
    code: `export { type User, type Config, createUser, initConfig } from './module'`,
    output: `export type { User, Config } from './module'
export { createUser, initConfig } from './module'`,
    errors: [{ messageId: 'noMixedTypeExport' }],
  },
  {
    code: `export { type Handler, handle } from './handler'`,
    output: `export type { Handler } from './handler'
export { handle } from './handler'`,
    errors: [{ messageId: 'noMixedTypeExport' }],
  },
  {
    code: `export { type A, type B, c, d, e } from 'some-package'`,
    output: `export type { A, B } from 'some-package'
export { c, d, e } from 'some-package'`,
    errors: [{ messageId: 'noMixedTypeExport' }],
  },
  {
    code: `export { type User as U, createUser as create } from './module'`,
    output: `export type { User as U } from './module'
export { createUser as create } from './module'`,
    errors: [{ messageId: 'noMixedTypeExport' }],
  },
  {
    code: `export { type User, createUser }`,
    output: `export type { User }
export { createUser }`,
    errors: [{ messageId: 'noMixedTypeExport' }],
  },
]

ruleTester.run('no-mixed-type-export', rule, {
  valid: validCases,
  invalid: invalidCases,
})
