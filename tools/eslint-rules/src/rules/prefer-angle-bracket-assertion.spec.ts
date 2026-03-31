import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './prefer-angle-bracket-assertion'

type TestOptions = readonly []
type MessageIds = 'preferAngleBracket'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - angle bracket assertions
 */
const validCases: ValidTestCase<TestOptions>[] = [
  { code: `const user = <User>data` },
  { code: `const config = <Readonly<Config>>{}` },
  { code: `const value = <number>(<unknown>something)` },

  { code: `const arr = <Array<string>>[]` },
  { code: `const map = <Map<string, number>>new Map()` },
  { code: `const obj = <Record<string, unknown>>{}` },

  { code: `const val = <number><unknown>str` },
  { code: `const result = <Result<T>><unknown>response` },

  { code: `const x: number = 42` },
  { code: `const user: User = { name: 'John' }` },
  { code: `function fn(x: number): string { return String(x) }` },

  { code: `const result = parse<Config>(data)` },
  { code: `const items = getItems<Item[]>()` },

  { code: `const x = 42` },
  { code: `const str = 'hello'` },
]

/**
 * Invalid test cases - 'as' keyword assertions
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `const user = data as User`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'User' },
      },
    ],
  },
  {
    code: `const config = {} as Readonly<Config>`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'Readonly<Config>' },
      },
    ],
  },
  {
    code: `const value = something as unknown as number`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'number' },
      },
      {
        messageId: 'preferAngleBracket',
        data: { type: 'unknown' },
      },
    ],
  },
  {
    code: `const arr = [] as Array<string>`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'Array<string>' },
      },
    ],
  },
  {
    code: `const obj = {} as Record<string, unknown>`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'Record<string, unknown>' },
      },
    ],
  },
  {
    code: `const result = response as Result<T>`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'Result<T>' },
      },
    ],
  },
  {
    code: `const num = str as any`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'any' },
      },
    ],
  },
  {
    code: `const data = input as const`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'const' },
      },
    ],
  },
  {
    code: `function fn() { return value as string }`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'string' },
      },
    ],
  },
  {
    code: `const items = getItems() as Item[]`,
    errors: [
      {
        messageId: 'preferAngleBracket',
        data: { type: 'Item[]' },
      },
    ],
  },
]

ruleTester.run('prefer-angle-bracket-assertion', rule, {
  valid: validCases,
  invalid: invalidCases,
})
