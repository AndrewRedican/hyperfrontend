import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-node-protocol.ts'

testRule(rule, {
  valid: [
    { name: "#4 import * as crypto from 'node:crypto'", path: '/root/file.ts', text: "import * as crypto from 'node:crypto'" },
    { name: "#9 import express from 'express'", path: '/root/file.ts', text: "import express from 'express'" },
  ],
  invalid: [
    {
      name: "#21 import type { Stats } from 'fs'",
      path: '/root/file.ts',
      text: "import type { Stats } from 'fs'",
      errors: [
        {
          message:
            "Import from 'fs' must use 'node:fs' prefix. Node.js built-in modules require the node: protocol for clarity and to avoid npm package name collisions.",
          line: 1,
          column: 28,
          endLine: 1,
          endColumn: 32,
        },
      ],
      output: "import type { Stats } from 'node:fs'",
    },
  ],
})
