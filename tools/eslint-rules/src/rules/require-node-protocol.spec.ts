import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './require-node-protocol'

type TestOptions = readonly []
type MessageIds = 'requireNodeProtocol'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - imports with node: prefix or non-Node.js modules
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // Already has node: prefix
  { code: `import { readFile } from 'node:fs'` },
  { code: `import { join } from 'node:path'` },
  { code: `import { Buffer } from 'node:buffer'` },
  { code: `import * as crypto from 'node:crypto'` },
  { code: `import type { Stats } from 'node:fs'` },
  { code: `import { spawn } from 'node:child_process'` },
  { code: `import { EventEmitter } from 'node:events'` },
  { code: `import { createServer } from 'node:http'` },

  // External packages (not Node.js built-ins)
  { code: `import express from 'express'` },
  { code: `import { debounce } from 'lodash'` },
  { code: `import React from 'react'` },

  // Relative imports
  { code: `import { helper } from './helper'` },
  { code: `import { config } from '../config'` },

  // Workspace packages
  { code: `import { createChannel } from '@hyperfrontend/nexus'` },
]

/**
 * Invalid test cases - Node.js built-in imports without node: prefix
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `import { readFile } from 'fs'`,
    output: `import { readFile } from 'node:fs'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'fs', fixed: 'node:fs' },
      },
    ],
  },
  {
    code: `import { join } from 'path'`,
    output: `import { join } from 'node:path'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'path', fixed: 'node:path' },
      },
    ],
  },
  {
    code: `import { Buffer } from 'buffer'`,
    output: `import { Buffer } from 'node:buffer'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'buffer', fixed: 'node:buffer' },
      },
    ],
  },
  {
    code: `import crypto from 'crypto'`,
    output: `import crypto from 'node:crypto'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'crypto', fixed: 'node:crypto' },
      },
    ],
  },
  {
    code: `import { spawn } from 'child_process'`,
    output: `import { spawn } from 'node:child_process'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'child_process', fixed: 'node:child_process' },
      },
    ],
  },
  {
    code: `import * as os from 'os'`,
    output: `import * as os from 'node:os'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'os', fixed: 'node:os' },
      },
    ],
  },
  {
    code: `import type { Stats } from 'fs'`,
    output: `import type { Stats } from 'node:fs'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'fs', fixed: 'node:fs' },
      },
    ],
  },
  // Double-quoted imports
  {
    code: `import { readFile } from "fs"`,
    output: `import { readFile } from "node:fs"`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'fs', fixed: 'node:fs' },
      },
    ],
  },
  // Subpath imports
  {
    code: `import { promises } from 'fs/promises'`,
    output: `import { promises } from 'node:fs/promises'`,
    errors: [
      {
        messageId: 'requireNodeProtocol',
        data: { source: 'fs/promises', fixed: 'node:fs/promises' },
      },
    ],
  },
]

ruleTester.run('require-node-protocol', rule, {
  valid: validCases,
  invalid: invalidCases,
})
