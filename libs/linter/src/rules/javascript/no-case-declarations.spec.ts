import { testRule } from '../../testing/rule-tester'
import rule from './no-case-declarations'

testRule(rule, {
  valid: [
    {
      name: '#1 switch (a) { case 1: { let x = 1; break; } default: { let x …',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: { let x = 1; break; } default: { let x = 2; break; } }',
    },
    {
      name: '#4 switch (a) { case 1: { class C {} break; } default: { class …',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: { class C {} break; } default: { class C {} break; } }',
    },
    {
      name: '#6 switch (a) {',
      path: '/root/file.ts',
      text: '\n            switch (a) {\n                case 1: var x;\n            }\n        ',
    },
    {
      name: '#9 declarations nested in a block of the clause',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: if (b) { let x; } break; }',
    },
    {
      name: '#10 a declaration in a loop head of the clause',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: for (let i = 0; i < 1; i++) {} }',
    },
    { name: '#11 a declaration inside a labelled block', path: '/root/file.ts', text: 'switch (a) { case 1: label: { const x = 1 } }' },
    {
      name: '#12 TypeScript type-level declarations are not lexical bindings',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: type T = number; interface I {} enum E {} break; }',
    },
    {
      name: '#13 a declaration inside a function expression of the clause',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: run(() => { const x = 1; return x }); break; }',
    },
  ],
  invalid: [
    {
      name: '#26 switch ("foo") {',
      path: '/root/file.ts',
      text: '\n                switch ("foo") {\n                    case "bar":\n                        function baz() { }\n                        break;\n                    default:\n                        baz();\n                }\n            ',
      errors: [{ message: 'Unexpected lexical declaration in case block.', line: 4, column: 25, endLine: 4, endColumn: 43 }],
    },
    {
      name: '#27 two declarations in one clause are reported separately with the same wrapping',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: let x; let y; }',
      errors: [
        { message: 'Unexpected lexical declaration in case block.', line: 1, column: 22, endLine: 1, endColumn: 28 },
        { message: 'Unexpected lexical declaration in case block.', line: 1, column: 29, endLine: 1, endColumn: 35 },
      ],
    },
    {
      name: '#29 the declaration statement is the reported range',
      path: '/root/file.ts',
      text: 'switch (a) {\n  case 1:\n    let x = 1\n    break\n}',
      errors: [{ message: 'Unexpected lexical declaration in case block.', line: 3, column: 5, endLine: 3, endColumn: 14 }],
    },
    {
      name: '#31 a generator declaration as the only statement',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: function* g() {} }',
      errors: [{ message: 'Unexpected lexical declaration in case block.', line: 1, column: 22, endLine: 1, endColumn: 38 }],
    },
    {
      name: '#32 a using declaration',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: using r = f(); break; }',
      errors: [{ message: 'Unexpected lexical declaration in case block.', line: 1, column: 22, endLine: 1, endColumn: 36 }],
    },
    {
      name: '#33 an await using declaration',
      path: '/root/file.ts',
      text: 'async function h() { switch (a) { case 1: await using r = f(); break; } }',
      errors: [{ message: 'Unexpected lexical declaration in case block.', line: 1, column: 43, endLine: 1, endColumn: 63 }],
    },
    {
      name: '#35 a typed declaration',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: let x: number = 1; break; }',
      errors: [{ message: 'Unexpected lexical declaration in case block.', line: 1, column: 22, endLine: 1, endColumn: 40 }],
    },
  ],
})
