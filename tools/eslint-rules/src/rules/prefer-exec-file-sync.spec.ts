import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './prefer-exec-file-sync'

type TestOptions = readonly []
type MessageIds = 'preferExecFileSync' | 'preferExecFileSyncNamespace'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - execFileSync usage and non-child_process imports
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // execFileSync is allowed (preferred alternative)
  { code: `import { execFileSync } from 'node:child_process'` },
  { code: `import { execFileSync } from 'child_process'` },
  { code: `import { execFileSync, spawnSync } from 'node:child_process'` },

  // Other child_process methods are allowed
  { code: `import { spawn } from 'node:child_process'` },
  { code: `import { spawnSync } from 'node:child_process'` },
  { code: `import { fork } from 'node:child_process'` },
  { code: `import { exec } from 'node:child_process'` },
  { code: `import { execFile } from 'node:child_process'` },

  // Type imports (allowed)
  { code: `import type { ChildProcess } from 'node:child_process'` },
  { code: `import type { ExecSyncOptions } from 'node:child_process'` },

  // Non-child_process modules
  { code: `import { readFileSync } from 'node:fs'` },
  { code: `import { join } from 'node:path'` },
  { code: `import express from 'express'` },

  // Relative imports
  { code: `import { helper } from './helper'` },

  // Workspace packages
  { code: `import { createChannel } from '@hyperfrontend/nexus'` },

  // Namespace import with non-execSync method calls
  {
    code: `
      import * as cp from 'node:child_process'
      const result = cp.execFileSync('ls', ['-la'])
    `,
  },

  // Namespace import with computed property access (non-execSync method)
  {
    code: `
      import * as cp from 'node:child_process'
      const result = cp['execFileSync']('ls', ['-la'])
    `,
  },

  // Namespace import with dynamic property access (not a string literal)
  {
    code: `
      import * as cp from 'node:child_process'
      const method = 'execFileSync'
      const result = cp[method]('ls', ['-la'])
    `,
  },

  // Member expression with non-identifier object (function call result)
  {
    code: `
      function getCp() { return require('node:child_process') }
      getCp().execSync('ls')
    `,
  },

  // Member expression with nested property access
  {
    code: `
      const modules = { cp: require('node:child_process') }
      modules.cp.execSync('ls')
    `,
  },

  // require with non-matching modules
  {
    code: `
      const fs = require('node:fs')
      fs.readFileSync('./file.txt')
    `,
  },

  // require destructuring with non-execSync methods
  {
    code: `
      const { execFileSync } = require('node:child_process')
      execFileSync('ls', ['-la'])
    `,
  },

  // require namespace style with non-execSync method
  {
    code: `
      const cp = require('node:child_process')
      cp.execFileSync('ls', ['-la'])
    `,
  },
]

/**
 * Invalid test cases - execSync usage that should be flagged
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  // Named import of execSync from node:child_process
  {
    code: `import { execSync } from 'node:child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // Named import of execSync from child_process (without node: prefix)
  {
    code: `import { execSync } from 'child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // Multiple imports including execSync
  {
    code: `import { execSync, execFileSync } from 'node:child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // Aliased import
  {
    code: `import { execSync as exec } from 'node:child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // Namespace import with execSync method call
  {
    code: `
      import * as cp from 'node:child_process'
      cp.execSync('ls')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },

  // Namespace import with computed property access (string literal)
  {
    code: `
      import * as cp from 'node:child_process'
      cp['execSync']('ls')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },

  // Namespace import from child_process without node: prefix
  {
    code: `
      import * as childProcess from 'child_process'
      childProcess.execSync('ls')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },

  // require() destructuring pattern
  {
    code: `const { execSync } = require('node:child_process')`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // require() destructuring pattern without node: prefix
  {
    code: `const { execSync } = require('child_process')`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // require() destructuring with multiple properties
  {
    code: `const { execSync, execFileSync } = require('node:child_process')`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  // require() namespace style with execSync call
  {
    code: `
      const cp = require('node:child_process')
      cp.execSync('ls')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },

  // require() namespace style without node: prefix
  {
    code: `
      const childProcess = require('child_process')
      childProcess.execSync('ls')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },

  // Multiple execSync usages via namespace
  {
    code: `
      import * as cp from 'node:child_process'
      cp.execSync('ls')
      cp.execSync('pwd')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },

  // require namespace with computed property access
  {
    code: `
      const cp = require('node:child_process')
      cp['execSync']('ls')
    `,
    errors: [
      {
        messageId: 'preferExecFileSyncNamespace',
      },
    ],
  },
]

ruleTester.run('prefer-exec-file-sync', rule, {
  valid: validCases,
  invalid: invalidCases,
})
