import { testRule } from '../../testing/rule-tester'
import rule from './no-dupe-else-if'

testRule(rule, {
  valid: [
    { name: '#3 if (true) {} else if (false) {} else {}', path: '/root/file.ts', text: 'if (true) {} else if (false) {} else {}' },
    { name: '#15 if (a) { if (a) {} }', path: '/root/file.ts', text: 'if (a) { if (a) {} }' },
    { name: '#19 while (a) if (a);', path: '/root/file.ts', text: 'while (a) if (a);' },
    { name: '#20 if (a); else a ? a : a;', path: '/root/file.ts', text: 'if (a); else a ? a : a;' },
    { name: '#23 if (a) {} else if (!!a) {}', path: '/root/file.ts', text: 'if (a) {} else if (!!a) {}' },
    { name: '#35 a type assertion makes the tokens differ', path: '/root/file.ts', text: 'if (a as boolean) {} else if (a) {}' },
    { name: '#36 a non-null assertion makes the tokens differ', path: '/root/file.ts', text: 'if (a!) {} else if (a) {}' },
    { name: '#38 an optional call differs from a plain call', path: '/root/file.ts', text: 'if (f?.(a)) {} else if (f(a)) {}' },
    { name: '#40 template literals with different expressions', path: '/root/file.ts', text: 'if (`${a}`) {} else if (`${b}`) {}' },
    {
      name: '#46 and-operands nested in or-operands that share one side across positions',
      path: '/root/file.ts',
      text: 'if (y && (x || (a && b))) {} else if (y && (x || (c && a))) {}',
    },
  ],
  invalid: [
    {
      name: '#58 if (a) {} else if (a) {} else if (a) {}',
      path: '/root/file.ts',
      text: 'if (a) {} else if (a) {} else if (a) {}',
      errors: [
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 1,
          column: 20,
          endLine: 1,
          endColumn: 21,
        },
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 1,
          column: 35,
          endLine: 1,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#62 if (1 < a) {} else if (1 < a) {}',
      path: '/root/file.ts',
      text: 'if (1 < a) {} else if (1 < a) {}',
      errors: [
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 1,
          column: 24,
          endLine: 1,
          endColumn: 29,
        },
      ],
    },
    {
      name: '#68 if (a === 1) {} else if (a === /* comment */ 1) {}',
      path: '/root/file.ts',
      text: 'if (a === 1) {} else if (a === /* comment */ 1) {}',
      errors: [
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 1,
          column: 26,
          endLine: 1,
          endColumn: 47,
        },
      ],
    },
    {
      name: '#75 if ((a === b && fn(c)) || d) {} else if (fn(c) && a === b) {…',
      path: '/root/file.ts',
      text: 'if ((a === b && fn(c)) || d) {} else if (fn(c) && a === b) {}',
      errors: [
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 1,
          column: 42,
          endLine: 1,
          endColumn: 58,
        },
      ],
    },
    {
      name: '#105 an optional chain repeated token for token',
      path: '/root/file.ts',
      text: 'if (a?.b) {} else if (a?.b) {}',
      errors: [
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 1,
          column: 23,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#108 both duplicates of a chain inside a function body',
      path: '/root/file.ts',
      text: 'function f() {\n  if (a) {\n  } else if (b) {\n  } else if (a) {\n  } else if (b) {\n  }\n}',
      errors: [
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 4,
          column: 14,
          endLine: 4,
          endColumn: 15,
        },
        {
          message: 'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
          line: 5,
          column: 14,
          endLine: 5,
          endColumn: 15,
        },
      ],
    },
  ],
})
