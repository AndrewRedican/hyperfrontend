import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-async-fs-api'

type TestOptions = readonly []
type MessageIds = 'noAsyncFsMethod' | 'noFsPromisesImport' | 'noAsyncFsNamespace'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - synchronous fs methods and non-fs imports
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // Synchronous fs methods (allowed)
  { code: `import { readFileSync } from 'node:fs'` },
  { code: `import { writeFileSync } from 'node:fs'` },
  { code: `import { existsSync } from 'node:fs'` },
  { code: `import { mkdirSync } from 'node:fs'` },
  { code: `import { readdirSync } from 'node:fs'` },
  { code: `import { statSync } from 'node:fs'` },
  { code: `import { copyFileSync } from 'node:fs'` },
  { code: `import { renameSync } from 'node:fs'` },
  { code: `import { unlinkSync } from 'node:fs'` },
  { code: `import { rmSync } from 'node:fs'` },
  { code: `import { rmdirSync } from 'node:fs'` },
  { code: `import { appendFileSync } from 'node:fs'` },
  { code: `import { chmodSync } from 'node:fs'` },
  { code: `import { chownSync } from 'node:fs'` },
  { code: `import { accessSync } from 'node:fs'` },
  { code: `import { openSync, closeSync } from 'node:fs'` },

  // Sync methods from fs without node: prefix
  { code: `import { readFileSync } from 'fs'` },
  { code: `import { writeFileSync, mkdirSync } from 'fs'` },

  // Type imports (allowed)
  { code: `import type { Stats } from 'node:fs'` },
  { code: `import type { Dirent, PathLike } from 'node:fs'` },

  // Non-fs modules
  { code: `import { join } from 'node:path'` },
  { code: `import { createServer } from 'node:http'` },
  { code: `import express from 'express'` },

  // Relative imports
  { code: `import { helper } from './helper'` },

  // Workspace packages
  { code: `import { createChannel } from '@hyperfrontend/nexus'` },

  // Namespace import with sync method calls
  {
    code: `
      import * as fs from 'node:fs'
      const data = fs.readFileSync('./file.txt', 'utf-8')
    `,
  },

  // Namespace import with computed property access (sync method)
  {
    code: `
      import * as fs from 'node:fs'
      const data = fs['readFileSync']('./file.txt', 'utf-8')
    `,
  },

  // Namespace import with dynamic property access (not a string literal)
  {
    code: `
      import * as fs from 'node:fs'
      const method = 'readFileSync'
      const data = fs[method]('./file.txt', 'utf-8')
    `,
  },

  // Member expression with non-identifier object (function call result)
  {
    code: `
      function getFs() { return require('node:fs') }
      getFs().readFile('./file.txt', () => {})
    `,
  },

  // Member expression with nested property access
  {
    code: `
      const modules = { fs: require('node:fs') }
      modules.fs.readFile('./file.txt', () => {})
    `,
  },

  // fs constants (allowed)
  { code: `import { constants } from 'node:fs'` },
]

