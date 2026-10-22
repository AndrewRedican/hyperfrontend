import { testRule } from '../../testing/rule-tester.ts'
import rule from './valid-typeof.ts'

// why: the workspace runs the rule with `requireStringLiterals` off; the cases with it on are left out.
// why: a case that turns `undefined` off as a global is left out, as this linter keeps the language's globals declared.
testRule(rule, {
  valid: [
    { name: "#1 typeof foo === 'string'", path: '/root/file.ts', text: "typeof foo === 'string'" },
    { name: "#25 var oddUse = typeof foo + 'thing'", path: '/root/file.ts', text: "var oddUse = typeof foo + 'thing'" },
    {
      name: '#26 function f(undefined) { typeof x === undefined }',
      path: '/root/file.ts',
      text: 'function f(undefined) { typeof x === undefined }',
    },
    { name: '#33 typeof foo === `str${somethingElse}`', path: '/root/file.ts', text: 'typeof foo === `str${somethingElse}`' },
    { name: '#36 a relational operator is not a type comparison', path: '/root/file.ts', text: "typeof foo < 'x'" },
    {
      name: '#37 a typeof nested in a comparison operand is not compared directly',
      path: '/root/file.ts',
      text: "(typeof foo + '') === 'strnig'",
    },
    {
      name: '#39 a shadowed undefined passes without the option',
      path: '/root/file.ts',
      text: 'const undefined = 1; typeof foo === undefined',
    },
    { name: '#41 a type-asserted literal is not a literal node', path: '/root/file.ts', text: "typeof foo === ('string' as const)" },
  ],
  invalid: [
    {
      name: '#57 if (typeof bar === `umdefined`) {}',
      path: '/root/file.ts',
      text: 'if (typeof bar === `umdefined`) {}',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 20, endLine: 1, endColumn: 31 }],
    },
    {
      name: '#59 if (typeof bar !== undefined) {}',
      path: '/root/file.ts',
      text: 'if (typeof bar !== undefined) {}',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 20, endLine: 1, endColumn: 29 }],
    },
    {
      name: '#69 a null literal is an invalid value',
      path: '/root/file.ts',
      text: 'typeof foo === null',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 16, endLine: 1, endColumn: 20 }],
    },
    {
      name: '#70 a regular expression literal is an invalid value',
      path: '/root/file.ts',
      text: 'typeof foo == /re/',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 15, endLine: 1, endColumn: 19 }],
    },
    {
      name: '#71 a boolean literal is an invalid value',
      path: '/root/file.ts',
      text: 'typeof foo !== true',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 16, endLine: 1, endColumn: 20 }],
    },
    {
      name: '#72 a bigint literal is an invalid value',
      path: '/root/file.ts',
      text: 'typeof foo === 1n',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 16, endLine: 1, endColumn: 18 }],
    },
    {
      name: '#75 the global undefined on the left is reported with its suggestion',
      path: '/root/file.ts',
      text: 'undefined !== typeof foo',
      errors: [{ message: 'Invalid typeof comparison value.', line: 1, column: 1, endLine: 1, endColumn: 10 }],
    },
    {
      name: '#82 each typeof of a chain is checked on its own',
      path: '/root/file.ts',
      text: "typeof a === 'strnig' || typeof b === 'object' || typeof c == 'umdefined'",
      errors: [
        { message: 'Invalid typeof comparison value.', line: 1, column: 14, endLine: 1, endColumn: 22 },
        { message: 'Invalid typeof comparison value.', line: 1, column: 63, endLine: 1, endColumn: 74 },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter compare nothing but `typeof` operands; another unary operator is covered here.
testRule(rule, {
  valid: [{ name: 'a negation compared with a string', path: '/root/file.ts', text: "-x === 'number'" }],
  invalid: [],
})
