import { testRule } from '../../testing/rule-tester'
import rule from './no-section-dividers'

testRule(rule, {
  valid: [
    { name: '#3 /* Block comment */', path: '/root/file.ts', text: '/* Block comment */' },
    { name: '#4 /** JSDoc comment */', path: '/root/file.ts', text: '/** JSDoc comment */' },
    { name: '#6 // -------- Section --------', path: '/root/file.ts', text: '// -------- Section --------' },
    { name: "#8 const x = '===='", path: '/root/file.ts', text: "const x = '===='" },
    { name: '#9 if (a === b && c === d) {}', path: '/root/file.ts', text: 'if (a === b && c === d) {}' },
  ],
  invalid: [
    {
      name: 'a divider behind code, removed without joining the lines',
      path: '/root/file.ts',
      text: 'const a = 1 // ====\nconst b = 2\n',
      errors: [
        {
          message:
            'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.',
          line: 1,
          column: 13,
        },
      ],
      output: 'const a = 1\nconst b = 2\n',
    },
    {
      name: '#14 const x = 1',
      path: '/root/file.ts',
      text: 'const x = 1\n// ============================\n// Section\n// ============================\nconst y = 2',
      errors: [
        {
          message:
            'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.',
          line: 2,
          column: 1,
          endLine: 5,
          endColumn: 1,
        },
      ],
      output: 'const x = 1\nconst y = 2',
    },
    {
      name: '#16 // ==== First ====',
      path: '/root/file.ts',
      text: '// ==== First ====\nconst x = 1\n// ==== Second ====',
      errors: [
        {
          message:
            'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.',
          line: 1,
          column: 1,
          endLine: 2,
          endColumn: 1,
        },
        {
          message:
            'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 20,
        },
      ],
      output: 'const x = 1\n',
    },
  ],
})

// why: the cases recorded from the previous linter hold no file with carriage-return line breaks.
testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a divider ended by a carriage return and a line feed',
      path: '/root/file.ts',
      text: '// ====\r\nconst x = 1',
      errors: [
        {
          message:
            'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.',
          line: 1,
          column: 1,
          endLine: 2,
          endColumn: 1,
        },
      ],
      output: 'const x = 1',
    },
  ],
})