/**
 * Invalid test cases - async fs methods that should be flagged
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  // fs/promises imports (completely prohibited)
  {
    code: `import { readFile } from 'node:fs/promises'`,
    errors: [
      {
        messageId: 'noFsPromisesImport',
        data: { source: 'node:fs/promises' },
      },
    ],
  },
  {
    code: `import { readFile } from 'fs/promises'`,
    errors: [
      {
        messageId: 'noFsPromisesImport',
        data: { source: 'fs/promises' },
      },
    ],
  },
  {
    code: `import * as fsPromises from 'node:fs/promises'`,
    errors: [
      {
        messageId: 'noFsPromisesImport',
        data: { source: 'node:fs/promises' },
      },
    ],
  },

  // Named imports of async methods from fs
  {
    code: `import { readFile } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'readFile', syncMethod: 'readFileSync' },
      },
    ],
  },
  {
    code: `import { writeFile } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'writeFile', syncMethod: 'writeFileSync' },
      },
    ],
  },
  {
    code: `import { mkdir } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'mkdir', syncMethod: 'mkdirSync' },
      },
    ],
  },
  {
    code: `import { readdir } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'readdir', syncMethod: 'readdirSync' },
      },
    ],
  },
  {
    code: `import { stat } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'stat', syncMethod: 'statSync' },
      },
    ],
  },
  {
    code: `import { copyFile } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'copyFile', syncMethod: 'copyFileSync' },
      },
    ],
  },
  {
    code: `import { rename } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'rename', syncMethod: 'renameSync' },
      },
    ],
  },
  {
    code: `import { unlink } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'unlink', syncMethod: 'unlinkSync' },
      },
    ],
  },
  {
    code: `import { rm } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'rm', syncMethod: 'rmSync' },
      },
    ],
  },
  {
    code: `import { rmdir } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'rmdir', syncMethod: 'rmdirSync' },
      },
    ],
  },
  {
    code: `import { appendFile } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'appendFile', syncMethod: 'appendFileSync' },
      },
    ],
  },
  {
    code: `import { access } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'access', syncMethod: 'accessSync' },
      },
    ],
  },
  {
    code: `import { chmod } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'chmod', syncMethod: 'chmodSync' },
      },
    ],
  },
  {
    code: `import { chown } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'chown', syncMethod: 'chownSync' },
      },
    ],
  },
  {
    code: `import { link } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'link', syncMethod: 'linkSync' },
      },
    ],
  },
  {
    code: `import { symlink } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'symlink', syncMethod: 'symlinkSync' },
      },
    ],
  },
  {
    code: `import { readlink } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'readlink', syncMethod: 'readlinkSync' },
      },
    ],
  },
  {
    code: `import { realpath } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'realpath', syncMethod: 'realpathSync' },
      },
    ],
  },
  {
    code: `import { lstat } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'lstat', syncMethod: 'lstatSync' },
      },
    ],
  },
  {
    code: `import { truncate } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'truncate', syncMethod: 'truncateSync' },
      },
    ],
  },
  {
    code: `import { open, close } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'open', syncMethod: 'openSync' },
      },
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'close', syncMethod: 'closeSync' },
      },
    ],
  },
  {
    code: `import { mkdtemp } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'mkdtemp', syncMethod: 'mkdtempSync' },
      },
    ],
  },
  {
    code: `import { cp } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'cp', syncMethod: 'cpSync' },
      },
    ],
  },

  // Async methods from fs without node: prefix
  {
    code: `import { readFile } from 'fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'readFile', syncMethod: 'readFileSync' },
      },
    ],
  },
  {
    code: `import { writeFile, mkdir } from 'fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'writeFile', syncMethod: 'writeFileSync' },
      },
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'mkdir', syncMethod: 'mkdirSync' },
      },
    ],
  },

  // Namespace import with async method calls
  {
    code: `
      import * as fs from 'node:fs'
      fs.readFile('./file.txt', 'utf-8', () => {})
    `,
    errors: [
      {
        messageId: 'noAsyncFsNamespace',
        data: { method: 'readFile', syncMethod: 'readFileSync' },
      },
    ],
  },
  {
    code: `
      import * as fs from 'fs'
      fs.writeFile('./file.txt', 'data', () => {})
    `,
    errors: [
      {
        messageId: 'noAsyncFsNamespace',
        data: { method: 'writeFile', syncMethod: 'writeFileSync' },
      },
    ],
  },
  {
    code: `
      import * as fileSystem from 'node:fs'
      fileSystem.mkdir('./dir', () => {})
    `,
    errors: [
      {
        messageId: 'noAsyncFsNamespace',
        data: { method: 'mkdir', syncMethod: 'mkdirSync' },
      },
    ],
  },

  // CommonJS require for fs/promises
  {
    code: `const fs = require('node:fs/promises')`,
    errors: [
      {
        messageId: 'noFsPromisesImport',
        data: { source: 'node:fs/promises' },
      },
    ],
  },
  {
    code: `const { readFile } = require('fs/promises')`,
    errors: [
      {
        messageId: 'noFsPromisesImport',
        data: { source: 'fs/promises' },
      },
    ],
  },

  // Namespace import with computed property access (async method)
  {
    code: `
      import * as fs from 'node:fs'
      fs['readFile']('./file.txt', 'utf-8', () => {})
    `,
    errors: [
      {
        messageId: 'noAsyncFsNamespace',
        data: { method: 'readFile', syncMethod: 'readFileSync' },
      },
    ],
  },

  // String literal import specifier (ES2022 module syntax)
  {
    code: `import { "readFile" as rf } from 'node:fs'`,
    errors: [
      {
        messageId: 'noAsyncFsMethod',
        data: { method: 'readFile', syncMethod: 'readFileSync' },
      },
    ],
  },
]

ruleTester.run('no-async-fs-api', rule, {
  valid: validCases,
  invalid: invalidCases,
})
