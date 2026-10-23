import type { Node } from '../../code/model'
import type { OrderOptions } from './shared/ordering'
import { defineRule } from '../../engine/rule'
import { testRule } from '../../testing/rule-tester'
import rule from './export-order'

/** The rule as the workspace configures it, which the recorded cases assume when they set no options of their own. */
const configured = defineRule<OrderOptions | undefined, Node>({
  ...rule,
  create: (context) => rule.create({ ...context, options: context.options ?? { internalScopes: ['@hyperfrontend'] } }),
})

testRule(configured, {
  valid: [
    {
      name: "#3 export type { Stats } from 'node:fs'",
      path: '/root/file.ts',
      text: "export type { Stats } from 'node:fs'\nexport type { Express } from 'express'\nexport type { Channel } from '@hyperfrontend/nexus'\nexport type { BaseConfig } from '../../config'\nexport type { Helper } from '../helpers'\nexport type { LocalType } from './types'\nexport { readFile } from 'node:fs'\nexport { default as express } from 'express'\nexport { createChannel } from '@hyperfrontend/nexus'\nexport { baseConfig } from '../../config'\nexport { helper } from '../helpers'\nexport { localFunc } from './local'",
    },
    {
      name: "#7 export { a } from '../alpha'",
      path: '/root/file.ts',
      text: "export { a } from '../alpha'\nexport { b } from '../beta'\nexport { c } from '../gamma'",
    },
    { name: '#8 const x = 1', path: '/root/file.ts', text: 'const x = 1' },
    { name: "#10 export type * from 'express'", path: '/root/file.ts', text: "export type * from 'express'\nexport * from 'express'" },
    { name: '#11 export const a = 1', path: '/root/file.ts', text: 'export const a = 1\nexport function b() {}\nexport class C {}' },
  ],
  invalid: [
    {
      name: "#18 export { local } from './local'",
      path: '/root/file.ts',
      text: "export { local } from './local'\nexport type { A } from 'express'\nexport { fs } from 'node:fs'\nexport { nexus } from '@hyperfrontend/nexus'",
      errors: [
        {
          message:
            'Exports are not in the correct order. Expected order: type exports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 32,
        },
      ],
      output:
        "export type { A } from 'express'\nexport { fs } from 'node:fs'\nexport { nexus } from '@hyperfrontend/nexus'\nexport { local } from './local'",
    },
    {
      name: "#20 export { b } from 'express'",
      path: '/root/file.ts',
      text: "export { b } from 'express'\nconst x = 1\nexport { a } from 'node:fs'",
      errors: [
        {
          message:
            'Exports are not in the correct order. Expected order: type exports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).',
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
      name: 'groups an internal scope after the external packages',
      path: '/root/a.ts',
      text: "export { b } from 'b'\nexport { a } from '@acme/a'\n",
      options: { internalScopes: ['@acme'] },
    },
  ],
  invalid: [
    {
      name: 'names no internal group when no scope is internal',
      path: '/root/a.ts',
      text: "export { b } from './b'\nexport { a } from 'a'\n",
      errors: [
        {
          message:
            'Exports are not in the correct order. Expected order: type exports first, then by source category (node: → external → relative by depth → current directory).',
          line: 1,
          column: 1,
        },
      ],
    },
  ],
})
