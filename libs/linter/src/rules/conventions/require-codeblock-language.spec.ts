import { testRule } from '../../testing/rule-tester'
import rule from './require-codeblock-language'

const MESSAGE =
  'Code block is missing a language identifier. Add a language (e.g., ```typescript, ```json, ```bash) after the opening backticks.'
const UNLABELLED = '# Example\n\nSome text here.\n\n```\nconst x = 1\nconst y = 2\n```\n\nMore text.\n'
const LABELLED = '# Example\n\n```typescript\nconst x = 1\n```\n'
const MIXED =
  '# Example\n\n```typescript\nconst x = 1\n```\n\nSome text.\n\n```\nunlabeled\n```\n\nMore text.\n\n```json\n{ "key": "value" }\n```\n\n```\nanother unlabeled\n```\n'

testRule(rule, {
  valid: [
    { name: 'labelled blocks', path: '/project/README.md', text: LABELLED },
    { name: 'no blocks at all', path: '/project/ARCHITECTURE.md', text: '# Example\n\nJust text.\n\n- Item 1\n' },
    {
      name: 'a labelled block whose language has spaces before it',
      path: '/project/README.md',
      text: '  ```bash\nnpm run build\n  ```\n',
    },
    {
      name: 'escaped backticks inside a markdown block',
      path: '/project/README.md',
      text: '```markdown\n# Nested\n\\`\\`\\`\ncode\n\\`\\`\\`\n```\n',
    },
  ],
  invalid: [
    {
      name: 'an unlabelled block',
      path: '/project/README.md',
      text: UNLABELLED,
      errors: [{ message: MESSAGE, line: 5, column: 0, endLine: 5, endColumn: 3 }],
    },
    {
      name: 'two unlabelled blocks among labelled ones',
      path: '/project/README.md',
      text: MIXED,
      errors: [
        { message: MESSAGE, line: 9, column: 0, endLine: 9, endColumn: 3 },
        { message: MESSAGE, line: 19, column: 0, endLine: 19, endColumn: 3 },
      ],
    },
    {
      name: 'an indented unlabelled block, reported at its indentation',
      path: '/project/README.md',
      text: '# Example\n\n  ```\n  code\n  ```\n',
      errors: [{ message: MESSAGE, line: 3, column: 2, endLine: 3, endColumn: 5 }],
    },
    {
      name: 'a block opening the file',
      path: '/project/README.md',
      text: '```\ncode\n```\n',
      errors: [{ message: MESSAGE, line: 1, column: 0, endLine: 1, endColumn: 3 }],
    },
    {
      name: 'a block whose fence carries only whitespace',
      path: '/project/libs/pub/ARCHITECTURE.md',
      text: '```   \ncode\n```\n',
      errors: [{ message: MESSAGE, line: 1, column: 0, endLine: 1, endColumn: 3 }],
    },
  ],
})
