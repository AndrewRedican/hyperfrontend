import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-decorative-header-comments.ts'

testRule(rule, {
  valid: [
    { name: '#1 /**', path: '/root/file.ts', text: '/**\n * @module myModule\n */\nconst x = 1' },
    { name: '#5 // This is a line comment', path: '/root/file.ts', text: '// This is a line comment\nconst x = 1' },
    { name: '#8 /**', path: '/root/file.ts', text: "/**\n * @vitest-environment jsdom\n */\ndescribe('test', () => {})" },
    {
      name: '#11 /**',
      path: '/root/file.ts',
      text: '/**\n * Individual validation error\n */\nexport interface ValidationError {\n  message: string\n}',
    },
    {
      name: '#12 /**',
      path: '/root/file.ts',
      text: '/**\n * A utility class for handling\n * string operations.\n */\nexport class StringUtils {\n  trim(s: string) { return s.trim() }\n}',
    },
    {
      name: '#13 /**',
      path: '/root/file.ts',
      text: '/**\n * Calculates the sum of two numbers\n * and returns the result.\n */\nexport function add(a: number, b: number) {\n  return a + b\n}',
    },
    {
      name: '#14 /**',
      path: '/root/file.ts',
      text: '/**\n * Represents a user identifier\n * which can be string or number.\n */\nexport type UserId = string | number',
    },
    {
      name: '#15 /**',
      path: '/root/file.ts',
      text: '/**\n * Default configuration object\n * for the application.\n */\nexport const DEFAULT_CONFIG = {\n  timeout: 1000,\n}',
    },
    {
      name: '#16 /**',
      path: '/root/file.ts',
      text: '/**\n * Available log levels\n * for the logging system.\n */\nexport enum LogLevel {\n  DEBUG,\n  INFO,\n  WARN,\n}',
    },
  ],
  invalid: [
    {
      name: '#17 /**',
      path: '/root/file.ts',
      text: '/**\n * This is the vfs module.\n * Blah blah etc, etc.\n */\n\nconst x = 1',
      errors: [
        {
          message:
            'Decorative file header comments are not allowed. Either add meaningful JSDoc tags (@module, @param, etc.) or remove the comment.',
          line: 1,
          column: 1,
          endLine: 4,
          endColumn: 4,
        },
      ],
      output: 'const x = 1',
    },
    {
      name: '#19 /**',
      path: '/root/file.ts',
      text: '/**\n *\n * Main module file\n *\n * Contains important stuff\n *\n */\n\nconst main = true',
      errors: [
        {
          message:
            'Decorative file header comments are not allowed. Either add meaningful JSDoc tags (@module, @param, etc.) or remove the comment.',
          line: 1,
          column: 1,
          endLine: 7,
          endColumn: 4,
        },
      ],
      output: 'const main = true',
    },
  ],
})
