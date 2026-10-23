import { testRule } from '../../testing/rule-tester'
import rule from './no-unsafe-finally'

testRule(rule, {
  valid: [
    {
      name: '#1 var foo = function() {',
      path: '/root/file.ts',
      text: "var foo = function() {\n try { \n return 1; \n } catch(err) { \n return 2; \n } finally { \n console.log('hola!') \n } \n }",
    },
    {
      name: '#4 var foo = function() { try { return 1 } catch(err) { return …',
      path: '/root/file.ts',
      text: 'var foo = function() { try { return 1 } catch(err) { return 2 } finally { var a = function(x) { if(!x) { throw new Error() } } } }',
    },
    {
      name: '#6 var foo = function() { try { return 1 } catch(err) { return …',
      path: '/root/file.ts',
      text: 'var foo = function() { try { return 1 } catch(err) { return 2 } finally { var a = function(x) { label: while(true) { if(x) { break label; } else { continue } } } } }',
    },
    {
      name: '#10 var foo = function() { try {} finally { do { break; } while …',
      path: '/root/file.ts',
      text: 'var foo = function() { try {} finally { do { break; } while (true) } }',
    },
    {
      name: '#12 var foo = function() { try { return 1; } catch(err) { return…',
      path: '/root/file.ts',
      text: 'var foo = function() { try { return 1; } catch(err) { return 2 } finally { (x) => x } }',
    },
    {
      name: '#13 var foo = function() { try { return 1; } finally { class bar…',
      path: '/root/file.ts',
      text: "var foo = function() { try { return 1; } finally { class bar { constructor() {} static ehm() { return 'Hola!'; } } } };",
    },
    {
      name: '#15 a labeled continue whose label is inside the finally block',
      path: '/root/file.ts',
      text: 'function f() { try {} finally { a: for (;;) { continue a; } } }',
    },
    {
      name: '#17 a for-of loop inside the finally block contains its break',
      path: '/root/file.ts',
      text: 'function f() { try {} finally { for (const x of y) { break; } } }',
    },
    {
      name: '#18 a for-in loop inside the finally block contains its continue',
      path: '/root/file.ts',
      text: 'function f() { try {} finally { for (const x in y) { continue; } } }',
    },
    {
      name: '#21 a throw inside a class static block of the finally block stops at the class',
      path: '/root/file.ts',
      text: 'function f() { try {} finally { class A { static { throw new Error() } } } }',
    },
  ],
  invalid: [
    {
      name: '#23 var foo = function() { try { return 1 } catch(err) { return …',
      path: '/root/file.ts',
      text: 'var foo = function() { try { return 1 } catch(err) { return 2 } finally { if(true) { return 3 } else { return 2 } } }',
      errors: [
        { message: 'Unsafe usage of ReturnStatement.', line: 1, column: 86, endLine: 1, endColumn: 94 },
        { message: 'Unsafe usage of ReturnStatement.', line: 1, column: 104, endLine: 1, endColumn: 112 },
      ],
    },
    {
      name: '#26 var foo = function() { try { return 1 } catch(err) { return …',
      path: '/root/file.ts',
      text: 'var foo = function() { try { return 1 } catch(err) { return 2 } finally { return { x: function(c) { return c } } } }',
      errors: [{ message: 'Unsafe usage of ReturnStatement.', line: 1, column: 75, endLine: 1, endColumn: 113 }],
    },
    {
      name: '#29 var foo = function() { label: try { return 0; } finally { br…',
      path: '/root/file.ts',
      text: 'var foo = function() { label: try { return 0; } finally { break label; } return 1; }',
      errors: [{ message: 'Unsafe usage of BreakStatement.', line: 1, column: 59, endLine: 1, endColumn: 71 }],
    },
    {
      name: '#32 var foo = function() { while (true) try {} finally { continu…',
      path: '/root/file.ts',
      text: 'var foo = function() { while (true) try {} finally { continue; } }',
      errors: [{ message: 'Unsafe usage of ContinueStatement.', line: 1, column: 54, endLine: 1, endColumn: 63 }],
    },
    {
      name: '#33 var foo = function() { switch (true) { case true: try {} fin…',
      path: '/root/file.ts',
      text: 'var foo = function() { switch (true) { case true: try {} finally { break; } } }',
      errors: [{ message: 'Unsafe usage of BreakStatement.', line: 1, column: 68, endLine: 1, endColumn: 74 }],
    },
    {
      name: '#41 a return inside a finally block of a nested arrow function',
      path: '/root/file.ts',
      text: 'const f = () => { try {} finally { return } }',
      errors: [{ message: 'Unsafe usage of ReturnStatement.', line: 1, column: 36, endLine: 1, endColumn: 42 }],
    },
    {
      name: '#42 a return inside a finally block of a class method',
      path: '/root/file.ts',
      text: 'class A { m() { try {} finally { return } } }',
      errors: [{ message: 'Unsafe usage of ReturnStatement.', line: 1, column: 34, endLine: 1, endColumn: 40 }],
    },
    {
      name: '#43 a multi-line throw is reported at its start',
      path: '/root/file.ts',
      text: 'function f() {\n  try {\n  } finally {\n    throw new Error(\n      "x",\n    )\n  }\n}',
      errors: [{ message: 'Unsafe usage of ThrowStatement.', line: 4, column: 5, endLine: 6, endColumn: 6 }],
    },
  ],
})
