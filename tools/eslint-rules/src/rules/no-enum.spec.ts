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
  // Frozen const objects (the recommended pattern)
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
  // Regular const objects
  {
    code: `
      const Colors = {
        Red: 'red',
        Blue: 'blue',
        Green: 'green',
      }
    `,
  },
  // Type aliases (not enums)
  {
    code: `type Status = 'active' | 'inactive'`,
  },
  // Union types
  {
    code: `type Direction = 'up' | 'down' | 'left' | 'right'`,
  },
  // Interface (not enum)
  {
    code: `
      interface Config {
        status: string
        enabled: boolean
      }
    `,
  },
  // Class (not enum)
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
  // String enum
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
  // Numeric enum
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
  // Numeric enum with explicit values
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
  // Const enum
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
  // Exported enum
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
  // Single-member enum
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
  // Empty enum
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
  // Declare enum (ambient)
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
