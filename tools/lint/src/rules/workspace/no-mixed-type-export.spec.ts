import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-mixed-type-export.ts'

testRule(rule, {
  valid: [
    {
      name: "#1 export type { User, Config } from './types'",
      path: '/root/file.ts',
      text: "export type { User, Config } from './types'",
    },
    { name: '#5 export default function main() {}', path: '/root/file.ts', text: 'export default function main() {}' },
    { name: '#6 export default class App {}', path: '/root/file.ts', text: 'export default class App {}' },
    { name: "#7 export * from './utils'", path: '/root/file.ts', text: "export * from './utils'" },
    { name: '#8 export const foo = 1', path: '/root/file.ts', text: 'export const foo = 1' },
    { name: '#9 export function bar() {}', path: '/root/file.ts', text: 'export function bar() {}' },
    { name: '#10 export class Baz {}', path: '/root/file.ts', text: 'export class Baz {}' },
  ],
  invalid: [
    {
      name: "#17 export { type User, createUser } from './module'",
      path: '/root/file.ts',
      text: "export { type User, createUser } from './module'",
      errors: [
        {
          message:
            "Mixed type and value exports are not allowed. Split into separate statements:\n  export type { TypeA, TypeB } from '...'\n  export { valueA, valueB } from '...'",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 49,
        },
      ],
      output: "export type { User } from './module'\nexport { createUser } from './module'",
    },
    {
      name: "#21 export { type User as U, createUser as create } from './modu…",
      path: '/root/file.ts',
      text: "export { type User as U, createUser as create } from './module'",
      errors: [
        {
          message:
            "Mixed type and value exports are not allowed. Split into separate statements:\n  export type { TypeA, TypeB } from '...'\n  export { valueA, valueB } from '...'",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 64,
        },
      ],
      output: "export type { User as U } from './module'\nexport { createUser as create } from './module'",
    },
    {
      name: '#22 export { type User, createUser }',
      path: '/root/file.ts',
      text: 'export { type User, createUser }',
      errors: [
        {
          message:
            "Mixed type and value exports are not allowed. Split into separate statements:\n  export type { TypeA, TypeB } from '...'\n  export { valueA, valueB } from '...'",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 33,
        },
      ],
      output: 'export type { User }\nexport { createUser }',
    },
  ],
})

const MESSAGE =
  "Mixed type and value exports are not allowed. Split into separate statements:\n  export type { TypeA, TypeB } from '...'\n  export { valueA, valueB } from '...'"

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'string-named specifiers',
      path: '/w/a.ts',
      text: "export { type 'a-b' as ab, c as 'c-d' } from './m'\n",
      errors: [{ message: MESSAGE, line: 1, column: 1, endLine: 1, endColumn: 51 }],
      output: "export type { 'a-b' as ab } from './m'\nexport { c as 'c-d' } from './m'\n",
    },
  ],
})
