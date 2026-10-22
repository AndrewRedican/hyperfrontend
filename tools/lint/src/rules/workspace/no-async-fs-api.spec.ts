import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-async-fs-api.ts'

testRule(rule, {
  valid: [
    { name: "#1 import { readFileSync } from 'node:fs'", path: '/root/file.ts', text: "import { readFileSync } from 'node:fs'" },
    { name: "#19 import type { Stats } from 'node:fs'", path: '/root/file.ts', text: "import type { Stats } from 'node:fs'" },
    { name: "#23 import express from 'express'", path: '/root/file.ts', text: "import express from 'express'" },
    {
      name: "#26 import * as fs from 'node:fs'",
      path: '/root/file.ts',
      text: "\n      import * as fs from 'node:fs'\n      const data = fs.readFileSync('./file.txt', 'utf-8')\n    ",
    },
    {
      name: "#28 import * as fs from 'node:fs'",
      path: '/root/file.ts',
      text: "\n      import * as fs from 'node:fs'\n      const method = 'readFileSync'\n      const data = fs[method]('./file.txt', 'utf-8')\n    ",
    },
    {
      name: "#29 function getFs() { return require('node:fs') }",
      path: '/root/file.ts',
      text: "\n      function getFs() { return require('node:fs') }\n      getFs().readFile('./file.txt', () => {})\n    ",
    },
    {
      name: "#30 const modules = { fs: require('node:fs') }",
      path: '/root/file.ts',
      text: "\n      const modules = { fs: require('node:fs') }\n      modules.fs.readFile('./file.txt', () => {})\n    ",
    },
  ],
  invalid: [
    {
      name: "#32 import { readFile } from 'node:fs/promises'",
      path: '/root/file.ts',
      text: "import { readFile } from 'node:fs/promises'",
      errors: [
        {
          message: "Avoid importing from 'node:fs/promises'. Use synchronous fs methods from 'node:fs' instead.",
          line: 1,
          column: 26,
          endLine: 1,
          endColumn: 44,
        },
      ],
    },
    {
      name: "#55 import { open, close } from 'node:fs'",
      path: '/root/file.ts',
      text: "import { open, close } from 'node:fs'",
      errors: [
        {
          message: "Avoid using async fs method 'open'. Use 'openSync' instead for synchronous file operations.",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 14,
        },
        {
          message: "Avoid using async fs method 'close'. Use 'closeSync' instead for synchronous file operations.",
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 21,
        },
      ],
    },
    {
      name: "#64 const { readFile } = require('fs/promises')",
      path: '/root/file.ts',
      text: "const { readFile } = require('fs/promises')",
      errors: [
        {
          message: "Avoid importing from 'fs/promises'. Use synchronous fs methods from 'node:fs' instead.",
          line: 1,
          column: 22,
          endLine: 1,
          endColumn: 44,
        },
      ],
    },
    {
      name: "#65 import * as fs from 'node:fs'",
      path: '/root/file.ts',
      text: "\n      import * as fs from 'node:fs'\n      fs['readFile']('./file.txt', 'utf-8', () => {})\n    ",
      errors: [
        {
          message: "Avoid using async fs methods via namespace. Use synchronous method 'readFileSync' instead of 'readFile'.",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 21,
        },
      ],
    },
    {
      name: '#66 import { "readFile" as rf } from \'node:fs\'',
      path: '/root/file.ts',
      text: 'import { "readFile" as rf } from \'node:fs\'',
      errors: [
        {
          message: "Avoid using async fs method 'readFile'. Use 'readFileSync' instead for synchronous file operations.",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 26,
        },
      ],
    },
  ],
})
