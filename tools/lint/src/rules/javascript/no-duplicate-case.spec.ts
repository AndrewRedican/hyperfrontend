import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-duplicate-case.ts'

testRule(rule, {
  valid: [
    {
      name: "#2 var a = 1; switch (a) {case 1: break; case '1': break; defau…",
      path: '/root/file.ts',
      text: "var a = 1; switch (a) {case 1: break; case '1': break; default: break;}",
    },
    {
      name: '#6 var a = 1, f = function(b) { return b ? { p1: 1 } : { p1: 2 …',
      path: '/root/file.ts',
      text: 'var a = 1, f = function(b) { return b ? { p1: 1 } : { p1: 2 }; }; switch (a) {case f(true).p1: break; case f(true, false).p1: break; default: break;}',
    },
    {
      name: '#10 var a = [1,2]; switch(a.toString()){case ([1,2]).toString():…',
      path: '/root/file.ts',
      text: 'var a = [1,2]; switch(a.toString()){case ([1,2]).toString():break; case ([1]).toString():break; default:break;}',
    },
    {
      name: '#14 template literals with different expressions',
      path: '/root/file.ts',
      text: 'switch (a) { case `${b}`: break; case `${c}`: break; }',
    },
    {
      name: '#15 a type assertion distinguishes the test',
      path: '/root/file.ts',
      text: 'switch (a) { case b as number: break; case b: break; }',
    },
    {
      name: '#16 a non-null assertion distinguishes the test',
      path: '/root/file.ts',
      text: 'switch (a) { case b!: break; case b: break; }',
    },
    {
      name: '#19 an optional call differs from a plain call',
      path: '/root/file.ts',
      text: 'switch (a) { case f?.(): break; case f(): break; }',
    },
  ],
  invalid: [
    {
      name: '#30 switch (a) { case a: break; case b: break; case a: break; ca…',
      path: '/root/file.ts',
      text: 'switch (a) { case a: break; case b: break; case a: break; case c: break; case a: break; }',
      errors: [
        { message: 'Duplicate case label.', line: 1, column: 44, endLine: 1, endColumn: 58 },
        { message: 'Duplicate case label.', line: 1, column: 74, endLine: 1, endColumn: 88 },
      ],
    },
    {
      name: '#34 var a = 1, p = {p: {p1: 1, p2: 1}}; switch (a) {case p.p.p1:…',
      path: '/root/file.ts',
      text: 'var a = 1, p = {p: {p1: 1, p2: 1}}; switch (a) {case p.p.p1: break; case p. p // comment\n .p1: break; case p .p\n/* comment */\n.p1: break; default: break;}',
      errors: [
        { message: 'Duplicate case label.', line: 1, column: 69, endLine: 2, endColumn: 13 },
        { message: 'Duplicate case label.', line: 2, column: 14, endLine: 4, endColumn: 12 },
      ],
    },
    {
      name: '#36 var a = 1, f = function(s) { return { p1: s } }; switch (a) …',
      path: '/root/file.ts',
      text: 'var a = 1, f = function(s) { return { p1: s } }; switch (a) {case f(\na + 1 // comment\n).p1: break; case f(a+1)\n.p1: break; default: break;}',
      errors: [{ message: 'Duplicate case label.', line: 3, column: 14, endLine: 4, endColumn: 12 }],
    },
    {
      name: '#37 the report spans the whole duplicate clause',
      path: '/root/file.ts',
      text: 'switch (a) {\n  case 1:\n    break\n  case 1:\n    break\n}',
      errors: [{ message: 'Duplicate case label.', line: 4, column: 3, endLine: 5, endColumn: 10 }],
    },
    {
      name: '#38 a duplicate template literal',
      path: '/root/file.ts',
      text: 'switch (a) { case `x`: break; case `x`: break; }',
      errors: [{ message: 'Duplicate case label.', line: 1, column: 31, endLine: 1, endColumn: 47 }],
    },
  ],
})
