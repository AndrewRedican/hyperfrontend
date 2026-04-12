import { createTempWorkspaceManager, PUBLISHABLE_LIBRARY_PROJECT_JSON, NON_PUBLISHABLE_LIBRARY_PROJECT_JSON } from '../testing'
import rule, {
  detectUnlabeledCodeBlocks,
  hasLanguageIdentifier,
  isAtWorkspaceRoot,
  isCodeBlockStart,
  isInPublishableLibrary,
  RULE_NAME,
  shouldApplyRule,
} from './require-codeblock-language'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

/**
 * Creates markdown with a code block without a language.
 *
 * @returns Markdown content with an unlabeled code block.
 */
function createMarkdownWithUnlabeledCodeBlock(): string {
  return `# Example

Some text here.

\`\`\`
const x = 1
const y = 2
\`\`\`

More text.
`
}

/**
 * Creates markdown with a labeled typescript code block.
 *
 * @returns Markdown content with a labeled code block.
 */
function createMarkdownWithLabeledCodeBlock(): string {
  return `# Example

Some text here.

\`\`\`typescript
const x = 1
const y = 2
\`\`\`

More text.
`
}

/**
 * Creates markdown with multiple code blocks, some labeled and some not.
 *
 * @returns Markdown content with mixed labeled and unlabeled code blocks.
 */
function createMarkdownWithMixedCodeBlocks(): string {
  return `# Example

\`\`\`typescript
const x = 1
\`\`\`

Some text.

\`\`\`
unlabeled
\`\`\`

More text.

\`\`\`json
{ "key": "value" }
\`\`\`

\`\`\`
another unlabeled
\`\`\`
`
}

/**
 * Creates markdown with no code blocks.
 *
 * @returns Markdown content without any code blocks.
 */
function createMarkdownWithoutCodeBlocks(): string {
  return `# Example

Just some regular text without any code blocks.

- Item 1
- Item 2
`
}

