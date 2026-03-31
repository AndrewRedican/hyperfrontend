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
  { code: `import { execFileSync } from 'node:child_process'` },
  { code: `import { execFileSync } from 'child_process'` },
  { code: `import { execFileSync, spawnSync } from 'node:child_process'` },

  { code: `import { spawn } from 'node:child_process'` },
  { code: `import { spawnSync } from 'node:child_process'` },
  { code: `import { fork } from 'node:child_process'` },
  { code: `import { exec } from 'node:child_process'` },
  { code: `import { execFile } from 'node:child_process'` },

  { code: `import type { ChildProcess } from 'node:child_process'` },
  { code: `import type { ExecSyncOptions } from 'node:child_process'` },

  { code: `import { readFileSync } from 'node:fs'` },
  { code: `import { join } from 'node:path'` },
  { code: `import express from 'express'` },

  { code: `import { helper } from './helper'` },

  { code: `import { createChannel } from '@hyperfrontend/nexus'` },

  {
    code: `
      import * as cp from 'node:child_process'
      const result = cp.execFileSync('ls', ['-la'])
    `,
  },

  {
    code: `
      import * as cp from 'node:child_process'
      const result = cp['execFileSync']('ls', ['-la'])
    `,
  },

  {
    code: `
      import * as cp from 'node:child_process'
      const method = 'execFileSync'
      const result = cp[method]('ls', ['-la'])
    `,
  },

  {
    code: `
      function getCp() { return require('node:child_process') }
      getCp().execSync('ls')
    `,
  },

  {
    code: `
      const modules = { cp: require('node:child_process') }
      modules.cp.execSync('ls')
    `,
  },

  {
    code: `
      const fs = require('node:fs')
      fs.readFileSync('./file.txt')
    `,
  },

  {
    code: `
      const { execFileSync } = require('node:child_process')
      execFileSync('ls', ['-la'])
    `,
  },

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
  {
    code: `import { execSync } from 'node:child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  {
    code: `import { execSync } from 'child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  {
    code: `import { execSync, execFileSync } from 'node:child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  {
    code: `import { execSync as exec } from 'node:child_process'`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

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

  {
    code: `const { execSync } = require('node:child_process')`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  {
    code: `const { execSync } = require('child_process')`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

  {
    code: `const { execSync, execFileSync } = require('node:child_process')`,
    errors: [
      {
        messageId: 'preferExecFileSync',
      },
    ],
  },

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
