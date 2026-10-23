import { testRule } from '../../testing/rule-tester'
import rule from './prefer-exec-file-sync'

testRule(rule, {
  valid: [
    {
      name: "#3 import { execFileSync, spawnSync } from 'node:child_process'",
      path: '/root/file.ts',
      text: "import { execFileSync, spawnSync } from 'node:child_process'",
    },
    {
      name: "#9 import type { ChildProcess } from 'node:child_process'",
      path: '/root/file.ts',
      text: "import type { ChildProcess } from 'node:child_process'",
    },
    { name: "#13 import express from 'express'", path: '/root/file.ts', text: "import express from 'express'" },
    {
      name: "#17 import * as cp from 'node:child_process'",
      path: '/root/file.ts',
      text: "\n      import * as cp from 'node:child_process'\n      const result = cp['execFileSync']('ls', ['-la'])\n    ",
    },
    {
      name: "#19 function getCp() { return require('node:child_process') }",
      path: '/root/file.ts',
      text: "\n      function getCp() { return require('node:child_process') }\n      getCp().execSync('ls')\n    ",
    },
    {
      name: "#20 const modules = { cp: require('node:child_process') }",
      path: '/root/file.ts',
      text: "\n      const modules = { cp: require('node:child_process') }\n      modules.cp.execSync('ls')\n    ",
    },
  ],
  invalid: [
    {
      name: "#27 import { execSync as exec } from 'node:child_process'",
      path: '/root/file.ts',
      text: "import { execSync as exec } from 'node:child_process'",
      errors: [
        {
          message:
            "Avoid using 'execSync'. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 26,
        },
      ],
    },
    {
      name: "#33 const { execSync, execFileSync } = require('node:child_proce…",
      path: '/root/file.ts',
      text: "const { execSync, execFileSync } = require('node:child_process')",
      errors: [
        {
          message:
            "Avoid using 'execSync'. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
          line: 1,
          column: 9,
          endLine: 1,
          endColumn: 17,
        },
      ],
    },
    {
      name: "#34 const cp = require('node:child_process')",
      path: '/root/file.ts',
      text: "\n      const cp = require('node:child_process')\n      cp.execSync('ls')\n    ",
      errors: [
        {
          message:
            "Avoid using 'execSync' via namespace access. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 18,
        },
      ],
    },
    {
      name: "#36 import * as cp from 'node:child_process'",
      path: '/root/file.ts',
      text: "\n      import * as cp from 'node:child_process'\n      cp.execSync('ls')\n      cp.execSync('pwd')\n    ",
      errors: [
        {
          message:
            "Avoid using 'execSync' via namespace access. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 18,
        },
        {
          message:
            "Avoid using 'execSync' via namespace access. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
          line: 4,
          column: 7,
          endLine: 4,
          endColumn: 18,
        },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter leave string-named imports and array patterns unexercised.
testRule(rule, {
  valid: [
    {
      name: 'a required module read through an array pattern',
      path: '/root/file.ts',
      text: "const [first] = require('node:child_process')",
    },
  ],
  invalid: [
    {
      name: 'a string-named import',
      path: '/root/file.ts',
      text: "import { 'execSync' as run } from 'node:child_process'",
      errors: [
        {
          message:
            "Avoid using 'execSync'. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
  ],
})
