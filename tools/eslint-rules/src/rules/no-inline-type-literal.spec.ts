import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-inline-type-literal'

type TestOptions = readonly []
type MessageIds = 'noInlineTypeLiteral'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - code that does not use inline type literals at use sites.
 */
const validCases: ValidTestCase<TestOptions>[] = [
  { code: `type Logger = { log: (msg: string) => void }` },
  { code: `type Empty = {}` },
  { code: `type WithMethod = { greet(): void }` },
  { code: `type IndexOnly = { [k: string]: number }` },

  { code: `interface Logger { log(msg: string): void }` },
  { code: `interface Empty {}` },
  { code: `interface WithIndex { [k: string]: number }` },

  { code: `function f({ a }: Props) { return a }` },
  { code: `function g(): Result { return getResult() }` },
  { code: `const x: User = getUser()` },
  { code: `class C { x: User = getUser() }` },
  { code: `const u = <User>data` },
  { code: `const r = useState<Config>()` },
  { code: `const m: Map<string, User> = new Map()` },
  { code: `type U = string | User` },
  { code: `type I = Base & Mixin` },
  { code: `const v = data satisfies User` },
  { code: `function gen<T extends User>(x: T): T { return x }` },

  { code: `function f(x: {}) { return x }` },
  { code: `function f(x: { [k: string]: number }) { return x }` },
  { code: `const x: {} = {}` },
  { code: `const r = <{}>data` },

  { code: `type CallableTag = { (): void }` },
]

/**
 * Invalid test cases - inline type literals at use sites.
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `function a({ logger, other }: { logger: Logger; other: number }) { return logger }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `function f(): { etc: boolean } { return { etc: true } }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `const x: { a: number } = { a: 1 }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `class C { x: { a: number } = { a: 1 } }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `const something = <{ etc: boolean }>getSomething()`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `const something = getSomething() as { etc: boolean }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `const r = useState<{ a: number }>()`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `const m: Map<string, { a: number }> = new Map()`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `type U = string | { a: number }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `type I = Base & { a: number }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `const v = data satisfies { a: number }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `function gen<T extends { a: number }>(x: T): T { return x }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `function f(x: { greet(): void }) { return x }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `type Foo = { inner: { a: number } }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `interface Foo { inner: { a: number } }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
  {
    code: `function tup(x: [{ a: number }, string]) { return x }`,
    errors: [{ messageId: 'noInlineTypeLiteral' }],
  },
]

ruleTester.run('no-inline-type-literal', rule, {
  valid: validCases,
  invalid: invalidCases,
})
