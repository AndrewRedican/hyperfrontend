import { testRule } from '../../testing/rule-tester.ts'
import rule from './prefer-jsdoc-over-trailing-comments.ts'

testRule(rule, {
  valid: [
    { name: '#2 interface A {', path: '/root/file.ts', text: 'interface A {\n  /** method description */\n  someMethod(): void;\n}' },
    { name: '#4 const x = 1 // this is ok', path: '/root/file.ts', text: 'const x = 1 // this is ok' },
    { name: '#5 interface A {', path: '/root/file.ts', text: 'interface A {\n  someProp: boolean; /* block comment */\n}' },
    { name: '#6 class MyClass {', path: '/root/file.ts', text: 'class MyClass {\n  myProp: string; // class property comment\n}' },
    { name: '#7 type MyType = {', path: '/root/file.ts', text: 'type MyType = {\n  prop: number; // type literal comment\n};' },
    { name: '#8 const obj = {', path: '/root/file.ts', text: 'const obj = {\n  prop: 1, // object literal comment\n};' },
  ],
  invalid: [
    {
      name: '#11 interface A {',
      path: '/root/file.ts',
      text: 'interface A {\n  prop1: string; // first property\n  prop2: number; // second property\n}',
      errors: [
        {
          message:
            'Use a JSDoc comment above the member instead of a trailing inline comment. This allows documentation tools to collect the information correctly.',
          line: 2,
          column: 18,
          endLine: 2,
          endColumn: 35,
        },
        {
          message:
            'Use a JSDoc comment above the member instead of a trailing inline comment. This allows documentation tools to collect the information correctly.',
          line: 3,
          column: 18,
          endLine: 3,
          endColumn: 36,
        },
      ],
      output: 'interface A {\n  /** first property */\n  prop1: string;\n  /** second property */\n  prop2: number;\n}',
    },
    {
      name: '#12 interface A {',
      path: '/root/file.ts',
      text: 'interface A {\n  /** existing doc */\n  someProp: boolean; // trailing comment\n}',
      errors: [
        {
          message:
            'Use a JSDoc comment above the member instead of a trailing inline comment. This allows documentation tools to collect the information correctly.',
          line: 3,
          column: 22,
          endLine: 3,
          endColumn: 41,
        },
      ],
      output: null,
    },
  ],
})
