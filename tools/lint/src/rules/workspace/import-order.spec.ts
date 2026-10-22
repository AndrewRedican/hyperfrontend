import { testRule } from '../../testing/rule-tester.ts'
import rule from './import-order.ts'

testRule(rule, {
  valid: [
    {
      name: "#3 import type { Stats } from 'node:fs'",
      path: '/root/file.ts',
      text: "import type { Stats } from 'node:fs'\nimport type { Express } from 'express'\nimport type { Channel } from '@hyperfrontend/nexus'\nimport type { BaseConfig } from '../../config'\nimport type { Helper } from '../helpers'\nimport type { LocalType } from './types'\nimport { readFile } from 'node:fs'\nimport express from 'express'\nimport { createChannel } from '@hyperfrontend/nexus'\nimport { baseConfig } from '../../config'\nimport { helper } from '../helpers'\nimport { localFunc } from './local'",
    },
    {
      name: "#7 import { a } from '../alpha'",
      path: '/root/file.ts',
      text: "import { a } from '../alpha'\nimport { b } from '../beta'\nimport { c } from '../gamma'",
    },
    { name: '#8 const x = 1', path: '/root/file.ts', text: 'const x = 1' },
  ],
  invalid: [
    {
      name: "#9 import { readFile } from 'node:fs'",
      path: '/root/file.ts',
      text: "import { readFile } from 'node:fs'\nimport type { Stats } from 'node:fs'",
      errors: [
        {
          message:
            'Imports are not in the correct order. Expected order: type imports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 35,
        },
      ],
      output: "import type { Stats } from 'node:fs'\nimport { readFile } from 'node:fs'",
    },
    {
      name: "#16 import { b } from 'express'",
      path: '/root/file.ts',
      text: "import { b } from 'express'\nconst x = 1\nimport { a } from 'node:fs'",
      errors: [
        {
          message:
            'Imports are not in the correct order. Expected order: type imports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 28,
        },
      ],
      output: null,
    },
  ],
})
