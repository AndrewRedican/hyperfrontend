import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './no-mixed-type-import'

type TestOptions = readonly []
type MessageIds = 'noMixedTypeImport'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - pure type imports, pure value imports, or import type syntax
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // Pure type imports using import type
  { code: `import type { User, Config } from './types'` },
  { code: `import type { Request, Response } from 'express'` },

  // Pure value imports
  { code: `import { createUser, initConfig } from './module'` },
  { code: `import { readFile, writeFile } from 'node:fs'` },

  // Default imports
  { code: `import express from 'express'` },
  { code: `import React from 'react'` },

  // Mixed default and named (but no type specifiers)
  { code: `import React, { useState, useEffect } from 'react'` },

  // Namespace imports
  { code: `import * as utils from './utils'` },

  // Side-effect imports
  { code: `import './polyfill'` },

  // All specifiers are inline type
  { code: `import { type User, type Config } from './types'` },

  // All specifiers are value
  { code: `import { createUser, updateUser } from './users'` },
]

/**
 * Invalid test cases - mixed type and value imports
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `import { type User, createUser } from './module'`,
    output: `import type { User } from './module'
import { createUser } from './module'`,
    errors: [{ messageId: 'noMixedTypeImport' }],
  },
  {
    code: `import { type User, type Config, createUser, initConfig } from './module'`,
    output: `import type { User, Config } from './module'
import { createUser, initConfig } from './module'`,
    errors: [{ messageId: 'noMixedTypeImport' }],
  },
  {
    code: `import { type Handler, handle } from './handler'`,
    output: `import type { Handler } from './handler'
import { handle } from './handler'`,
    errors: [{ messageId: 'noMixedTypeImport' }],
  },
  {
    code: `import { type A, type B, c, d, e } from 'some-package'`,
    output: `import type { A, B } from 'some-package'
import { c, d, e } from 'some-package'`,
    errors: [{ messageId: 'noMixedTypeImport' }],
  },
  // With aliased imports
  {
    code: `import { type User as U, createUser as create } from './module'`,
    output: `import type { User as U } from './module'
import { createUser as create } from './module'`,
    errors: [{ messageId: 'noMixedTypeImport' }],
  },
]

ruleTester.run('no-mixed-type-import', rule, {
  valid: validCases,
  invalid: invalidCases,
})
