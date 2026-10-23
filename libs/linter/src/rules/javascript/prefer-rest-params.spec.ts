import { testRule } from '../../testing/rule-tester'
import rule from './prefer-rest-params'

testRule(rule, {
  valid: [
    {
      name: '#3 function foo() { var arguments; arguments; }',
      path: '/root/file.ts',
      text: 'function foo() { var arguments; arguments; }',
    },
    { name: '#5 function foo(...args) { args; }', path: '/root/file.ts', text: 'function foo(...args) { args; }' },
    { name: '#8 a function that never mentions arguments', path: '/root/file.ts', text: 'function foo(a, b) { return a + b; }' },
    { name: '#9 an optional member access on arguments', path: '/root/file.ts', text: 'function foo() { arguments?.length; }' },
    { name: '#11 a parameter named arguments of a method', path: '/root/file.ts', text: 'class C { m(arguments) { arguments[0]; } }' },
    {
      name: '#12 a let declaration named arguments',
      path: '/root/file.ts',
      text: 'function foo() { let arguments = []; arguments[0]; }',
    },
    {
      name: '#13 a function declaration named arguments',
      path: '/root/file.ts',
      text: 'function foo() { function arguments() {} arguments(); }',
    },
    {
      name: '#14 an arrow function at the top level reads the global arguments',
      path: '/root/file.ts',
      text: 'const foo = () => arguments[0];',
    },
  ],
  invalid: [
    {
      name: '#18 function foo() { arguments[Symbol.iterator]; }',
      path: '/root/file.ts',
      text: 'function foo() { arguments[Symbol.iterator]; }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 18, endLine: 1, endColumn: 27 }],
    },
    {
      name: '#20 an arrow function reads the arguments of its enclosing function',
      path: '/root/file.ts',
      text: 'function foo() { return () => arguments[0]; }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 31, endLine: 1, endColumn: 40 }],
    },
    {
      name: '#23 an object method',
      path: '/root/file.ts',
      text: 'var o = { m() { return arguments[0]; } };',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 24, endLine: 1, endColumn: 33 }],
    },
    {
      name: '#24 arguments spread into a call',
      path: '/root/file.ts',
      text: 'function foo() { bar(...arguments); }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 25, endLine: 1, endColumn: 34 }],
    },
    {
      name: '#25 arguments passed as an argument',
      path: '/root/file.ts',
      text: 'function foo() { bar(arguments); }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 22, endLine: 1, endColumn: 31 }],
    },
    {
      name: '#26 a computed string member access',
      path: '/root/file.ts',
      text: "function foo() { arguments['length']; }",
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 18, endLine: 1, endColumn: 27 }],
    },
    {
      name: '#27 every reference is reported',
      path: '/root/file.ts',
      text: 'function foo() { arguments[0]; arguments.length; arguments[1]; }',
      errors: [
        { message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 18, endLine: 1, endColumn: 27 },
        { message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 50, endLine: 1, endColumn: 59 },
      ],
    },
    {
      name: '#28 the inner function is reported while the outer parameter named arguments is not',
      path: '/root/file.ts',
      text: 'function foo(arguments) { arguments[0]; return function () { arguments[0]; }; }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 62, endLine: 1, endColumn: 71 }],
    },
    {
      name: '#30 a generator function',
      path: '/root/file.ts',
      text: 'function* foo() { yield arguments[0]; }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 25, endLine: 1, endColumn: 34 }],
    },
    {
      name: '#31 an async function',
      path: '/root/file.ts',
      text: 'async function foo() { await arguments[0]; }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 30, endLine: 1, endColumn: 39 }],
    },
    {
      name: '#32 a class constructor',
      path: '/root/file.ts',
      text: 'class C { constructor() { arguments[0]; } }',
      errors: [{ message: "Use the rest parameters instead of 'arguments'.", line: 1, column: 27, endLine: 1, endColumn: 36 }],
    },
  ],
})
