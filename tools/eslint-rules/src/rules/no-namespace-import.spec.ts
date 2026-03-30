import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './no-namespace-import'

type TestOptions = readonly []
type MessageIds = 'noNamespaceImport'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - named imports, default imports, type imports, and allowed exceptions
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // Named imports
  { code: `import { readFile } from 'node:fs'` },
  { code: `import { join, resolve } from 'node:path'` },
  { code: `import { debounce, throttle } from 'lodash'` },

  // Default imports
  { code: `import express from 'express'` },
  { code: `import React from 'react'` },

  // Type imports
  { code: `import type { Stats } from 'node:fs'` },
  { code: `import type { Request, Response } from 'express'` },

  // Mixed default and named
  { code: `import React, { useState } from 'react'` },

  // Relative imports
  { code: `import { helper } from './helper'` },
  { code: `import { config } from '../config'` },

  // Side-effect imports
  { code: `import './polyfill'` },

  // EXCEPTIONS - Type-only namespace imports are allowed
  { code: `import type * as actions from './actions'` },
  { code: `import type * as Types from './types'` },

  // EXCEPTIONS - JSON file imports are allowed
  { code: `import * as schema from './schema.json'` },
  { code: `import * as config from '../config.json'` },
  { code: `import * as v4Schema from './v4.json'` },
]

/**
 * Invalid test cases - namespace imports
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `import * as utils from './utils'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'utils' },
      },
    ],
  },
  {
    code: `import * as path from 'node:path'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'path' },
      },
    ],
  },
  {
    code: `import * as lodash from 'lodash'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'lodash' },
      },
    ],
  },
  {
    code: `import * as React from 'react'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'React' },
      },
    ],
  },
  {
    code: `import * as fs from 'node:fs'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'fs' },
      },
    ],
  },
  {
    code: `import * as helpers from '../helpers'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'helpers' },
      },
    ],
  },
  {
    code: `import * as nexus from '@hyperfrontend/nexus'`,
    errors: [
      {
        messageId: 'noNamespaceImport',
        data: { name: 'nexus' },
      },
    ],
  },
]

ruleTester.run('no-namespace-import', rule, {
  valid: validCases,
  invalid: invalidCases,
})
