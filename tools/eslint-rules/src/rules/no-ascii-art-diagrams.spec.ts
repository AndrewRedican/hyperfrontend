import { describe, expect, it, jest } from '@hyperfrontend/testing'
import rule, {
  countBoxDrawingChars,
  detectAsciiArtDiagrams,
  hasRightSideBoxChars,
  hasTopLeftCorner,
  isBoxDiagramLine,
  isBoxStructure,
  RULE_NAME,
} from './no-ascii-art-diagrams'

/**
 * Creates markdown content with an ASCII art diagram.
 *
 * @returns Markdown content containing an ASCII art box diagram.
 */
function createMarkdownWithAsciiArt(): string {
  return `# Example

Some text here.

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              OUTBOUND PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Plaintext    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   Wire    │
│   Message  ──▶ │ Encryption  │ ──▶│ Serialization│ ──▶│ Obfuscation │ ──▶ Format │
│                │    Queue    │    │    Queue    │    │    Queue    │            │
│                └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
\`\`\`

More text after.
`
}

/**
 * Creates markdown content with a Mermaid diagram.
 *
 * @returns Markdown content containing a Mermaid diagram.
 */
function createMarkdownWithMermaid(): string {
  return `# Example

Some text here.

\`\`\`mermaid
flowchart TB
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

More text after.
`
}

/**
 * Creates markdown content with a simple code block.
 *
 * @returns Markdown content with a code block (no ASCII art).
 */
function createMarkdownWithCodeBlock(): string {
  return `# Example

Some text here.

\`\`\`typescript
const x = 1
const y = 2
console.log(x + y)
\`\`\`

More text after.
`
}

/**
 * Creates markdown content with a directory tree.
 *
 * @returns Markdown content with directory tree (should not be flagged).
 */
function createMarkdownWithDirectoryTree(): string {
  return `# Project Structure

\`\`\`
src/
├── index.ts
├── utils/
│   ├── helper.ts
│   └── format.ts
└── types.ts
\`\`\`
`
}

