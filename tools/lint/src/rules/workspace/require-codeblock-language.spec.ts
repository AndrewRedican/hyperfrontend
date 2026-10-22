import { existsSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './require-codeblock-language.ts'

const workspace = createMarkdownWorkspace()
const MESSAGE =
  'Code block is missing a language identifier. Add a language (e.g., ```typescript, ```json, ```bash) after the opening backticks.'
const UNLABELLED = '# Example\n\nSome text here.\n\n```\nconst x = 1\nconst y = 2\n```\n\nMore text.\n'
const LABELLED = '# Example\n\n```typescript\nconst x = 1\n```\n'
const MIXED =
  '# Example\n\n```typescript\nconst x = 1\n```\n\nSome text.\n\n```\nunlabeled\n```\n\nMore text.\n\n```json\n{ "key": "value" }\n```\n\n```\nanother unlabeled\n```\n'

testRule(rule, {
  valid: [
    { name: 'labelled blocks at the workspace root', path: workspace.rootFile('README.md'), text: LABELLED },
    { name: 'no blocks at all', path: workspace.rootFile('ARCHITECTURE.md'), text: '# Example\n\nJust text.\n\n- Item 1\n' },
    {
      name: 'a labelled block whose language has spaces before it',
      path: workspace.rootFile('README.md'),
      text: '  ```bash\nnpm run build\n  ```\n',
    },
    {
      name: 'escaped backticks inside a markdown block',
      path: workspace.rootFile('README.md'),
      text: '```markdown\n# Nested\n\\`\\`\\`\ncode\n\\`\\`\\`\n```\n',
    },
    {
      name: 'a README nested under a library, which is not the library directory',
      path: workspace.nestedFile('README.md'),
      text: UNLABELLED,
    },
    { name: 'an internal library', path: workspace.internalFile('README.md'), text: UNLABELLED },
    { name: 'a documentation directory', path: workspace.docsFile('guide.md'), text: UNLABELLED },
    { name: 'an application', path: workspace.appFile('README.md'), text: UNLABELLED },
  ],
  invalid: [
    {
      name: 'an unlabelled block at the workspace root',
      path: workspace.rootFile('README.md'),
      text: UNLABELLED,
      errors: [{ message: MESSAGE, line: 5, column: 0, endLine: 5, endColumn: 3 }],
    },
    {
      name: 'two unlabelled blocks among labelled ones',
      path: workspace.rootFile('README.md'),
      text: MIXED,
      errors: [
        { message: MESSAGE, line: 9, column: 0, endLine: 9, endColumn: 3 },
        { message: MESSAGE, line: 19, column: 0, endLine: 19, endColumn: 3 },
      ],
    },
    {
      name: 'an indented unlabelled block, reported at its indentation',
      path: workspace.rootFile('README.md'),
      text: '# Example\n\n  ```\n  code\n  ```\n',
      errors: [{ message: MESSAGE, line: 3, column: 2, endLine: 3, endColumn: 5 }],
    },
    {
      name: 'a block opening the file',
      path: workspace.rootFile('README.md'),
      text: '```\ncode\n```\n',
      errors: [{ message: MESSAGE, line: 1, column: 0, endLine: 1, endColumn: 3 }],
    },
    {
      name: 'a block whose fence carries only whitespace',
      path: workspace.libraryFile('ARCHITECTURE.md'),
      text: '```   \ncode\n```\n',
      errors: [{ message: MESSAGE, line: 1, column: 0, endLine: 1, endColumn: 3 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
