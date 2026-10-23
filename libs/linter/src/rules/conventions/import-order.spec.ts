import type { Node } from '../../code/model'
import type { OrderOptions } from './shared/ordering'
import { defineRule } from '../../engine/rule'
import { testRule } from '../../testing/rule-tester'
import rule from './import-order'

/** The rule as the workspace configures it, which the recorded cases assume when they set no options of their own. */
const configured = defineRule<OrderOptions | undefined, Node>({
  ...rule,
  create: (context) => rule.create({ ...context, options: context.options ?? { internalScopes: ['@hyperfrontend'] } }),
})

testRule(configured, {
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

testRule(rule, {
  valid: [
    {
      name: 'sorts a scoped package among the external ones when no scope is internal',
      path: '/root/a.ts',
      text: "import { a } from '@acme/a'\nimport { b } from 'b'\n",
    },
    {
      name: 'groups an internal scope after the external packages',
      path: '/root/a.ts',
      text: "import { b } from 'b'\nimport { a } from '@acme/a'\n",
      options: { internalScopes: ['@acme'] },
    },
  ],
  invalid: [
    {
      name: 'names no internal group when no scope is internal',
      path: '/root/a.ts',
      text: "import { b } from './b'\nimport { a } from 'a'\n",
      errors: [
        {
          message:
            'Imports are not in the correct order. Expected order: type imports first, then by source category (node: → external → relative by depth → current directory).',
          line: 1,
          column: 1,
        },
      ],
    },
  ],
})
