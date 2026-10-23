import { testRule } from '../../testing/rule-tester'
import rule from './no-plain-inline-comments'

// why: the configuration-file cases name absolute paths the rule reads only the base name of.
testRule(rule, {
  valid: [
    {
      name: "#1 // why: Counter starts at 0 to match the API's 0-based index…",
      path: '/root/file.ts',
      text: "// why: Counter starts at 0 to match the API's 0-based indexing\nlet counter = 0",
    },
    { name: '#13 // @ts-ignore', path: '/root/file.ts', text: '// @ts-ignore\nconst x: any = 1' },
    { name: '#18 /* global myGlobal */', path: '/root/file.ts', text: '/* global myGlobal */\nconst x = myGlobal' },
    {
      name: '#22 import(/* webpackChunkName: "lodash" */ \'lodash\')',
      path: '/root/file.ts',
      text: 'import(/* webpackChunkName: "lodash" */ \'lodash\')',
    },
    { name: '#24 switch (x) {', path: '/root/file.ts', text: 'switch (x) {\n  case 1:\n    // falls through\n  case 2:\n    break\n}' },
    { name: '#26 /** JSDoc comment */', path: '/root/file.ts', text: '/** JSDoc comment */\nfunction test() {}' },
    { name: '#28 // Setup ESLint', path: '/root/path/to/eslint.config.js', text: '// Setup ESLint\nmodule.exports = {}' },
    { name: '#29 // Vite configuration', path: '/root/path/to/vite.config.ts', text: '// Vite configuration\nexport default {}' },
    { name: '#31 // Base TypeScript config', path: '/root/path/to/tsconfig.base.json', text: '// Base TypeScript config\n{}' },
    {
      name: '#34 // <hf:feature> — managed by @hyperfrontend/features; safe t…',
      path: '/root/file.ts',
      text: "// <hf:feature> — managed by @hyperfrontend/features; safe to keep\nimport './hyperfrontend.feature'\n// </hf:feature>",
    },
    { name: '#37 try {', path: '/root/file.ts', text: 'try {\n  risky()\n} catch (e) {\n  // swallow error\n}' },
    { name: '#41 const noop = function() {', path: '/root/file.ts', text: 'const noop = function() {\n  // no-op\n}' },
    { name: '#42 const noop = () => {', path: '/root/file.ts', text: 'const noop = () => {\n  // do nothing\n}' },
    { name: '#43 class Foo {', path: '/root/file.ts', text: 'class Foo {\n  onEvent() {\n    // override in subclass\n  }\n}' },
  ],
  invalid: [
    {
      name: '#44 // Initialize the counter',
      path: '/root/file.ts',
      text: '// Initialize the counter\nlet counter = 0',
      errors: [
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 26,
        },
      ],
      output: 'let counter = 0',
    },
    {
      name: '#46 // First comment',
      path: '/root/file.ts',
      text: '// First comment\n// Second comment\nconst x = 1',
      errors: [
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 17,
        },
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 18,
        },
      ],
      output: 'const x = 1',
    },
    {
      name: '#50 function add(a: number, b: number) { // add numbers',
      path: '/root/file.ts',
      text: 'function add(a: number, b: number) { // add numbers\n  return a + b\n}',
      errors: [
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 1,
          column: 38,
          endLine: 1,
          endColumn: 52,
        },
      ],
      output: 'function add(a: number, b: number) {\n  return a + b\n}',
    },
    {
      name: '#51 // Just a comment',
      path: '/root/file.ts',
      text: '// Just a comment',
      errors: [
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 18,
        },
      ],
      output: '',
    },
    {
      name: '#53 const a = 1 // first',
      path: '/root/file.ts',
      text: 'const a = 1 // first\nconst b = 2 // second',
      errors: [
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 21,
        },
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 2,
          column: 13,
          endLine: 2,
          endColumn: 22,
        },
      ],
      output: 'const a = 1\nconst b = 2',
    },
  ],
})

// why: the cases recorded from the previous linter hold no file with carriage-return line breaks.
testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a plain comment ended by a carriage return and a line feed',
      path: '/root/file.ts',
      text: '// plain\r\nconst x = 1',
      errors: [
        {
          message:
            'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 9,
        },
      ],
      output: 'const x = 1',
    },
  ],
})
