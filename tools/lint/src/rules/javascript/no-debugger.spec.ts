import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-debugger.ts'

testRule(rule, {
  valid: [
    { name: '#1 var test = { debugger: 1 }; test.debugger;', path: '/root/file.ts', text: 'var test = { debugger: 1 }; test.debugger;' },
    { name: '#2 a property named debugger in a class', path: '/root/file.ts', text: 'class A { debugger = 1; static debugger() {} }' },
    { name: '#3 a string mentioning the keyword', path: '/root/file.ts', text: 'const message = "debugger"' },
    { name: '#4 a label and a comment', path: '/root/file.ts', text: 'debuggerLabel: for (;;) { break debuggerLabel } // debugger' },
  ],
  invalid: [
    {
      name: '#5 if (foo) debugger',
      path: '/root/file.ts',
      text: 'if (foo) debugger',
      errors: [{ message: "Unexpected 'debugger' statement.", line: 1, column: 10, endLine: 1, endColumn: 18 }],
    },
    {
      name: '#8 every statement in a function body',
      path: '/root/file.ts',
      text: 'function f() {\n  debugger\n  if (x) {\n    debugger;\n  }\n}',
      errors: [
        { message: "Unexpected 'debugger' statement.", line: 2, column: 3, endLine: 2, endColumn: 11 },
        { message: "Unexpected 'debugger' statement.", line: 4, column: 5, endLine: 4, endColumn: 14 },
      ],
    },
    {
      name: '#10 the body of a loop',
      path: '/root/file.ts',
      text: 'while (x) debugger;',
      errors: [{ message: "Unexpected 'debugger' statement.", line: 1, column: 11, endLine: 1, endColumn: 20 }],
    },
    {
      name: '#11 a statement in a TypeScript class method',
      path: '/root/file.ts',
      text: 'class A { run(): void { debugger } }',
      errors: [{ message: "Unexpected 'debugger' statement.", line: 1, column: 25, endLine: 1, endColumn: 33 }],
    },
  ],
})
