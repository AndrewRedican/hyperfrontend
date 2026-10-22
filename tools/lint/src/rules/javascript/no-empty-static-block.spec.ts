import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-empty-static-block.ts'

testRule(rule, {
  valid: [
    { name: '#2 class Foo { static { /* comments */ } }', path: '/root/file.ts', text: 'class Foo { static { /* comments */ } }' },
    { name: '#5 a static block holding only an empty statement', path: '/root/file.ts', text: 'class Foo { static { ; } }' },
    {
      name: '#6 a static block of a class expression holding a call',
      path: '/root/file.ts',
      text: 'const Foo = class { static { bar() } }',
    },
    { name: '#7 a static property is not a static block', path: '/root/file.ts', text: 'class Foo { static x = 1 }' },
    { name: '#8 a static method with an empty body is not a static block', path: '/root/file.ts', text: 'class Foo { static m() {} }' },
  ],
  invalid: [
    {
      name: '#12 class Foo { static { ',
      path: '/root/file.ts',
      text: 'class Foo { static { \n\n } }',
      errors: [{ message: 'Unexpected empty static block.', line: 1, column: 20, endLine: 3, endColumn: 3 }],
    },
    {
      name: '#13 class Foo { static { bar(); } static {} }',
      path: '/root/file.ts',
      text: 'class Foo { static { bar(); } static {} }',
      errors: [{ message: 'Unexpected empty static block.', line: 1, column: 38, endLine: 1, endColumn: 40 }],
    },
    {
      name: '#16 two empty static blocks in one class report each',
      path: '/root/file.ts',
      text: 'class Foo { static {} static {} }',
      errors: [
        { message: 'Unexpected empty static block.', line: 1, column: 20, endLine: 1, endColumn: 22 },
        { message: 'Unexpected empty static block.', line: 1, column: 30, endLine: 1, endColumn: 32 },
      ],
    },
    {
      name: '#18 an empty static block in a nested class',
      path: '/root/file.ts',
      text: 'class A { m() { class B { static {} } } }',
      errors: [{ message: 'Unexpected empty static block.', line: 1, column: 34, endLine: 1, endColumn: 36 }],
    },
    {
      name: '#19 a comment after the block is not inside it',
      path: '/root/file.ts',
      text: 'class Foo { static {} // c\n}',
      errors: [{ message: 'Unexpected empty static block.', line: 1, column: 20, endLine: 1, endColumn: 22 }],
    },
  ],
})
