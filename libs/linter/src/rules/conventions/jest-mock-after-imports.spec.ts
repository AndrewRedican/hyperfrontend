import { testRule } from '../../testing/rule-tester'
import rule from './jest-mock-after-imports'

testRule(rule, {
  valid: [
    { name: "#3 jest.mock('./a')", path: '/root/file.ts', text: "jest.mock('./a')" },
    {
      name: "#5 import { a } from './a'",
      path: '/root/file.ts',
      text: "import { a } from './a'\n'use strict'\nfoo\nbar()\nnotjest.mock('./x')\nobj.nested.mock('./x')\nmakeJest().mock('./x')\njest['mock']('./x')\njest.fn()",
    },
  ],
  invalid: [
    {
      name: "#7 jest.mock('./warn-handler', () => ({}))",
      path: '/root/file.ts',
      text: "jest.mock('./warn-handler', () => ({}))\njest.mock('@rollup/plugin-json', () => jest.fn())\nimport type { Foo } from './models'\nimport { bar } from './config'",
      errors: [
        { message: 'jest.mock() must be placed after all import statements.', line: 1, column: 1, endLine: 1, endColumn: 40 },
        { message: 'jest.mock() must be placed after all import statements.', line: 2, column: 1, endLine: 2, endColumn: 50 },
      ],
      output:
        "import type { Foo } from './models'\nimport { bar } from './config'\njest.mock('./warn-handler', () => ({}))\njest.mock('@rollup/plugin-json', () => jest.fn())",
    },
    {
      name: "#9 jest.unmock('./a')",
      path: '/root/file.ts',
      text: "jest.unmock('./a')\nimport { a } from './a'",
      errors: [{ message: 'jest.unmock() must be placed after all import statements.', line: 1, column: 1, endLine: 1, endColumn: 19 }],
      output: "import { a } from './a'\njest.unmock('./a')",
    },
    {
      name: "#10 jest.mock('./a')",
      path: '/root/file.ts',
      text: "jest.mock('./a')\nconst x = 1\nimport { a } from './a'",
      errors: [{ message: 'jest.mock() must be placed after all import statements.', line: 1, column: 1, endLine: 1, endColumn: 17 }],
      output: null,
    },
  ],
})

testRule(rule, {
  valid: [
    { name: 'a call on a computed jest member', path: '/w/a.spec.ts', text: "jest['mock']('./a')\nimport { a } from './a'\n" },
    { name: 'a call on another object', path: '/w/a.spec.ts', text: "other.mock('./a')\nimport { a } from './a'\n" },
    { name: 'a jest method that registers nothing', path: '/w/a.spec.ts', text: "jest.fn()\nimport { a } from './a'\n" },
    { name: 'a statement that is no call', path: '/w/a.spec.ts', text: "jest.mock\nimport { a } from './a'\n" },
    { name: 'a call whose callee is no member', path: '/w/a.spec.ts', text: "mock('./a')\nimport { a } from './a'\n" },
  ],
  invalid: [],
})
