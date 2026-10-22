import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-yield.ts'

testRule(rule, {
  valid: [
    { name: '#1 function foo() { return 0; }', path: '/root/file.ts', text: 'function foo() { return 0; }' },
    { name: '#4 (function* foo() { yield 0; })();', path: '/root/file.ts', text: '(function* foo() { yield 0; })();' },
    { name: '#9 class A { *foo() { } };', path: '/root/file.ts', text: 'class A { *foo() { } };' },
    { name: '#10 a bare yield counts', path: '/root/file.ts', text: 'function* foo() { yield }' },
    {
      name: '#13 a yield nested in a loop counts',
      path: '/root/file.ts',
      text: 'function* foo() { for (const x of xs) { if (x) { yield x } } }',
    },
    {
      name: '#14 a yield inside an arrow function counts for the enclosing generator',
      path: '/root/file.ts',
      text: 'function* foo() { const f = () => { yield 0 } }',
    },
    { name: '#17 a static generator method that yields', path: '/root/file.ts', text: 'class A { static *foo() { yield 1 } }' },
    {
      name: '#20 an abstract generator method has no body',
      path: '/root/file.ts',
      text: 'abstract class A { abstract *foo(): Generator<number> }',
    },
  ],
  invalid: [
    {
      name: '#23 var obj = { *foo() { return 0; } }',
      path: '/root/file.ts',
      text: 'var obj = { *foo() { return 0; } }',
      errors: [{ message: "This generator function does not have 'yield'.", line: 1, column: 17, endLine: 1, endColumn: 33 }],
    },
    {
      name: '#28 a generator function expression is reported at its keyword',
      path: '/root/file.ts',
      text: 'const foo = function* () { return 0 }',
      errors: [{ message: "This generator function does not have 'yield'.", line: 1, column: 13, endLine: 1, endColumn: 38 }],
    },
    {
      name: '#29 a generator method with a computed key',
      path: '/root/file.ts',
      text: 'class A { *[Symbol.iterator]() { return [] } }',
      errors: [{ message: "This generator function does not have 'yield'.", line: 1, column: 29, endLine: 1, endColumn: 45 }],
    },
    {
      name: '#30 an async generator that only awaits',
      path: '/root/file.ts',
      text: 'async function* foo() { await bar() }',
      errors: [{ message: "This generator function does not have 'yield'.", line: 1, column: 1, endLine: 1, endColumn: 38 }],
    },
    {
      name: '#32 two sibling generators without yields are both reported',
      path: '/root/file.ts',
      text: 'function* foo() { return 0 }\nfunction* bar() { return 1 }',
      errors: [
        { message: "This generator function does not have 'yield'.", line: 1, column: 1, endLine: 1, endColumn: 29 },
        { message: "This generator function does not have 'yield'.", line: 2, column: 1, endLine: 2, endColumn: 29 },
      ],
    },
  ],
})
