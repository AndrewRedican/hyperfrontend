import type { MarkdownNode, MarkdownPosition, ReadmeParagraphLengthOptions } from './readme-paragraph-length'
import { after as afterAll } from 'node:test'
import markdown from '@eslint/markdown'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempWorkspaceManager, NON_PUBLISHABLE_LIBRARY_PROJECT_JSON, PUBLISHABLE_LIBRARY_PROJECT_JSON } from '../testing'
import rule, {
  collapseWhitespace,
  DEFAULT_MAX_CHARACTERS,
  isAtWorkspaceRoot,
  isInPublishableLibrary,
  isInsideSkippedContainer,
  measureParagraph,
  renderProse,
  RULE_NAME,
  shouldApplyRule,
} from './readme-paragraph-length'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

/**
 * One traversal step handed out by the markdown source code object.
 */
interface TraversalStep {
  /** The node being entered or left. */
  target: MarkdownNode
  /** 1 on the way in, 2 on the way out. */
  phase: number
}

/**
 * The parts of the parsed markdown document the tests drive.
 */
interface ParsedMarkdown {
  /** Walks the document, entering and leaving every node. */
  traverse: () => Iterable<TraversalStep>
  /** Returns a node's ancestors, outermost first. */
  getAncestors: (node: MarkdownNode) => MarkdownNode[]
}

/**
 * The parts of the markdown language object the tests drive.
 */
interface MarkdownLanguageShim {
  /** Language options the parser falls back to. */
  defaultLanguageOptions: unknown
  /** Parses a virtual file into an mdast document. */
  parse: (file: unknown, context: unknown) => unknown
  /** Wraps a parse result in a source code object. */
  createSourceCode: (file: unknown, parseResult: unknown) => ParsedMarkdown
}

/**
 * The interpolations the rule puts in its message.
 */
interface ReportData {
  /** Rendered character count the rule measured, as text. */
  characters: string
  /** Threshold the rule compared against, as text. */
  maximum: string
}

/**
 * The shape of the report descriptors this rule produces.
 */
interface CapturedReport {
  /** The message identifier. */
  messageId: string
  /** The reported source range, absent when the node carried no position. */
  loc?: MarkdownPosition
  /** The message interpolations. */
  data?: ReportData
}

type ListenerMap = Record<string, ((node: MarkdownNode) => void) | undefined>

const language = markdown.languages.gfm as unknown as MarkdownLanguageShim

const publishableWorkspace = manager.create({
  projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
  files: { 'README.md': '# Placeholder' },
})

/**
 * Parses markdown with the same language object ESLint uses at runtime.
 *
 * @param text - The markdown source.
 * @returns The parsed document.
 */
function parseMarkdown(text: string): ParsedMarkdown {
  const file = { path: 'README.md', physicalPath: 'README.md', body: text, bom: false }
  const parseResult = language.parse(file, { languageOptions: language.defaultLanguageOptions })
  return language.createSourceCode(file, parseResult)
}

/**
 * Runs the rule over real markdown, driving the listeners it registers from the real mdast
 * traversal, so the AST path is the one under test.
 *
 * @param text - The markdown source.
 * @param options - Rule options, if any.
 * @param withAncestry - False to hide `getAncestors` and exercise the container-tracking fallback.
 * @returns Every problem the rule reported, in document order.
 */
function lintMarkdown(text: string, options?: ReadmeParagraphLengthOptions, withAncestry = true): CapturedReport[] {
  const parsed = parseMarkdown(text)
  const reports: CapturedReport[] = []

  const context = {
    filename: publishableWorkspace.getPath('README.md'),
    options: options ? [options] : [],
    sourceCode: withAncestry ? parsed : { getText: () => text },
    report: (descriptor: CapturedReport) => reports.push(descriptor),
  }

  // @ts-expect-error - partial mock
  const listeners = rule.create(context) as unknown as ListenerMap

  for (const step of parsed.traverse()) {
    const key = step.phase === 1 ? step.target.type : `${step.target.type}:exit`
    listeners[key]?.(step.target)
  }

  return reports
}

/**
 * Builds a paragraph of ordinary prose with an exact rendered length and no trailing space.
 *
 * @param characters - How many rendered characters the paragraph should carry.
 * @returns A single-line paragraph of that exact length.
 */
function prose(characters: number): string {
  let text = ''

  while (text.length < characters) {
    text += 'measure '
  }

  return text.slice(0, characters).trim().padEnd(characters, 'x')
}

