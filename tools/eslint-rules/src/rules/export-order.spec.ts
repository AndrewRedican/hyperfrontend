import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './export-order'

type TestOptions = readonly []
type MessageIds = 'incorrectOrder'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - exports in correct order
 */
const validCases: ValidTestCase<TestOptions>[] = [
  { code: `export { foo } from './foo'` },

  {
    code: `export type { Stats } from 'node:fs'
export { readFile } from 'node:fs'`,
  },

  {
    code: `export type { Stats } from 'node:fs'
export type { Express } from 'express'
export type { Channel } from '@hyperfrontend/nexus'
export type { BaseConfig } from '../../config'
export type { Helper } from '../helpers'
export type { LocalType } from './types'
export { readFile } from 'node:fs'
export { default as express } from 'express'
export { createChannel } from '@hyperfrontend/nexus'
export { baseConfig } from '../../config'
export { helper } from '../helpers'
export { localFunc } from './local'`,
  },

  {
    code: `export type { A } from 'node:fs'
export type { B } from 'express'
export type { C } from '@hyperfrontend/nexus'`,
  },

  {
    code: `export { a } from 'node:fs'
export { b } from 'express'
export { c } from '@hyperfrontend/nexus'`,
  },

  {
    code: `export { a } from '../../../deep'
export { b } from '../../middle'
export { c } from '../shallow'
export { d } from './current'`,
  },

  {
    code: `export { a } from '../alpha'
export { b } from '../beta'
export { c } from '../gamma'`,
  },

  { code: `const x = 1` },

  {
    code: `export * from 'node:fs'
export * from 'express'`,
  },

  {
    code: `export type * from 'express'
export * from 'express'`,
  },

  {
    code: `export const a = 1
export function b() {}
export class C {}`,
  },

  {
    code: `export { foo } from './foo'
export const bar = 1`,
  },
]

/**
 * Invalid test cases - exports out of order
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `export { readFile } from 'node:fs'
export type { Stats } from 'node:fs'`,
    output: `export type { Stats } from 'node:fs'
export { readFile } from 'node:fs'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { default as express } from 'express'
export { readFile } from 'node:fs'`,
    output: `export { readFile } from 'node:fs'
export { default as express } from 'express'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { createChannel } from '@hyperfrontend/nexus'
export { default as express } from 'express'`,
    output: `export { default as express } from 'express'
export { createChannel } from '@hyperfrontend/nexus'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { local } from './local'
export { parent } from '../parent'`,
    output: `export { parent } from '../parent'
export { local } from './local'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { shallow } from '../shallow'
export { deep } from '../../deep'`,
    output: `export { deep } from '../../deep'
export { shallow } from '../shallow'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { local } from './local'
export type { A } from 'express'
export { fs } from 'node:fs'
export { nexus } from '@hyperfrontend/nexus'`,
    output: `export type { A } from 'express'
export { fs } from 'node:fs'
export { nexus } from '@hyperfrontend/nexus'
export { local } from './local'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { z } from '../zebra'
export { a } from '../alpha'`,
    output: `export { a } from '../alpha'
export { z } from '../zebra'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export { b } from 'express'
const x = 1
export { a } from 'node:fs'`,
    output: null,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export * from 'express'
export * from 'node:fs'`,
    output: `export * from 'node:fs'
export * from 'express'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `export * from 'express'
export type * from 'express'`,
    output: `export type * from 'express'
export * from 'express'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },
]

ruleTester.run('export-order', rule, {
  valid: validCases,
  invalid: invalidCases,
})
