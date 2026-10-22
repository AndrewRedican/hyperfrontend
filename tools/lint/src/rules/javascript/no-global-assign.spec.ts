import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-global-assign.ts'

// why: the previous linter read `/* global */` comments, which no workspace file carries; those cases are left out.
testRule(rule, {
  valid: [
    { name: "#1 string = 'hello world';", path: '/root/file.ts', text: "string = 'hello world';" },
    { name: '#2 var string;', path: '/root/file.ts', text: 'var string;' },
    { name: '#3 Object = 0;', path: '/root/file.ts', text: 'Object = 0;', options: { exceptions: ['Object'] } },
    { name: '#7 a = 1', path: '/root/file.ts', text: 'a = 1', language: { globals: { a: 'writable' } } },
    { name: '#11 a read of a read-only global', path: '/root/file.ts', text: 'Object.assign({}, a);' },
    { name: '#12 a write to a property of a read-only global', path: '/root/file.ts', text: 'String.prototype.x = 1;' },
    { name: '#14 a parameter that shadows a read-only global', path: '/root/file.ts', text: 'function f(String) { String = 1; }' },
    { name: '#17 a type position reading a read-only global', path: '/root/file.ts', text: 'let v: typeof String = String;' },
  ],
  invalid: [
    {
      name: '#19 String++;',
      path: '/root/file.ts',
      text: 'String++;',
      errors: [{ message: "Read-only global 'String' should not be modified.", line: 1, column: 1, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#20 ({Object = 0, String = 0} = {});',
      path: '/root/file.ts',
      text: '({Object = 0, String = 0} = {});',
      errors: [
        { message: "Read-only global 'Object' should not be modified.", line: 1, column: 3, endLine: 1, endColumn: 9 },
        { message: "Read-only global 'String' should not be modified.", line: 1, column: 15, endLine: 1, endColumn: 21 },
      ],
    },
    {
      name: '#22 require = 0;',
      path: '/root/file.ts',
      text: 'require = 0;',
      language: { sourceType: 'commonjs' },
      errors: [{ message: "Read-only global 'require' should not be modified.", line: 1, column: 1, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#29 a compound assignment',
      path: '/root/file.ts',
      text: 'Object += 1;',
      errors: [{ message: "Read-only global 'Object' should not be modified.", line: 1, column: 1, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#30 a prefix update',
      path: '/root/file.ts',
      text: '--Array;',
      errors: [{ message: "Read-only global 'Array' should not be modified.", line: 1, column: 3, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#31 the left side of a for-in loop',
      path: '/root/file.ts',
      text: 'for (Object in {}) {}',
      errors: [{ message: "Read-only global 'Object' should not be modified.", line: 1, column: 6, endLine: 1, endColumn: 12 }],
    },
    {
      name: '#32 the left side of a for-of loop',
      path: '/root/file.ts',
      text: 'for (Array of []) {}',
      errors: [{ message: "Read-only global 'Array' should not be modified.", line: 1, column: 6, endLine: 1, endColumn: 11 }],
    },
    {
      name: '#33 an array destructuring default, which gives the identifier two write references, is reported once',
      path: '/root/file.ts',
      text: '[Object = 1] = [];',
      errors: [{ message: "Read-only global 'Object' should not be modified.", line: 1, column: 2, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#34 a destructuring target',
      path: '/root/file.ts',
      text: '({ a: String } = {});',
      errors: [{ message: "Read-only global 'String' should not be modified.", line: 1, column: 7, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#38 every write is reported, each at its own identifier',
      path: '/root/file.ts',
      text: 'String = 1;\nString = 2;',
      errors: [
        { message: "Read-only global 'String' should not be modified.", line: 1, column: 1, endLine: 1, endColumn: 7 },
        { message: "Read-only global 'String' should not be modified.", line: 2, column: 1, endLine: 2, endColumn: 7 },
      ],
    },
    {
      name: '#39 a write inside an arrow function',
      path: '/root/file.ts',
      text: 'const f = () => { Object = 1 }',
      errors: [{ message: "Read-only global 'Object' should not be modified.", line: 1, column: 19, endLine: 1, endColumn: 25 }],
    },
    {
      name: '#40 a write inside a class method',
      path: '/root/file.ts',
      text: 'class C { m() { Array = [] } }',
      errors: [{ message: "Read-only global 'Array' should not be modified.", line: 1, column: 17, endLine: 1, endColumn: 22 }],
    },
  ],
})
