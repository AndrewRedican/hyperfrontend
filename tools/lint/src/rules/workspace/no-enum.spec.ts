import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-enum.ts'

testRule(rule, {
  valid: [
    {
      name: '#1 const Status = freeze(<const>{',
      path: '/root/file.ts',
      text: "\n      const Status = freeze(<const>{\n        Active: 'active',\n        Inactive: 'inactive',\n      })\n    ",
    },
    {
      name: '#2 const Direction = freeze(<const>{',
      path: '/root/file.ts',
      text: '\n      const Direction = freeze(<const>{\n        Up: 0,\n        Down: 1,\n        Left: 2,\n        Right: 3,\n      })\n    ',
    },
    { name: "#4 type Status = 'active' | 'inactive'", path: '/root/file.ts', text: "type Status = 'active' | 'inactive'" },
    {
      name: '#6 interface Config {',
      path: '/root/file.ts',
      text: '\n      interface Config {\n        status: string\n        enabled: boolean\n      }\n    ',
    },
    {
      name: '#7 class MyClass {',
      path: '/root/file.ts',
      text: "\n      class MyClass {\n        static readonly Active = 'active'\n        static readonly Inactive = 'inactive'\n      }\n    ",
    },
  ],
  invalid: [
    {
      name: '#8 enum Status {',
      path: '/root/file.ts',
      text: "\n      enum Status {\n        Active = 'active',\n        Inactive = 'inactive',\n      }\n    ",
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const Status = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 5,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#9 enum Direction {',
      path: '/root/file.ts',
      text: '\n      enum Direction {\n        Up,\n        Down,\n        Left,\n        Right,\n      }\n    ',
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const Direction = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 7,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#10 enum Priority {',
      path: '/root/file.ts',
      text: '\n      enum Priority {\n        Low = 1,\n        Medium = 2,\n        High = 3,\n      }\n    ',
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const Priority = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 6,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#11 const enum HttpStatus {',
      path: '/root/file.ts',
      text: '\n      const enum HttpStatus {\n        OK = 200,\n        NotFound = 404,\n        InternalServerError = 500,\n      }\n    ',
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const HttpStatus = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 6,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#12 export enum Color {',
      path: '/root/file.ts',
      text: "\n      export enum Color {\n        Red = 'red',\n        Blue = 'blue',\n        Green = 'green',\n      }\n    ",
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const Color = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 14,
          endLine: 6,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#13 enum SingleValue {',
      path: '/root/file.ts',
      text: "\n      enum SingleValue {\n        Only = 'only',\n      }\n    ",
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const SingleValue = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 4,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#14 enum Empty {}',
      path: '/root/file.ts',
      text: '\n      enum Empty {}\n    ',
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const Empty = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 2,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#15 declare enum DeclaredEnum {',
      path: '/root/file.ts',
      text: '\n      declare enum DeclaredEnum {\n        A,\n        B,\n      }\n    ',
      errors: [
        {
          message:
            "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const DeclaredEnum = freeze(<const>{ Key: 'value' })",
          line: 2,
          column: 7,
          endLine: 5,
          endColumn: 8,
        },
      ],
    },
  ],
})
