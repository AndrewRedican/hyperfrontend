import type { MarkdownNode } from './no-manual-table-of-contents'
import { after as afterAll } from 'node:test'
import markdown from '@eslint/markdown'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import rule, { headingText, isLibraryMarkdown, isTableOfContentsHeading, LIBRARIES_DIR, RULE_NAME } from './no-manual-table-of-contents'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

/** One traversal step handed out by the markdown source code object. */
interface TraversalStep {
  /** The node being entered or left. */
  target: MarkdownNode
  /** 1 on the way in, 2 on the way out. */
  phase: number
}

/** The parts of the parsed markdown document the tests drive. */
interface ParsedMarkdown {
  /** Walks the document, entering and leaving every node. */
  traverse: () => Iterable<TraversalStep>
}

/** The parts of the markdown language object the tests drive. */
interface MarkdownLanguageShim {
  /** Language options the parser falls back to. */
  defaultLanguageOptions: unknown
  /** Parses a virtual file into an mdast document. */
  parse: (file: unknown, context: unknown) => unknown
  /** Wraps a parse result in a source code object. */
  createSourceCode: (file: unknown, parseResult: unknown) => ParsedMarkdown
}

/** The shape of the report descriptors this rule produces. */
interface CapturedReport {
  /** The message identifier. */
  messageId: string
  /** The message interpolations. */
  data?: { heading: string }
}

type ListenerMap = Record<string, ((node: MarkdownNode) => void) | undefined>

const language = markdown.languages.gfm as unknown as MarkdownLanguageShim

// why: the rule scopes itself by where a file sits in the workspace, so one workspace with a library file and an app file covers both sides
const workspace = manager.create({
  files: {
    'nx.json': '{}',
    'libs/thing/ARCHITECTURE.md': '# Placeholder',
    'apps/site/README.md': '# Placeholder',
    'README.md': '# Placeholder',
  },
})

/**
 * Runs the rule over real markdown, driving the listeners it registers from the real mdast
 * traversal, so the AST path is the one under test.
 *
 * @param text - The markdown source.
 * @param filename - The file the markdown is linted as.
 * @returns Every problem the rule reported, in document order.
 */
function lintMarkdown(text: string, filename = workspace.getPath('libs/thing/ARCHITECTURE.md')): CapturedReport[] {
  const file = { path: filename, physicalPath: filename, body: text, bom: false }
  const parsed = language.createSourceCode(file, language.parse(file, { languageOptions: language.defaultLanguageOptions }))
  const reports: CapturedReport[] = []
  const context = { filename, options: [], sourceCode: parsed, report: (descriptor: CapturedReport) => reports.push(descriptor) }

  // @ts-expect-error - partial mock
  const listeners = rule.create(context) as unknown as ListenerMap
  for (const step of parsed.traverse()) {
    if (step.phase === 1) {
      listeners[step.target.type]?.(step.target)
    }
  }
  return reports
}

describe('no-manual-table-of-contents', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('no-manual-table-of-contents')
    })

    it('is a problem with no options', () => {
      expect(rule.meta?.type).toBe('problem')
      expect(rule.meta?.schema).toEqual([])
    })

    it('tells the reader why, what to do, and what not to do', () => {
      const message = rule.meta?.messages?.['manualTableOfContents'] ?? ''
      expect(message).toContain('documentation site generates on-page navigation')
      expect(message).toContain('remove the heading and the list under it')
      expect(message).toContain('rather than disabling this rule or hiding the section in the renderer')
      expect(keys(rule.meta?.messages ?? {})).toEqual(['manualTableOfContents'])
    })

    it('governs the libraries directory', () => {
      expect(LIBRARIES_DIR).toBe('libs')
    })
  })

  describe('isTableOfContentsHeading', () => {
    it('recognises the common permutations', () => {
      for (const heading of [
        'Table of Contents',
        'Table of contents',
        'TABLE OF CONTENTS',
        'Table Of Content',
        'Table of Contents:',
        'Contents',
        'Contents.',
        'Index',
        'TOC',
        'Document Index',
        'Quick Index',
        'Page Contents',
        'Section Contents',
        'Index of Contents',
        'In this document',
        'In this guide',
        '  Table   of  Contents  ',
      ]) {
        expect(isTableOfContentsHeading(heading)).toBe(true)
      }
    })

    it('leaves technical uses of the same words alone', () => {
      for (const heading of [
        'Index Signatures',
        'Indexing the cache',
        'The index entry',
        'Content',
        'Content Security Policy',
        'Content types',
        'Table layout',
        'Tables',
        'Search index format',
        'Contents of the envelope',
        'Overview',
        'API Reference',
      ]) {
        expect(isTableOfContentsHeading(heading)).toBe(false)
      }
    })
  })

  describe('headingText', () => {
    it('renders inline markup as its text', () => {
      const heading: MarkdownNode = {
        type: 'heading',
        depth: 2,
        children: [
          { type: 'text', value: 'Table of ' },
          { type: 'emphasis', children: [{ type: 'text', value: 'Contents' }] },
        ],
      }
      expect(headingText(heading)).toBe('Table of Contents')
    })

    it('renders a leaf with no value as nothing', () => {
      expect(headingText({ type: 'break' })).toBe('')
    })
  })

  describe('isLibraryMarkdown', () => {
    it('accepts markdown under libs and rejects markdown elsewhere', () => {
      expect(isLibraryMarkdown(workspace.getPath('libs/thing/ARCHITECTURE.md'))).toBe(true)
      expect(isLibraryMarkdown(workspace.getPath('apps/site/README.md'))).toBe(false)
      expect(isLibraryMarkdown(workspace.getPath('README.md'))).toBe(false)
    })

    it('rejects files that are not markdown, and files outside any workspace', () => {
      expect(isLibraryMarkdown(workspace.getPath('libs/thing/src/index.ts'))).toBe(false)
      expect(isLibraryMarkdown('/definitely/not/a/workspace/libs/x/README.md')).toBe(false)
    })
  })

  describe('linting', () => {
    it('reports a table-of-contents heading at any level, naming it', () => {
      const reports = lintMarkdown(
        ['# Title', '', '## Table of Contents', '', '1. [A](#a)', '', '### Index', '', '#### Contents', '', '## A'].join('\n')
      )
      expect(reports.map((report) => report.data?.heading)).toEqual(['Table of Contents', 'Index', 'Contents'])
      expect(reports.every((report) => report.messageId === 'manualTableOfContents')).toBe(true)
    })

    it('reads headings structurally, so a list or prose mentioning the words is not a heading', () => {
      const reports = lintMarkdown(
        [
          '# Title',
          '',
          'See the table of contents above. The index is rebuilt nightly.',
          '',
          '- Contents',
          '',
          '```md',
          '## Contents',
          '```',
        ].join('\n')
      )
      expect(reports).toEqual([])
    })

    it('leaves technical headings alone', () => {
      expect(lintMarkdown(['## Index Signatures', '', '## Content Security Policy', '', '## Indexing'].join('\n'))).toEqual([])
    })

    it('does nothing outside the libraries directory', () => {
      expect(lintMarkdown('## Table of Contents', workspace.getPath('apps/site/README.md'))).toEqual([])
      expect(lintMarkdown('## Table of Contents', workspace.getPath('README.md'))).toEqual([])
    })
  })
})
