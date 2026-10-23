import { testRule } from '../../testing/rule-tester'
import rule from './prefer-as-const'

testRule(rule, {
  valid: [
    { name: "#1 let foo = 'baz' as const;", path: '/root/file.ts', text: "let foo = 'baz' as const;" },
    { name: '#4 let foo = { bar: 1 as const };', path: '/root/file.ts', text: 'let foo = { bar: 1 as const };' },
    { name: "#8 let foo = <string>'bar';", path: '/root/file.ts', text: "let foo = <string>'bar';" },
    { name: '#10 let foo = `bar` as `bar`;', path: '/root/file.ts', text: 'let foo = `bar` as `bar`;' },
    { name: "#17 let foo: 'bar';", path: '/root/file.ts', text: "let foo: 'bar';" },
    { name: '#18 let foo = { bar };', path: '/root/file.ts', text: 'let foo = { bar };' },
    {
      name: '#28 class foo {',
      path: '/root/file.ts',
      text: "\n      class foo {\n        get bar(): 'bar' {}\n        set bar(bar: 'bar') {}\n      }\n    ",
    },
    {
      name: "#30 type BazFunction = () => 'baz';",
      path: '/root/file.ts',
      text: "\n      type BazFunction = () => 'baz';\n      class foo {\n        bar: BazFunction = () => 'bar';\n      }\n    ",
    },
    { name: '#31 class foo {', path: '/root/file.ts', text: '\n      class foo {\n        bar(): void {}\n      }\n    ' },
    { name: '#33 numbers compare by their raw text', path: '/root/file.ts', text: 'let foo = 1 as 1.0;' },
    { name: '#34 a negative literal type is a unary expression', path: '/root/file.ts', text: 'let foo = -1 as -1;' },
    { name: '#35 the null type is a keyword', path: '/root/file.ts', text: 'let foo = null as null;' },
    {
      name: '#37 an accessor property is not a property definition',
      path: '/root/file.ts',
      text: "class A {\n  accessor bar: 'baz' = 'baz';\n}",
    },
    { name: '#38 a satisfies expression is not an assertion', path: '/root/file.ts', text: "let foo = 'bar' satisfies 'bar';" },
  ],
  invalid: [
    {
      name: "#41 let []: 'bar' = 'bar';",
      path: '/root/file.ts',
      text: "let []: 'bar' = 'bar';",
      errors: [
        { message: 'Expected a `const` assertion instead of a literal type annotation.', line: 1, column: 9, endLine: 1, endColumn: 14 },
      ],
      output: null,
    },
    {
      name: '#51 class foo {',
      path: '/root/file.ts',
      text: "\nclass foo {\n  foo = <'bar'>'bar';\n}\n      ",
      errors: [{ message: 'Expected a `const` instead of a literal type assertion.', line: 3, column: 10, endLine: 3, endColumn: 15 }],
      output: "\nclass foo {\n  foo = <const>'bar';\n}\n      ",
    },
    {
      name: '#55 a boolean literal assertion',
      path: '/root/file.ts',
      text: 'let foo = true as true;',
      errors: [{ message: 'Expected a `const` instead of a literal type assertion.', line: 1, column: 19, endLine: 1, endColumn: 23 }],
      output: 'let foo = true as const;',
    },
    {
      name: '#57 a bigint literal annotation',
      path: '/root/file.ts',
      text: 'const foo: 1n = 1n;',
      errors: [
        { message: 'Expected a `const` assertion instead of a literal type annotation.', line: 1, column: 12, endLine: 1, endColumn: 14 },
      ],
      output: null,
    },
    {
      name: '#59 a static property annotation',
      path: '/root/file.ts',
      text: "class A {\n  static bar: 'baz' = 'baz';\n}",
      errors: [
        { message: 'Expected a `const` assertion instead of a literal type annotation.', line: 2, column: 15, endLine: 2, endColumn: 20 },
      ],
      output: null,
    },
    {
      name: '#60 an assertion inside a call argument',
      path: '/root/file.ts',
      text: "f('a' as 'a');",
      errors: [{ message: 'Expected a `const` instead of a literal type assertion.', line: 1, column: 10, endLine: 1, endColumn: 13 }],
      output: "f('a' as const);",
    },
  ],
})