const LONG = prose(760)
const SHORT = prose(120)

describe('readme-paragraph-length', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('readme-paragraph-length')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('suggestion')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('readme-paragraph-length')
    })

    it('declares the paragraphTooLong message', () => {
      expect(keys(rule.meta?.messages ?? {})).toContain('paragraphTooLong')
    })

    it('names both placeholders in the message', () => {
      const message = rule.meta?.messages?.['paragraphTooLong'] ?? ''
      expect(message).toContain('{{characters}}')
      expect(message).toContain('{{maximum}}')
    })

    it('asks for clearer prose rather than an arbitrary break', () => {
      expect(rule.meta?.messages?.['paragraphTooLong']).toContain('Prefer clearer prose over an arbitrary break.')
    })

    it('accepts a maxCharacters option', () => {
      const schema = rule.meta?.schema as Array<Record<string, unknown>>
      const properties = schema[0]?.['properties'] as Record<string, unknown>
      expect(keys(properties)).toEqual(['maxCharacters'])
    })

    it('defaults the threshold to 700', () => {
      expect(DEFAULT_MAX_CHARACTERS).toBe(700)
    })
  })

  describe('renderProse', () => {
    it('returns the value of a text node', () => {
      expect(renderProse({ type: 'text', value: 'hello' })).toBe('hello')
    })

    it('returns an empty string for a text node with no value', () => {
      expect(renderProse({ type: 'text' })).toBe('')
    })

    it('counts inline code as prose', () => {
      expect(renderProse({ type: 'inlineCode', value: 'createShell()' })).toBe('createShell()')
    })

    it('counts only the text of a link, never its url', () => {
      const link: MarkdownNode = {
        type: 'link',
        value: 'https://example.com/a/very/long/target/that/should/not/count/at/all',
        children: [{ type: 'text', value: 'the docs' }],
      }
      expect(renderProse(link)).toBe('the docs')
    })

    it('counts only the text of a link reference', () => {
      expect(renderProse({ type: 'linkReference', children: [{ type: 'text', value: 'see this' }] })).toBe('see this')
    })

    it('gives an image no width', () => {
      expect(renderProse({ type: 'image', value: 'hero.gif' })).toBe('')
    })

    it('gives an image reference no width', () => {
      expect(renderProse({ type: 'imageReference', children: [{ type: 'text', value: 'alt text' }] })).toBe('')
    })

    it('gives inline html no width', () => {
      expect(renderProse({ type: 'html', value: '<kbd>' })).toBe('')
    })

    it('gives a hard break no width', () => {
      expect(renderProse({ type: 'break' })).toBe('')
    })

    it('recurses into emphasis', () => {
      expect(renderProse({ type: 'emphasis', children: [{ type: 'text', value: 'quietly' }] })).toBe('quietly')
    })

    it('recurses into strong', () => {
      expect(renderProse({ type: 'strong', children: [{ type: 'text', value: 'loudly' }] })).toBe('loudly')
    })

    it('recurses into strikethrough', () => {
      expect(renderProse({ type: 'delete', children: [{ type: 'text', value: 'gone' }] })).toBe('gone')
    })

    it('recurses into a parent node it does not recognise', () => {
      expect(renderProse({ type: 'footnote', children: [{ type: 'text', value: 'aside' }] })).toBe('aside')
    })

    it('returns an empty string for a childless node it does not recognise', () => {
      expect(renderProse({ type: 'footnoteReference' })).toBe('')
    })

    it('joins the children of a paragraph in order', () => {
      const paragraph: MarkdownNode = {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Call ' },
          { type: 'inlineCode', value: 'open()' },
          { type: 'text', value: ' first.' },
        ],
      }
      expect(renderProse(paragraph)).toBe('Call open() first.')
    })
  })

  describe('collapseWhitespace', () => {
    it('collapses a run of spaces', () => {
      expect(collapseWhitespace('a    b')).toBe('a b')
    })

    it('collapses the newlines of a wrapped paragraph', () => {
      expect(collapseWhitespace('one\ntwo\nthree')).toBe('one two three')
    })

    it('trims the ends', () => {
      expect(collapseWhitespace('  padded  ')).toBe('padded')
    })

    it('leaves a single-spaced sentence alone', () => {
      expect(collapseWhitespace('already tidy')).toBe('already tidy')
    })
  })

  describe('measureParagraph', () => {
    it('measures rendered characters', () => {
      expect(measureParagraph({ type: 'paragraph', children: [{ type: 'text', value: 'four' }] })).toBe(4)
    })

    it('measures a wrapped paragraph the same as a single line', () => {
      const wrapped: MarkdownNode = { type: 'paragraph', children: [{ type: 'text', value: 'one\ntwo\nthree' }] }
      const flat: MarkdownNode = { type: 'paragraph', children: [{ type: 'text', value: 'one two three' }] }
      expect(measureParagraph(wrapped)).toBe(measureParagraph(flat))
    })
  })

  describe('isInsideSkippedContainer', () => {
    it('treats a paragraph inside a list item as exempt', () => {
      expect(isInsideSkippedContainer([{ type: 'root' }, { type: 'list' }, { type: 'listItem' }])).toBe(true)
    })

    it('treats a paragraph inside a blockquote as exempt', () => {
      expect(isInsideSkippedContainer([{ type: 'root' }, { type: 'blockquote' }])).toBe(true)
    })

    it('treats a paragraph inside a table cell as exempt', () => {
      expect(isInsideSkippedContainer([{ type: 'root' }, { type: 'table' }, { type: 'tableRow' }, { type: 'tableCell' }])).toBe(true)
    })

    it('treats a paragraph inside a footnote definition as exempt', () => {
      expect(isInsideSkippedContainer([{ type: 'root' }, { type: 'footnoteDefinition' }])).toBe(true)
    })

    it('treats a top-level paragraph as body prose', () => {
      expect(isInsideSkippedContainer([{ type: 'root' }])).toBe(false)
    })

    it('treats an empty ancestry as body prose', () => {
      expect(isInsideSkippedContainer([])).toBe(false)
    })
  })

  describe('isAtWorkspaceRoot', () => {
    it('returns true for a file in the workspace root directory', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'README.md': '# Test' } })
      expect(isAtWorkspaceRoot(workspace.getPath('README.md'))).toBe(true)
    })

    it('returns false for a file in a subdirectory', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'docs/guide.md': '# Test' } })
      expect(isAtWorkspaceRoot(workspace.getPath('docs/guide.md'))).toBe(false)
    })

    it('returns false when no workspace root can be found', () => {
      expect(isAtWorkspaceRoot('/readme-paragraph-length-nowhere.md')).toBe(false)
    })
  })

  describe('isInPublishableLibrary', () => {
    it('returns true for the readme of a publishable library', () => {
      const workspace = manager.create({ projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON, files: { 'README.md': '# Test' } })
      expect(isInPublishableLibrary(workspace.getPath('README.md'))).toBe(true)
    })

    it('returns true for a readme nested inside a publishable library', () => {
      const workspace = manager.create({
        projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
        files: { 'src/host/README.md': '# Test' },
      })
      expect(isInPublishableLibrary(workspace.getPath('src/host/README.md'))).toBe(true)
    })

    it('returns false for a library that is not published', () => {
      const workspace = manager.create({ projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON, files: { 'README.md': '# Test' } })
      expect(isInPublishableLibrary(workspace.getPath('README.md'))).toBe(false)
    })

    it('returns false when no project owns the file', () => {
      expect(isInPublishableLibrary('/readme-paragraph-length-nowhere.md')).toBe(false)
    })
  })

  describe('shouldApplyRule', () => {
    it('returns false for a file that is not markdown', () => {
      const workspace = manager.create({ projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON, files: { 'src/index.ts': 'export const a = 1' } })
      expect(shouldApplyRule(workspace.getPath('src/index.ts'))).toBe(false)
    })

    it('returns true for markdown at the workspace root', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'ARCHITECTURE.md': '# Test' } })
      expect(shouldApplyRule(workspace.getPath('ARCHITECTURE.md'))).toBe(true)
    })

    it('returns true for markdown in a publishable library', () => {
      const workspace = manager.create({ projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON, files: { 'GUIDE.md': '# Test' } })
      expect(shouldApplyRule(workspace.getPath('GUIDE.md'))).toBe(true)
    })

    it('returns false for markdown in an unrelated subdirectory', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'docs/guide.md': '# Guide' } })
      expect(shouldApplyRule(workspace.getPath('docs/guide.md'))).toBe(false)
    })
  })

  describe('rule.create', () => {
    it('registers nothing for a file outside the rule scope', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'docs/internal.md': '# Internal' } })
      const context = { filename: workspace.getPath('docs/internal.md'), options: [], sourceCode: { getText: () => '' } }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toEqual({})
    })

    it('registers a paragraph visitor for a file in scope', () => {
      const context = {
        filename: publishableWorkspace.getPath('README.md'),
        options: [],
        sourceCode: { getAncestors: () => [], getText: () => '' },
        report: jest.fn(),
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toHaveProperty('paragraph')
    })

    it('reports a paragraph that carries no position without a range', () => {
      const reports: CapturedReport[] = []
      const context = {
        filename: publishableWorkspace.getPath('README.md'),
        options: [],
        sourceCode: { getAncestors: () => [{ type: 'root' }] },
        report: (descriptor: CapturedReport) => reports.push(descriptor),
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context) as unknown as ListenerMap
      listener['paragraph']?.({ type: 'paragraph', children: [{ type: 'text', value: LONG }] })

      expect(reports).toHaveLength(1)
      expect(reports[0]?.loc).toBeUndefined()
      expect(reports[0]?.messageId).toBe('paragraphTooLong')
      expect(reports[0]?.data?.characters).toBe('760')
    })
  })

  describe('measuring real markdown', () => {
    it('reports a paragraph past the default threshold', () => {
      const reports = lintMarkdown(`# Title\n\n${LONG}\n`)
      expect(reports).toHaveLength(1)
      expect(reports[0]?.messageId).toBe('paragraphTooLong')
      expect(reports[0]?.data?.characters).toBe('760')
      expect(reports[0]?.data?.maximum).toBe('700')
    })

    it('reports the paragraph at its own position, not line one', () => {
      const reports = lintMarkdown(`# Title\n\nA short opening.\n\n${LONG}\n`)
      expect(reports[0]?.loc?.start.line).toBe(5)
      expect(reports[0]?.loc?.start.column).toBe(0)
      expect(reports[0]?.loc?.end.line).toBe(5)
    })

    it('does not report ordinary prose', () => {
      expect(lintMarkdown(`# Title\n\n${SHORT}\n`)).toEqual([])
    })

    it('does not report a paragraph sitting exactly on the threshold', () => {
      expect(lintMarkdown(`${prose(700)}\n`)).toEqual([])
    })

    it('reports a paragraph one character past the threshold', () => {
      const reports = lintMarkdown(`${prose(701)}\n`)
      expect(reports).toHaveLength(1)
      expect(reports[0]?.data?.characters).toBe('701')
    })

    it('measures a wrapped paragraph the same as an unwrapped one', () => {
      const reports = lintMarkdown(`${LONG.split(' ').join('\n')}\n`)
      expect(reports).toHaveLength(1)
      expect(reports[0]?.data?.characters).toBe('760')
    })

    it('does not let a long url push a paragraph over the line', () => {
      const url = `https://www.hyperfrontend.dev/${'segment/'.repeat(40)}page`
      expect(lintMarkdown(`${prose(600)} [the reference](${url}).\n`)).toEqual([])
    })

    it('does not count an image', () => {
      expect(lintMarkdown(`${prose(600)} ![${prose(300)}](hero.gif)\n`)).toEqual([])
    })

    it('does not count inline html', () => {
      expect(lintMarkdown(`${prose(650)} <span data-note="${prose(300)}"></span>\n`)).toEqual([])
    })

    it('counts inline code as prose', () => {
      const reports = lintMarkdown(`${prose(600)} \`${prose(150)}\`\n`)
      expect(reports).toHaveLength(1)
      expect(reports[0]?.data?.characters).toBe('751')
    })

    it('counts emphasised and bold runs as prose', () => {
      const reports = lintMarkdown(`${prose(600)} **${prose(80)}** _${prose(80)}_\n`)
      expect(reports).toHaveLength(1)
      expect(reports[0]?.data?.characters).toBe('762')
    })

    it('reports every offending paragraph in a file', () => {
      const reports = lintMarkdown(`${LONG}\n\n${SHORT}\n\n${prose(900)}\n`)
      expect(reports).toHaveLength(2)
      expect(reports[0]?.data?.characters).toBe('760')
      expect(reports[1]?.data?.characters).toBe('900')
    })
  })

  describe('containers the rule leaves alone', () => {
    it('ignores a paragraph inside a list item', () => {
      expect(lintMarkdown(`- ${LONG}\n`)).toEqual([])
    })

    it('ignores a paragraph nested under a list item', () => {
      expect(lintMarkdown(`1. Step one\n\n   ${LONG}\n`)).toEqual([])
    })

    it('ignores a paragraph inside a blockquote', () => {
      expect(lintMarkdown(`> ${LONG}\n`)).toEqual([])
    })

    it('ignores a paragraph inside a footnote definition', () => {
      expect(lintMarkdown(`A claim.[^1]\n\n[^1]: ${LONG}\n`)).toEqual([])
    })

    it('ignores a long table cell', () => {
      expect(lintMarkdown(`| Option | Description |\n| --- | --- |\n| \`mode\` | ${LONG} |\n`)).toEqual([])
    })

    it('still reports body prose that follows an exempt container', () => {
      expect(lintMarkdown(`- ${LONG}\n\n${LONG}\n`)).toHaveLength(1)
    })
  })

  describe('block types that are never prose', () => {
    it('ignores a fenced code block', () => {
      expect(lintMarkdown(`\`\`\`typescript\n// ${LONG}\n\`\`\`\n`)).toEqual([])
    })

    it('ignores a mermaid block whose content reads like prose', () => {
      const nodes = `  A[${prose(300)}] --> B[${prose(300)}]\n  B --> C[${prose(300)}]`
      expect(lintMarkdown(`\`\`\`mermaid\nflowchart TD\n${nodes}\n\`\`\`\n`)).toEqual([])
    })

    it('ignores an indented code block', () => {
      expect(lintMarkdown(`Intro:\n\n    ${LONG}\n`)).toEqual([])
    })

    it('ignores a heading', () => {
      expect(lintMarkdown(`# ${LONG}\n`)).toEqual([])
    })

    it('ignores a table', () => {
      expect(lintMarkdown(`| ${prose(400)} | ${prose(400)} |\n| --- | --- |\n| ${prose(400)} | ${prose(400)} |\n`)).toEqual([])
    })

    it('ignores a thematic break', () => {
      expect(lintMarkdown(`Before.\n\n---\n\nAfter.\n`)).toEqual([])
    })

    it('ignores the html badge block a library readme opens with', () => {
      const badge = `  <a href="https://www.npmjs.com/package/@hyperfrontend/features">\n    <img alt="${prose(400)}" src="https://img.shields.io/npm/v/@hyperfrontend/features">\n  </a>`
      expect(lintMarkdown(`<p align="center">\n${badge}\n${badge}\n</p>\n`)).toEqual([])
    })

    it('ignores a link reference definition with a very long target', () => {
      expect(lintMarkdown(`[docs]: https://www.hyperfrontend.dev/${'segment/'.repeat(120)}page\n`)).toEqual([])
    })
  })

  describe('the maxCharacters option', () => {
    it('reports against a lowered threshold', () => {
      const reports = lintMarkdown(`${prose(200)}\n`, { maxCharacters: 150 })
      expect(reports).toHaveLength(1)
      expect(reports[0]?.data?.maximum).toBe('150')
      expect(reports[0]?.data?.characters).toBe('200')
    })

    it('stays quiet under a raised threshold', () => {
      expect(lintMarkdown(`${prose(900)}\n`, { maxCharacters: 1000 })).toEqual([])
    })

    it('falls back to the default when the option object is empty', () => {
      expect(lintMarkdown(`${LONG}\n`, {})[0]?.data?.maximum).toBe('700')
    })
  })

  describe('without an ancestry reader', () => {
    it('reports body prose', () => {
      expect(lintMarkdown(`${LONG}\n`, undefined, false)).toHaveLength(1)
    })

    it('ignores a paragraph inside a list item', () => {
      expect(lintMarkdown(`- ${LONG}\n`, undefined, false)).toEqual([])
    })

    it('ignores a paragraph inside a blockquote', () => {
      expect(lintMarkdown(`> ${LONG}\n`, undefined, false)).toEqual([])
    })

    it('ignores a paragraph inside a footnote definition', () => {
      expect(lintMarkdown(`A claim.[^1]\n\n[^1]: ${LONG}\n`, undefined, false)).toEqual([])
    })

    it('reports body prose again once the container has closed', () => {
      expect(lintMarkdown(`- ${LONG}\n\n${LONG}\n`, undefined, false)).toHaveLength(1)
    })
  })
})
