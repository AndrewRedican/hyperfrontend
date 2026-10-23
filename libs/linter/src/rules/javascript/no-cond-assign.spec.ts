import { testRule } from '../../testing/rule-tester'
import rule from './no-cond-assign'

// why: the workspace allows an assignment in its own parentheses (`except-parens`); the cases recorded with `always` are left out.
testRule(rule, {
  valid: [
    { name: '#3 var x = 5; while (x < 5) { x = x + 1; }', path: '/root/file.ts', text: 'var x = 5; while (x < 5) { x = x + 1; }' },
    {
      name: '#4 if ((someNode = someNode.parentNode) !== null) { }',
      path: '/root/file.ts',
      text: 'if ((someNode = someNode.parentNode) !== null) { }',
    },
    { name: '#10 for (;;) {}', path: '/root/file.ts', text: 'for (;;) {}' },
    {
      name: '#13 do { } while (someNode || (someNode = parentNode));',
      path: '/root/file.ts',
      text: 'do { } while (someNode || (someNode = parentNode));',
    },
    {
      name: '#15 if ((function(node) { return node = parentNode; })(someNode)…',
      path: '/root/file.ts',
      text: 'if ((function(node) { return node = parentNode; })(someNode)) { }',
      options: 'except-parens',
    },
    {
      name: '#17 if ((node => node = parentNode)(someNode)) { }',
      path: '/root/file.ts',
      text: 'if ((node => node = parentNode)(someNode)) { }',
      options: 'except-parens',
    },
    {
      name: '#23 switch (foo) { case a = b: bar(); }',
      path: '/root/file.ts',
      text: 'switch (foo) { case a = b: bar(); }',
      options: 'except-parens',
    },
    { name: '#27 a doubly parenthesised conditional test', path: '/root/file.ts', text: 'const d = ((a = b)) ? 1 : 2' },
    { name: '#32 assignments in an arrow function used as the test', path: '/root/file.ts', text: 'if (() => (a = b)) {}' },
    { name: '#37 an assignment in the body of a do-while', path: '/root/file.ts', text: 'do x = 1; while ((a = b))' },
    { name: '#40 a conditional test wrapped twice inside a call argument', path: '/root/file.ts', text: 'f(((a = b)) ? 1 : 2)' },
  ],
  invalid: [
    {
      name: '#46 var x; for(; x+=1 ;){};',
      path: '/root/file.ts',
      text: 'var x; for(; x+=1 ;){};',
      errors: [
        { message: 'Expected a conditional expression and instead saw an assignment.', line: 1, column: 14, endLine: 1, endColumn: 18 },
      ],
    },
    {
      name: '#47 var x; if ((x) = (0));',
      path: '/root/file.ts',
      text: 'var x; if ((x) = (0));',
      errors: [
        { message: 'Expected a conditional expression and instead saw an assignment.', line: 1, column: 12, endLine: 1, endColumn: 21 },
      ],
    },
    {
      name: '#62 (((3496.29)).bkufyydt = 2e308) ? foo : bar;',
      path: '/root/file.ts',
      text: '(((3496.29)).bkufyydt = 2e308) ? foo : bar;',
      errors: [
        { message: 'Expected a conditional expression and instead saw an assignment.', line: 1, column: 2, endLine: 1, endColumn: 30 },
      ],
    },
    {
      name: '#63 a single pair of parentheses is the statement parentheses',
      path: '/root/file.ts',
      text: 'let a, b\nif (a = b) {}',
      errors: [
        { message: 'Expected a conditional expression and instead saw an assignment.', line: 2, column: 5, endLine: 2, endColumn: 10 },
      ],
    },
  ],
})
