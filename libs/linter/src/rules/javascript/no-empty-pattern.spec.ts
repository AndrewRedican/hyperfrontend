import { testRule } from '../../testing/rule-tester'
import rule from './no-empty-pattern'

// why: the workspace runs the rule with its default options; the cases allowing object patterns as parameters are left out.
testRule(rule, {
  valid: [
    { name: '#3 var {a = []} = foo;', path: '/root/file.ts', text: 'var {a = []} = foo;' },
    { name: '#6 var [a] = foo', path: '/root/file.ts', text: 'var [a] = foo' },
    { name: '#16 a rest property keeps the pattern non-empty', path: '/root/file.ts', text: 'var {...rest} = foo' },
    { name: '#17 an empty object literal argument is not a pattern', path: '/root/file.ts', text: 'foo({})' },
    { name: '#19 an empty object literal as a default value', path: '/root/file.ts', text: 'function foo(a = {}) {}' },
  ],
  invalid: [
    {
      name: '#29 function foo({a: []}) {}',
      path: '/root/file.ts',
      text: 'function foo({a: []}) {}',
      errors: [{ message: 'Unexpected empty array pattern.', line: 1, column: 18, endLine: 1, endColumn: 20 }],
    },
    {
      name: '#31 var foo = function({}) {}',
      path: '/root/file.ts',
      text: 'var foo = function({}) {}',
      options: {},
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 20, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#32 var foo = ({}) => {}',
      path: '/root/file.ts',
      text: 'var foo = ({}) => {}',
      options: {},
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 12, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#46 an empty pattern in a for-of head',
      path: '/root/file.ts',
      text: 'for (const {} of xs) {}',
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 12, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#47 an assignment expression target',
      path: '/root/file.ts',
      text: '({} = foo)',
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 2, endLine: 1, endColumn: 4 }],
    },
    {
      name: '#48 an array assignment target',
      path: '/root/file.ts',
      text: '[] = foo',
      errors: [{ message: 'Unexpected empty array pattern.', line: 1, column: 1, endLine: 1, endColumn: 3 }],
    },
    {
      name: '#49 nested empty patterns of both kinds are each reported',
      path: '/root/file.ts',
      text: 'var {a: {}, b: []} = foo',
      errors: [
        { message: 'Unexpected empty object pattern.', line: 1, column: 9, endLine: 1, endColumn: 11 },
        { message: 'Unexpected empty array pattern.', line: 1, column: 16, endLine: 1, endColumn: 18 },
      ],
    },
    {
      name: '#50 a pattern spanning lines',
      path: '/root/file.ts',
      text: 'const {\n} = foo',
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 7, endLine: 2, endColumn: 2 }],
    },
    {
      name: '#51 a typed empty parameter without the option is reported with its annotation',
      path: '/root/file.ts',
      text: 'function foo({}: Props) {}',
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 14, endLine: 1, endColumn: 23 }],
    },
    {
      name: '#52 a method parameter without the option',
      path: '/root/file.ts',
      text: 'class A { m({}) {} }',
      errors: [{ message: 'Unexpected empty object pattern.', line: 1, column: 13, endLine: 1, endColumn: 15 }],
    },
  ],
})