describe('require-codeblock-language', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('require-codeblock-language')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('suggestion')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('require-codeblock-language')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingLanguage')
    })
  })

  describe('isCodeBlockStart', () => {
    it('returns true for triple backticks', () => {
      expect(isCodeBlockStart('```')).toBe(true)
    })

    it('returns true for triple backticks with language', () => {
      expect(isCodeBlockStart('```typescript')).toBe(true)
    })

    it('returns true for indented triple backticks', () => {
      expect(isCodeBlockStart('  ```')).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(isCodeBlockStart('Hello world')).toBe(false)
    })

    it('returns false for single backtick', () => {
      expect(isCodeBlockStart('`code`')).toBe(false)
    })

    it('returns false for double backticks', () => {
      expect(isCodeBlockStart('``code``')).toBe(false)
    })
  })

  describe('hasLanguageIdentifier', () => {
    it('returns true for backticks with language', () => {
      expect(hasLanguageIdentifier('```typescript')).toBe(true)
    })

    it('returns true for json language', () => {
      expect(hasLanguageIdentifier('```json')).toBe(true)
    })

    it('returns true for language with spaces before', () => {
      expect(hasLanguageIdentifier('  ```bash')).toBe(true)
    })

    it('returns false for empty backticks', () => {
      expect(hasLanguageIdentifier('```')).toBe(false)
    })

    it('returns false for backticks with only whitespace', () => {
      expect(hasLanguageIdentifier('```   ')).toBe(false)
    })

    it('returns false for non-backtick line', () => {
      expect(hasLanguageIdentifier('Hello world')).toBe(false)
    })

    it('returns true for mermaid', () => {
      expect(hasLanguageIdentifier('```mermaid')).toBe(true)
    })

    it('returns true for diff', () => {
      expect(hasLanguageIdentifier('```diff')).toBe(true)
    })

    it('returns true for text', () => {
      expect(hasLanguageIdentifier('```text')).toBe(true)
    })
  })

  describe('detectUnlabeledCodeBlocks', () => {
    it('detects unlabeled code blocks', () => {
      const content = createMarkdownWithUnlabeledCodeBlock()
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        startLine: 5,
        column: 0,
      })
    })

    it('returns empty for labeled code blocks', () => {
      const content = createMarkdownWithLabeledCodeBlock()
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(0)
    })

    it('returns empty for content without code blocks', () => {
      const content = createMarkdownWithoutCodeBlocks()
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(0)
    })

    it('detects multiple unlabeled code blocks', () => {
      const content = createMarkdownWithMixedCodeBlocks()
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(2)
      expect(blocks[0]?.startLine).toBe(9)
      expect(blocks[1]?.startLine).toBe(19)
    })

    it('handles nested backticks correctly', () => {
      const content = `# Example

\`\`\`markdown
# Nested example
\\\`\\\`\\\`
code
\\\`\\\`\\\`
\`\`\`
`
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(0)
    })

    it('handles code block at start of file', () => {
      const content = `\`\`\`
code
\`\`\`
`
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]?.startLine).toBe(1)
    })

    it('handles indented code blocks', () => {
      const content = `# Example

  \`\`\`
  code
  \`\`\`
`
      const blocks = detectUnlabeledCodeBlocks(content)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]?.column).toBe(2)
    })
  })

  describe('isAtWorkspaceRoot', () => {
    it('returns true for file at workspace root', () => {
      const workspace = manager.create({
        files: {
          'nx.json': '{}',
          'README.md': '# Test',
        },
      })

      expect(isAtWorkspaceRoot(workspace.getPath('README.md'))).toBe(true)
    })

    it('returns false for file in subdirectory', () => {
      const workspace = manager.create({
        files: {
          'nx.json': '{}',
          'libs/my-lib/README.md': '# Test',
        },
      })

      expect(isAtWorkspaceRoot(workspace.getPath('libs/my-lib/README.md'))).toBe(false)
    })
  })

  describe('isInPublishableLibrary', () => {
    it('returns true for file in publishable library', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'README.md': '# Test',
        },
      })

      expect(isInPublishableLibrary(workspace.getPath('README.md'))).toBe(true)
    })

    it('returns false for file in non-publishable library', () => {
      const workspace = manager.create({
        projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'README.md': '# Test',
        },
      })

      expect(isInPublishableLibrary(workspace.getPath('README.md'))).toBe(false)
    })
  })

  describe('shouldApplyRule', () => {
    it('returns false for non-markdown files', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'index.ts': 'export const foo = 1',
        },
      })

      expect(shouldApplyRule(workspace.getPath('index.ts'))).toBe(false)
    })

    it('returns true for markdown at workspace root', () => {
      const workspace = manager.create({
        files: {
          'nx.json': '{}',
          'ARCHITECTURE.md': '# Test',
        },
      })

      expect(shouldApplyRule(workspace.getPath('ARCHITECTURE.md'))).toBe(true)
    })

    it('returns true for markdown in publishable library', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'ARCHITECTURE.md': '# Test',
        },
      })

      expect(shouldApplyRule(workspace.getPath('ARCHITECTURE.md'))).toBe(true)
    })

    it('returns false for markdown in regular subdirectory', () => {
      const workspace = manager.create({
        files: {
          'nx.json': '{}',
          'docs/guide.md': '# Guide',
        },
      })

      expect(shouldApplyRule(workspace.getPath('docs/guide.md'))).toBe(false)
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

    it('returns empty object for non-applicable files', () => {
      const workspace = manager.create({
        files: {
          'docs/internal.md': '# Internal',
        },
      })

      const context = {
        filename: workspace.getPath('docs/internal.md'),
        sourceCode: { getText: () => createMarkdownWithUnlabeledCodeBlock() },
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toEqual({})
    })

    it('returns root listener for applicable markdown files', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'ARCHITECTURE.md': createMarkdownWithLabeledCodeBlock(),
        },
      })

      const context = {
        filename: workspace.getPath('ARCHITECTURE.md'),
        sourceCode: { getText: () => createMarkdownWithLabeledCodeBlock() },
        report: jest.fn(),
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toHaveProperty('root')
    })

    it('reports unlabeled code blocks', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'DOCS.md': createMarkdownWithUnlabeledCodeBlock(),
        },
      })

      const reportMock = jest.fn()
      const context = {
        filename: workspace.getPath('DOCS.md'),
        sourceCode: { getText: () => createMarkdownWithUnlabeledCodeBlock() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingLanguage',
          loc: expect.objectContaining({
            start: { line: 5, column: 0 },
          }),
        })
      )
    })

    it('reports multiple unlabeled code blocks', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'DOCS.md': createMarkdownWithMixedCodeBlocks(),
        },
      })

      const reportMock = jest.fn()
      const context = {
        filename: workspace.getPath('DOCS.md'),
        sourceCode: { getText: () => createMarkdownWithMixedCodeBlocks() },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledTimes(2)
    })

    it('does not report labeled code blocks', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: {
          'DOCS.md': createMarkdownWithLabeledCodeBlock(),
        },
      })

      const reportMock = jest.fn()
      const context = {
        filename: workspace.getPath('DOCS.md'),
        sourceCode: { getText: () => createMarkdownWithLabeledCodeBlock() },
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
