import { testRule } from '../../testing/rule-tester'
import rule from './no-ascii-art-diagrams'

const README = '/workspace/libs/pub/README.md'
const ARCHITECTURE = '/workspace/libs/pub/ARCHITECTURE.md'
const README_MESSAGE =
  'ASCII art diagrams are not allowed in README.md. npm does not render Mermaid diagrams, so link to ARCHITECTURE.md or other documentation files instead.'
const DOCS_MESSAGE =
  'ASCII art diagrams are not allowed. Use Mermaid diagrams instead for better rendering, accessibility, and maintainability.'

const BOX = ['┌───────────┐', '│  PIPELINE │', '├───────────┤', '│ a ──▶ b   │', '└───────────┘']
const DOUBLE = ['╔═══════╗', '║ stage ║', '╚═══════╝']
const TREE = ['src/', '├── index.ts', '├── utils/', '│   ├── helper.ts', '│   └── format.ts', '└── types.ts']

// why: a document holding one fenced block after a title and a blank line, the fence on line 3.
const fenced = (lang: string, ...lines: string[]): string => `# Title\n\n\`\`\`${lang}\n${lines.join('\n')}\n\`\`\`\n`

testRule(rule, {
  valid: [
    { name: 'a mermaid diagram', path: README, text: fenced('mermaid', 'flowchart TB', '    A[Start] --> B[End]') },
    { name: 'a code example', path: README, text: fenced('typescript', 'const x = 1', 'const y = 2', 'console.log(x + y)') },
    { name: 'a directory tree', path: README, text: fenced('', ...TREE) },
    { name: 'a table drawn with pipes', path: README, text: fenced('text', '| a | b |', '| - | - |', '| 1 | 2 |') },
    { name: 'a box of two lines', path: README, text: fenced('', '┌───┐', '└───┘') },
    { name: 'a box with one bordered line', path: README, text: fenced('', '┌───┐', '│ a │', '└───┘') },
    { name: 'a box that never opens', path: README, text: fenced('', '│ a │', '│ b │', '└───┘') },
    { name: 'a block that never closes', path: README, text: `\`\`\`\n${BOX.join('\n')}\n` },
    { name: 'a box outside any fence', path: README, text: `${BOX.join('\n')}\n` },
  ],
  invalid: [
    {
      name: 'a box in a readme, from its first drawn line to the closing fence',
      path: README,
      text: fenced('', ...BOX),
      errors: [{ message: README_MESSAGE, line: 4, column: 0, endLine: 9, endColumn: 0 }],
    },
    {
      name: 'a double-lined box in another document, whatever the fence language',
      path: ARCHITECTURE,
      text: fenced('text', ...DOUBLE, '║ more ║'),
      errors: [{ message: DOCS_MESSAGE, line: 4, column: 0, endLine: 8, endColumn: 0 }],
    },
    {
      name: 'two boxes, each reported',
      path: ARCHITECTURE,
      text: `${fenced('', ...BOX)}\nText between.\n\n\`\`\`\n${BOX.join('\n')}\n\`\`\`\n`,
      errors: [
        { message: DOCS_MESSAGE, line: 4, column: 0, endLine: 9, endColumn: 0 },
        { message: DOCS_MESSAGE, line: 14, column: 0, endLine: 19, endColumn: 0 },
      ],
    },
    {
      name: 'a box drawn with an indented fence',
      path: ARCHITECTURE,
      text: `- step\n\n  \`\`\`\n  ${BOX.join('\n  ')}\n  \`\`\`\n`,
      errors: [{ message: DOCS_MESSAGE, line: 4, column: 0, endLine: 9, endColumn: 0 }],
    },
  ],
})
