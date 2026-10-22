import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-unused-labels.ts'

testRule(rule, {
  valid: [
    {
      name: '#7 A: { var A = 0; console.log(A); break A; console.log(A); }',
      path: '/root/file.ts',
      text: 'A: { var A = 0; console.log(A); break A; console.log(A); }',
    },
    {
      name: '#8 a label used by a break inside a nested labeled loop',
      path: '/root/file.ts',
      text: 'A: while (x) { B: while (y) { if (z) break A; break B; } }',
    },
    {
      name: '#9 a label used by a continue from a nested switch',
      path: '/root/file.ts',
      text: 'A: for (;;) { switch (x) { case 1: continue A; } }',
    },
    { name: '#11 a label used inside a namespace body', path: '/root/file.ts', text: 'namespace N { A: for (;;) { break A; } }' },
  ],
  invalid: [
    {
      name: '#15 A: for (var i = 0; i < 10; ++i) { foo(); if (a) break; bar()…',
      path: '/root/file.ts',
      text: 'A: for (var i = 0; i < 10; ++i) { foo(); if (a) break; bar(); }',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: 'for (var i = 0; i < 10; ++i) { foo(); if (a) break; bar(); }',
    },
    {
      name: '#19 A: /* comment */ foo',
      path: '/root/file.ts',
      text: 'A: /* comment */ foo',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: null,
    },
    {
      name: '#22 "use strict"; foo: "bar"',
      path: '/root/file.ts',
      text: '"use strict"; foo: "bar"',
      errors: [{ message: "'foo:' is defined but never used.", line: 1, column: 15, endLine: 1, endColumn: 18 }],
      output: null,
    },
    {
      name: '#23 A: ("use strict")',
      path: '/root/file.ts',
      text: 'A: ("use strict")',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: null,
    },
    {
      name: '#24 A: `use strict`',
      path: '/root/file.ts',
      text: 'A: `use strict`',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: null,
    },
    {
      name: "#27 A: B: C: 'foo'",
      path: '/root/file.ts',
      text: "A: B: C: 'foo'",
      errors: [
        { message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 },
        { message: "'B:' is defined but never used.", line: 1, column: 4, endLine: 1, endColumn: 5 },
        { message: "'C:' is defined but never used.", line: 1, column: 7, endLine: 1, endColumn: 8 },
      ],
      output: "C: 'foo'",
    },
    {
      name: '#30 A: 42',
      path: '/root/file.ts',
      text: 'A: 42',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: '42',
    },
    {
      name: '#33 a break naming a label that is not in scope leaves the enclosing label unused',
      path: '/root/file.ts',
      text: 'A: { break B; }',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: '{ break B; }',
    },
    {
      name: '#36 a string body at the top of an arrow function body is a potential directive',
      path: '/root/file.ts',
      text: "const f = () => { A: 'use strict' }",
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 19, endLine: 1, endColumn: 20 }],
      output: null,
    },
    {
      name: '#37 a string body under chained labels in a function body is a potential directive',
      path: '/root/file.ts',
      text: "function f() { A: B: 'use strict' }",
      errors: [
        { message: "'A:' is defined but never used.", line: 1, column: 16, endLine: 1, endColumn: 17 },
        { message: "'B:' is defined but never used.", line: 1, column: 19, endLine: 1, endColumn: 20 },
      ],
      output: "function f() { B: 'use strict' }",
    },
    {
      name: '#38 a template literal with substitutions is not a directive',
      path: '/root/file.ts',
      text: 'A: `${x}`',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: '`${x}`',
    },
    {
      name: '#40 a string body inside a class static block is removable',
      path: '/root/file.ts',
      text: "class C { static { A: 'use strict' } }",
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 20, endLine: 1, endColumn: 21 }],
      output: "class C { static { 'use strict' } }",
    },
    {
      name: '#41 a line comment between the colon and the body blocks the fix',
      path: '/root/file.ts',
      text: 'A: // comment\n  foo()',
      errors: [{ message: "'A:' is defined but never used.", line: 1, column: 1, endLine: 1, endColumn: 2 }],
      output: null,
    },
  ],
})