describe('no-ascii-art-diagrams', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('no-ascii-art-diagrams')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('suggestion')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('no-ascii-art-diagrams')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('noAsciiArtInReadme')
      expect(messageIds).toContain('noAsciiArtInDocs')
    })
  })

  describe('countBoxDrawingChars', () => {
    it('counts box-drawing characters in a line', () => {
      expect(countBoxDrawingChars('┌───┐')).toBe(5)
    })

    it('returns 0 for line without box-drawing characters', () => {
      expect(countBoxDrawingChars('Hello world')).toBe(0)
    })

    it('counts mixed content correctly', () => {
      expect(countBoxDrawingChars('│ text │')).toBe(2)
    })

    it('counts double-line box characters', () => {
      expect(countBoxDrawingChars('╔═══╗')).toBe(5)
    })
  })

  describe('hasRightSideBoxChars', () => {
    it('detects right-side box characters', () => {
      expect(hasRightSideBoxChars('┌───┐')).toBe(true)
    })

    it('returns false for left-side only (directory tree)', () => {
      expect(hasRightSideBoxChars('├── index.ts')).toBe(false)
    })

    it('detects double-line right corners', () => {
      expect(hasRightSideBoxChars('╔═══╗')).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(hasRightSideBoxChars('Hello world')).toBe(false)
    })

    it('detects right connector', () => {
      expect(hasRightSideBoxChars('content ┤')).toBe(true)
    })
  })

  describe('hasTopLeftCorner', () => {
    it('detects top-left corner', () => {
      expect(hasTopLeftCorner('┌───')).toBe(true)
    })

    it('returns false when no top-left corner', () => {
      expect(hasTopLeftCorner('│ text │')).toBe(false)
    })

    it('detects double-line top-left corner', () => {
      expect(hasTopLeftCorner('╔═══')).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(hasTopLeftCorner('Hello world')).toBe(false)
    })
  })

  describe('isBoxDiagramLine', () => {
    it('identifies box diagram lines', () => {
      expect(isBoxDiagramLine('┌─────────────────────┐')).toBe(true)
    })

    it('identifies lines with vertical borders', () => {
      expect(isBoxDiagramLine('│─────────────────────│')).toBe(true)
    })

    it('rejects lines with too few box characters', () => {
      expect(isBoxDiagramLine('│x')).toBe(false)
    })

    it('rejects plain text', () => {
      expect(isBoxDiagramLine('Hello world')).toBe(false)
    })

    it('identifies horizontal border lines', () => {
      expect(isBoxDiagramLine('├─────────────────────┤')).toBe(true)
    })
  })

  describe('isBoxStructure', () => {
    it('identifies valid box structure', () => {
      const lines = ['┌─────────────────────┐', '│       line 1        │', '│       line 2        │', '└─────────────────────┘']
      expect(isBoxStructure(lines)).toBe(true)
    })

    it('rejects directory tree structures (no right-side chars)', () => {
      const lines = ['src/', '├── index.ts', '├── utils/', '│   └── helper.ts', '└── types.ts']
      expect(isBoxStructure(lines)).toBe(false)
    })

    it('rejects lines without enough vertical borders', () => {
      const lines = ['┌─────────────────────┐', 'plain text line', '└─────────────────────┘']
      expect(isBoxStructure(lines)).toBe(false)
    })

    it('identifies double-line box structure', () => {
      const lines = ['╔═════════════════════╗', '║       line 1        ║', '║       line 2        ║', '╚═════════════════════╝']
      expect(isBoxStructure(lines)).toBe(true)
    })
  })

  describe('detectAsciiArtDiagrams', () => {
    it('detects ASCII art in code blocks', () => {
      const content = createMarkdownWithAsciiArt()
      const blocks = detectAsciiArtDiagrams(content)
      expect(blocks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            startLine: 6,
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
        ])
      )
    })

    it('returns empty for content without ASCII art', () => {
      const content = createMarkdownWithCodeBlock()
      const blocks = detectAsciiArtDiagrams(content)
      expect(blocks).toHaveLength(0)
    })

    it('returns empty for mermaid diagrams', () => {
      const content = createMarkdownWithMermaid()
      const blocks = detectAsciiArtDiagrams(content)
      expect(blocks).toHaveLength(0)
    })

    it('does not flag simple directory trees', () => {
      const content = createMarkdownWithDirectoryTree()
      const blocks = detectAsciiArtDiagrams(content)
      expect(blocks).toHaveLength(0)
    })

    it('detects multiple AqSCII art blocks', () => {
      const content = `# Example

\`\`\`
┌─────────────────────┐
│       line 1        │
│       line 2        │
└─────────────────────┘
\`\`\`

Text between.

\`\`\`
┌─────────────────────┐
│       line 1        │
│       line 2        │
└─────────────────────┘
\`\`\`
`
      const blocks = detectAsciiArtDiagrams(content)
      expect(blocks).toHaveLength(2)
    })
  })

  describe('rule.create', () => {
    it('returns empty object for non-markdown files', () => {
      const context = {
        filename: '/project/src/index.ts',
        sourceCode: { getText: () => '' },
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toEqual({})
    })

    it('returns root listener for markdown files', () => {
      const context = {
        filename: '/project/README.md',
        sourceCode: { getText: () => createMarkdownWithMermaid() },
        report: jest.fn(),
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toHaveProperty('root')
    })

    it('reports ASCII art in README.md with readme-specific message', () => {
      const reportMock = jest.fn()
      const context = {
        filename: '/project/README.md',
        sourceCode: { getText: () => createMarkdownWithAsciiArt() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'noAsciiArtInReadme',
        })
      )
    })

    it('reports ASCII art in ARCHITECTURE.md with docs-specific message', () => {
      const reportMock = jest.fn()
      const context = {
        filename: '/project/ARCHITECTURE.md',
        sourceCode: { getText: () => createMarkdownWithAsciiArt() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'noAsciiArtInDocs',
        })
      )
    })

    it('does not report for valid mermaid content', () => {
      const reportMock = jest.fn()
      const context = {
        filename: '/project/ARCHITECTURE.md',
        sourceCode: { getText: () => createMarkdownWithMermaid() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('does not report for regular code blocks', () => {
      const reportMock = jest.fn()
      const context = {
        filename: '/project/README.md',
        sourceCode: { getText: () => createMarkdownWithCodeBlock() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('does not report for directory tree structures', () => {
      const reportMock = jest.fn()
      const context = {
        filename: '/project/README.md',
        sourceCode: { getText: () => createMarkdownWithDirectoryTree() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })
  })
})
