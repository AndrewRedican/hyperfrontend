import { testRule } from '../../testing/rule-tester'
import rule from './no-todo-comments'

testRule(rule, {
  valid: [
    { name: '#1 // This is a regular comment', path: '/root/file.ts', text: '// This is a regular comment' },
    { name: '#15 const x = 1', path: '/root/file.ts', text: 'const x = 1' },
  ],
  invalid: [
    {
      name: '#33 /* TODO: first thing',
      path: '/root/file.ts',
      text: '/* TODO: first thing\n * TODO: second thing */',
      errors: [
        {
          message:
            'TODO comments are not allowed. Address the issue or create a tracking ticket instead of leaving TODO markers in the code.',
          line: 1,
          column: 4,
          endLine: 1,
          endColumn: 8,
        },
        {
          message:
            'TODO comments are not allowed. Address the issue or create a tracking ticket instead of leaving TODO markers in the code.',
          line: 2,
          column: 4,
          endLine: 2,
          endColumn: 8,
        },
      ],
    },
  ],
})
