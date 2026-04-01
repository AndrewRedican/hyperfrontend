import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-enum'

type TestOptions = readonly []
type MessageIds = 'noEnum'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - code that does not use enum keyword
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    code: `
      const Status = freeze(<const>{
        Active: 'active',
        Inactive: 'inactive',
      })
    `,
  },
  {
    code: `
      const Direction = freeze(<const>{
        Up: 0,
        Down: 1,
        Left: 2,
        Right: 3,
      })
    `,
  },
  {
    code: `
      const Colors = {
        Red: 'red',
        Blue: 'blue',
        Green: 'green',
      }
    `,
  },
  {
    code: `type Status = 'active' | 'inactive'`,
  },
  {
    code: `type Direction = 'up' | 'down' | 'left' | 'right'`,
  },
  {
    code: `
      interface Config {
        status: string
        enabled: boolean
      }
    `,
  },
  {
    code: `
      class MyClass {
        static readonly Active = 'active'
        static readonly Inactive = 'inactive'
      }
    `,
  },
]

/**
 * Invalid test cases - code that uses enum keyword
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `
      enum Status {
        Active = 'active',
        Inactive = 'inactive',
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'Status' },
      },
    ],
  },
  {
    code: `
      enum Direction {
        Up,
        Down,
        Left,
        Right,
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'Direction' },
      },
    ],
  },
  {
    code: `
      enum Priority {
        Low = 1,
        Medium = 2,
        High = 3,
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'Priority' },
      },
    ],
  },
  {
    code: `
      const enum HttpStatus {
        OK = 200,
        NotFound = 404,
        InternalServerError = 500,
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'HttpStatus' },
      },
    ],
  },
  {
    code: `
      export enum Color {
        Red = 'red',
        Blue = 'blue',
        Green = 'green',
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'Color' },
      },
    ],
  },
  {
    code: `
      enum SingleValue {
        Only = 'only',
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'SingleValue' },
      },
    ],
  },
  {
    code: `
      enum Empty {}
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'Empty' },
      },
    ],
  },
  {
    code: `
      declare enum DeclaredEnum {
        A,
        B,
      }
    `,
    errors: [
      {
        messageId: 'noEnum',
        data: { name: 'DeclaredEnum' },
      },
    ],
  },
]

ruleTester.run('no-enum', rule, {
  valid: validCases,
  invalid: invalidCases,
})
