import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './max-path-occurrences'

type TestOptions = readonly []
type MessageIds = 'tooManyImports' | 'tooManyExports'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - one import/export per kind per path
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'single import from a path',
    code: `import { foo } from './module'`,
  },
  {
    name: 'two imports from same path (type + value)',
    code: `
import type { User } from './types'
import { createUser } from './types'
    `.trim(),
  },
  {
    name: 'imports from different paths',
    code: `
import { foo } from './module-a'
import { bar } from './module-b'
import { baz } from './module-c'
    `.trim(),
  },
  {
    name: 'single export from a path',
    code: `export { foo } from './module'`,
  },
  {
    name: 'two exports from same path (type + value)',
    code: `
export type { User } from './types'
export { createUser } from './types'
    `.trim(),
  },
  {
    name: 'exports from different paths',
    code: `
export { foo } from './module-a'
export { bar } from './module-b'
export { baz } from './module-c'
    `.trim(),
  },
  {
    name: 'mixed imports and exports within limits',
    code: `
import type { Config } from './config'
import { loadConfig } from './config'
export type { User } from './types'
export { createUser } from './types'
    `.trim(),
  },
  {
    name: 'export without source (local export) does not count',
    code: `
const foo = 1
export { foo }
export { foo as bar }
export { foo as baz }
    `.trim(),
  },
  {
    name: 'side-effect imports from different paths',
    code: `
import './polyfills'
import './setup'
    `.trim(),
  },
  {
    name: 'namespace import with type import (different kinds)',
    code: `
import * as utils from './utils'
import type { UtilType } from './utils'
    `.trim(),
  },
  {
    name: 'single type import',
    code: `import type { Foo, Bar, Baz } from './types'`,
  },
  {
    name: 'single value import with multiple specifiers',
    code: `import { a, b, c, d } from './module'`,
  },
]

/**
 * Invalid test cases - more than one import/export of the same kind per path
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'two type imports from same path',
    code: `
import type { User } from './types'
import type { Config } from './types'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '2' } },
    ],
  },
  {
    name: 'two value imports from same path',
    code: `
import { foo } from './module'
import { bar } from './module'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './module', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './module', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'two type exports from same path',
    code: `
export type { User } from './types'
export type { Config } from './types'
    `.trim(),
    errors: [
      { messageId: 'tooManyExports', data: { path: './types', kind: 'type', count: '2' } },
      { messageId: 'tooManyExports', data: { path: './types', kind: 'type', count: '2' } },
    ],
  },
  {
    name: 'two value exports from same path',
    code: `
export { foo } from './module'
export { bar } from './module'
    `.trim(),
    errors: [
      { messageId: 'tooManyExports', data: { path: './module', kind: 'value', count: '2' } },
      { messageId: 'tooManyExports', data: { path: './module', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'multiple type imports exceeding limit',
    code: `
import type { A } from './types'
import type { B } from './types'
import type { C } from './types'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '3' } },
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '3' } },
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '3' } },
    ],
  },
  {
    name: 'export all declarations count as value exports',
    code: `
export * from './utils'
export * as utils from './utils'
    `.trim(),
    errors: [
      { messageId: 'tooManyExports', data: { path: './utils', kind: 'value', count: '2' } },
      { messageId: 'tooManyExports', data: { path: './utils', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'multiple paths with violations',
    code: `
import { a } from './module-a'
import { b } from './module-a'
import { x } from './module-b'
import { y } from './module-b'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './module-a', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './module-a', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './module-b', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './module-b', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'mixed import and export violations (same kind)',
    code: `
import { a } from './shared'
import { b } from './shared'
export { x } from './shared'
export { y } from './shared'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './shared', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './shared', kind: 'value', count: '2' } },
      { messageId: 'tooManyExports', data: { path: './shared', kind: 'value', count: '2' } },
      { messageId: 'tooManyExports', data: { path: './shared', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'side-effect imports exceeding limit',
    code: `
import './init'
import './init'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './init', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './init', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'default and named imports are both value imports',
    code: `
import Default from './module'
import { named } from './module'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './module', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './module', kind: 'value', count: '2' } },
    ],
  },
  {
    name: 'one path violates type, another violates value',
    code: `
import type { A } from './types'
import type { B } from './types'
import { x } from './values'
import { y } from './values'
    `.trim(),
    errors: [
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './types', kind: 'type', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './values', kind: 'value', count: '2' } },
      { messageId: 'tooManyImports', data: { path: './values', kind: 'value', count: '2' } },
    ],
  },
]

ruleTester.run('max-path-occurrences', rule, {
  valid: validCases,
  invalid: invalidCases,
})
