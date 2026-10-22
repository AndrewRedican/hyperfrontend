import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-inline-type-literal.ts'

testRule(rule, {
  valid: [
    {
      name: '#1 type Logger = { log: (msg: string) => void }',
      path: '/root/file.ts',
      text: 'type Logger = { log: (msg: string) => void }',
    },
    { name: '#4 type IndexOnly = { [k: string]: number }', path: '/root/file.ts', text: 'type IndexOnly = { [k: string]: number }' },
    {
      name: '#5 interface Logger { log(msg: string): void }',
      path: '/root/file.ts',
      text: 'interface Logger { log(msg: string): void }',
    },
    { name: '#12 const u = <User>data', path: '/root/file.ts', text: 'const u = <User>data' },
    { name: '#13 const r = useState<Config>()', path: '/root/file.ts', text: 'const r = useState<Config>()' },
    { name: '#14 const m: Map<string, User> = new Map()', path: '/root/file.ts', text: 'const m: Map<string, User> = new Map()' },
    { name: '#15 type U = string | User', path: '/root/file.ts', text: 'type U = string | User' },
    { name: '#16 type I = Base & Mixin', path: '/root/file.ts', text: 'type I = Base & Mixin' },
    { name: '#17 const v = data satisfies User', path: '/root/file.ts', text: 'const v = data satisfies User' },
    {
      name: '#20 function f(x: { [k: string]: number }) { return x }',
      path: '/root/file.ts',
      text: 'function f(x: { [k: string]: number }) { return x }',
    },
    { name: '#23 type CallableTag = { (): void }', path: '/root/file.ts', text: 'type CallableTag = { (): void }' },
  ],
  invalid: [
    {
      name: '#24 function a({ logger, other }: { logger: Logger; other: numbe…',
      path: '/root/file.ts',
      text: 'function a({ logger, other }: { logger: Logger; other: number }) { return logger }',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 31,
          endLine: 1,
          endColumn: 64,
        },
      ],
    },
    {
      name: '#25 function f(): { etc: boolean } { return { etc: true } }',
      path: '/root/file.ts',
      text: 'function f(): { etc: boolean } { return { etc: true } }',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#27 class C { x: { a: number } = { a: 1 } }',
      path: '/root/file.ts',
      text: 'class C { x: { a: number } = { a: 1 } }',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 14,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#28 const something = <{ etc: boolean }>getSomething()',
      path: '/root/file.ts',
      text: 'const something = <{ etc: boolean }>getSomething()',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 20,
          endLine: 1,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#29 const something = getSomething() as { etc: boolean }',
      path: '/root/file.ts',
      text: 'const something = getSomething() as { etc: boolean }',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 37,
          endLine: 1,
          endColumn: 53,
        },
      ],
    },
    {
      name: '#35 function gen<T extends { a: number }>(x: T): T { return x }',
      path: '/root/file.ts',
      text: 'function gen<T extends { a: number }>(x: T): T { return x }',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 24,
          endLine: 1,
          endColumn: 37,
        },
      ],
    },
    {
      name: '#39 function tup(x: [{ a: number }, string]) { return x }',
      path: '/root/file.ts',
      text: 'function tup(x: [{ a: number }, string]) { return x }',
      errors: [
        {
          message:
            'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
          line: 1,
          column: 18,
          endLine: 1,
          endColumn: 31,
        },
      ],
    },
  ],
})
