import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-duplicate-enum-values.ts'

testRule(rule, {
  valid: [
    { name: '#1 enum E {', path: '/root/file.ts', text: '\nenum E {\n  A,\n  B,\n}\n    ' },
    { name: '#14 enum E {', path: '/root/file.ts', text: "\nenum E {\n  A = 'A',\n  B = 'B',\n  C = 2,\n  D = 1 + 1,\n}\n    " },
    { name: '#20 enum E {', path: '/root/file.ts', text: '\nenum E {\n  A = NaN,\n  B = -NaN,\n}\n    ' },
    { name: "#25 const A = 'A';", path: '/root/file.ts', text: "\nconst A = 'A';\nenum E {\n  A = 'A',\n  B = `${A}`,\n}\n    " },
    {
      name: '#28 a string of a non-numeric text under unary plus is not a number',
      path: '/root/file.ts',
      text: "\nenum E {\n  A = +'abc',\n  B = +'abc',\n}\n    ",
    },
    {
      name: '#29 a logical not is not a supported unary operator',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = !0,\n  B = !0,\n}\n    ',
    },
    {
      name: '#30 a typeof expression is not statically known',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = typeof x,\n  B = typeof x,\n}\n    ',
    },
    { name: '#31 bigint literals are not compared', path: '/root/file.ts', text: '\nenum E {\n  A = 1n,\n  B = 1n,\n}\n    ' },
    {
      name: '#34 member expressions are not statically known',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = a.b,\n  B = a.b,\n}\n    ',
    },
    { name: '#35 a quoted member name does not change the value check', path: '/root/file.ts', text: "enum E { 'A' = 1, B = 2 }" },
  ],
  invalid: [
    {
      name: '#39 enum E {',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = -1,\n  B = -1,\n}\n    ',
      errors: [{ message: 'Duplicate enum member value -1.', line: 4, column: 3, endLine: 4, endColumn: 9 }],
    },
    {
      name: '#44 enum E {',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = 0x10,\n  B = 16,\n}\n    ',
      errors: [{ message: 'Duplicate enum member value 16.', line: 4, column: 3, endLine: 4, endColumn: 9 }],
    },
    {
      name: '#48 enum E {',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = -`0`,\n  B = -0,\n}\n    ',
      errors: [{ message: 'Duplicate enum member value 0.', line: 4, column: 3, endLine: 4, endColumn: 9 }],
    },
    {
      name: '#50 enum E {',
      path: '/root/file.ts',
      text: "\nenum E {\n  A = 'A',\n  B = 'A',\n  C = 1,\n  D = 1,\n}\n      ",
      errors: [
        { message: 'Duplicate enum member value A.', line: 4, column: 3, endLine: 4, endColumn: 10 },
        { message: 'Duplicate enum member value 1.', line: 6, column: 3, endLine: 6, endColumn: 8 },
      ],
    },
    {
      name: '#53 a const enum',
      path: '/root/file.ts',
      text: 'const enum E { A = 1, B = 1 }',
      errors: [{ message: 'Duplicate enum member value 1.', line: 1, column: 23, endLine: 1, endColumn: 28 }],
    },
    {
      name: '#54 a declared enum',
      path: '/root/file.ts',
      text: "declare enum E { A = 'x', B = 'x' }",
      errors: [{ message: 'Duplicate enum member value x.', line: 1, column: 27, endLine: 1, endColumn: 34 }],
    },
    {
      name: '#55 an enum in a namespace',
      path: '/root/file.ts',
      text: 'namespace N {\n  export enum E {\n    A = 2,\n    B = 2,\n  }\n}',
      errors: [{ message: 'Duplicate enum member value 2.', line: 4, column: 5, endLine: 4, endColumn: 10 }],
    },
    {
      name: '#56 a third member with the same value is reported again',
      path: '/root/file.ts',
      text: 'enum E { A = 1, B = 1, C = 1 }',
      errors: [
        { message: 'Duplicate enum member value 1.', line: 1, column: 17, endLine: 1, endColumn: 22 },
        { message: 'Duplicate enum member value 1.', line: 1, column: 24, endLine: 1, endColumn: 29 },
      ],
    },
    {
      name: '#58 a duplicate after members that are not statically known',
      path: '/root/file.ts',
      text: "enum E { A = 'a', B = foo(), C = 'a' }",
      errors: [{ message: 'Duplicate enum member value a.', line: 1, column: 30, endLine: 1, endColumn: 37 }],
    },
    {
      name: '#62 a float written two ways',
      path: '/root/file.ts',
      text: '\nenum E {\n  A = 1.5,\n  B = 1.50,\n}\n    ',
      errors: [{ message: 'Duplicate enum member value 1.5.', line: 4, column: 3, endLine: 4, endColumn: 11 }],
    },
  ],
})
