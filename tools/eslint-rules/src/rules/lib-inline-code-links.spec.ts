import type { TempWorkspace } from '../testing'
import type { MarkdownNode } from './lib-inline-code-links'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import markdown from '@eslint/markdown'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import { resetDocsTargetIndex } from '../utils/docs-targets'
import rule, { collectInlineCode, DEFAULT_DOCS_SITE_ROOT, DEFAULT_SITE_URL, RULE_NAME } from './lib-inline-code-links'

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
  /** Reads a node's source text. */
  getText: (node: MarkdownNode) => string
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

/** The fixer handed to a report's `fix`. */
interface Fixer {
  /** Replaces a node's text. */
  replaceText: (node: MarkdownNode, text: string) => { text: string }
}

/**
 * The shape of the report descriptors this rule produces.
 */
interface CapturedReport {
  /** The message identifier. */
  messageId: string
  /** The message interpolations. */
  data?: Record<string, string>
  /** The fix, when the report carries one. */
  fix?: (fixer: Fixer) => { text: string }
}

type ListenerMap = Record<string, ((node: MarkdownNode) => void) | undefined>

const language = markdown.languages.gfm as unknown as MarkdownLanguageShim

const manager = createTempWorkspaceManager()

afterAll(() => {
  manager.cleanupAll()
})

/** A publishable library manifest. */
const PUBLISHABLE = { projectType: 'library', targets: { build: {}, publish: {} } }

/**
 * Lays out a workspace with one publishable package and the site pages that
 * document it.
 *
 * @returns The temporary workspace, cleaned up after the file's tests.
 */
function createWorkspace(): TempWorkspace {
  return manager.create({
    files: {
      'nx.json': '{}',
      'package.json': stringify({ name: 'workspace', repository: { url: 'git+https://github.com/acme/repo.git' } }),
      'libs/alpha/project.json': stringify(PUBLISHABLE),
      'libs/alpha/package.json': stringify({ name: '@acme/alpha', exports: { '.': './src/index.js', './host': './src/host/index.js' } }),
      'libs/alpha/src/index.ts': "export type { Options } from './types'\nexport { validate } from './validate'\n",
      'libs/alpha/src/types.ts': 'export interface Options {\n  onDrop?: () => void\n  status: string\n}\n',
      'libs/alpha/src/validate.ts': 'export function validate(): void {}\nfunction helper(): void {}\n',
      'libs/alpha/src/host/index.ts': "export { createShell } from './create-shell'\n",
      'libs/alpha/src/host/create-shell.ts': 'export function createShell(): void {}\n',
      'libs/alpha/src/host/README.md': '# Host\n',
      'libs/alpha/README.md': '# @acme/alpha\n\n## Quick Start\n',
      'libs/alpha/CHANGELOG.md': '# Changelog\n\n- `createShell` added\n',
      'libs/beta/project.json': stringify(PUBLISHABLE),
      'libs/beta/package.json': stringify({ name: '@acme/beta', exports: { '.': './src/index.js' } }),
      'libs/beta/src/index.ts': "export { logger } from './logger'\n",
      'libs/beta/src/logger.ts': 'export function logger(): void {}\n',
      'libs/private/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
      'libs/private/package.json': stringify({ name: '@acme/private' }),
      'libs/private/README.md': '# private\n\n`createShell`\n',
      'apps/docs-site/src/app/docs/libraries/alpha/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/host/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/beta/page.tsx': '',
      'apps/docs-site/src/app/docs/core-concepts/page.tsx': '',
    },
  })
}

/**
 * Runs the rule over real markdown, driving the listeners it registers from
 * the real mdast traversal, so the AST path is the one under test.
 *
 * @param text - The markdown source.
 * @param filename - The absolute path the markdown is linted as.
 * @param options - Rule options, if any.
 * @returns Every problem the rule reported, in document order.
 */
function lintMarkdown(text: string, filename: string, options?: Record<string, string>): CapturedReport[] {
  const file = { path: filename, physicalPath: filename, body: text, bom: false }
  const parsed = language.createSourceCode(file, language.parse(file, { languageOptions: language.defaultLanguageOptions }))
  const reports: CapturedReport[] = []

  const context = {
    filename,
    options: options ? [options] : [],
    sourceCode: parsed,
    report: (descriptor: CapturedReport) => reports.push(descriptor),
  }

  // @ts-expect-error - partial mock
  const listeners = rule.create(context) as unknown as ListenerMap

  for (const step of parsed.traverse()) {
    if (step.phase === 1) listeners[step.target.type]?.(step.target)
  }

  return reports
}

/**
 * Applies a report's fix to a document, for a test that checks what the fixer writes.
 *
 * @param report - The report carrying the fix.
 * @param text - The document the fix applies to.
 * @returns The replacement text the fixer produced.
 */
function fixed(report: CapturedReport, text: string): string {
  const file = { path: 'README.md', physicalPath: 'README.md', body: text, bom: false }
  const parsed = language.createSourceCode(file, language.parse(file, { languageOptions: language.defaultLanguageOptions }))
  return report.fix?.({ replaceText: (node, replacement) => ({ text: `${parsed.getText(node)} -> ${replacement}` }) })?.text ?? ''
}

describe('lib-inline-code-links', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('lib-inline-code-links')
    })

    it('is a fixable problem', () => {
      expect(rule.meta?.type).toBe('problem')
      expect(rule.meta?.fixable).toBe('code')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('lib-inline-code-links')
    })

    it('declares one message per outcome', () => {
      expect(keys(rule.meta?.messages ?? {})).toEqual([
        'unlinkedResolved',
        'unlinkedAmbiguous',
        'unlinkedElsewhere',
        'unlinkedUnknown',
        'brokenLink',
      ])
    })

    it('tells the author to link the mention or write it as prose in every unlinked message', () => {
      for (const id of ['unlinkedResolved', 'unlinkedAmbiguous', 'unlinkedElsewhere', 'unlinkedUnknown']) {
        expect(rule.meta?.messages?.[id]).toContain('write it as plain prose instead')
      }
    })

    it('publishes under the site by default and reads the site from apps/docs-site', () => {
      expect(DEFAULT_SITE_URL).toBe('https://www.hyperfrontend.dev')
      expect(DEFAULT_DOCS_SITE_ROOT).toBe('apps/docs-site')
    })
  })

  describe('collectInlineCode', () => {
    it('gathers every inline code node beneath a node', () => {
      const code = { type: 'inlineCode', value: 'a' }
      const nested = { type: 'inlineCode', value: 'b' }
      const tree: MarkdownNode = { type: 'link', children: [code, { type: 'strong', children: [nested] }, { type: 'text' }] }

      expect([...collectInlineCode(tree)]).toEqual([code, nested])
    })
  })

  describe('scope', () => {
    it('ignores files that are not markdown, the changelog, and markdown outside a publishable package', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()

      expect(lintMarkdown('`createShell`', join(workspace.root, 'libs/alpha/README.txt'))).toEqual([])
      expect(lintMarkdown('`createShell`', join(workspace.root, 'libs/alpha/CHANGELOG.md'))).toEqual([])
      expect(lintMarkdown('`createShell`', join(workspace.root, 'libs/private/README.md'))).toEqual([])
      expect(lintMarkdown('`createShell`', join(workspace.root, 'README.md'))).toEqual([])
    })

    it('ignores markdown that sits under no workspace at all', () => {
      const loose = manager.create({ files: { 'libs/alpha/README.md': '# x\n' } })

      expect(lintMarkdown('`createShell`', join(loose.root, 'libs/alpha/README.md'))).toEqual([])
    })

    it('leaves headings, fenced code and values alone', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const text =
        '## The `createShell` factory\n\n```ts\ncreateShell()\n```\n\nPass `true`, run `npx cz`, ship `index.esm.js`, set `--root`.\n'

      expect(lintMarkdown(text, join(workspace.root, 'libs/alpha/README.md'))).toEqual([])
    })
  })

  describe('unlinked mentions', () => {
    it('reports a resolvable name with the destination and a fix that links it', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const text = 'Hand `createShell` a URL.\n'
      const reports = lintMarkdown(text, join(workspace.root, 'libs/alpha/README.md'))

      expect(reports).toHaveLength(1)
      expect(reports[0]).toMatchObject({
        messageId: 'unlinkedResolved',
        data: { code: 'createShell', what: 'the symbol', url: 'https://www.hyperfrontend.dev/docs/libraries/alpha/host/#api-createShell' },
      })
      expect(fixed(reports[0] as CapturedReport, text)).toBe(
        '`createShell` -> [`createShell`](https://www.hyperfrontend.dev/docs/libraries/alpha/host/#api-createShell)'
      )
    })

    it('names the parent of a member and anchors a property on its own line', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const reports = lintMarkdown('Set `onDrop`.\n', join(workspace.root, 'libs/alpha/README.md'))

      expect(reports[0]).toMatchObject({
        messageId: 'unlinkedResolved',
        data: {
          code: 'onDrop',
          what: 'its parent, Options,',
          url: 'https://www.hyperfrontend.dev/docs/libraries/alpha/#api-Options-prop-onDrop',
        },
      })
    })

    it('publishes under the configured site and reads the site project from the configured root', () => {
      const workspace = createWorkspace()
      workspace.writeFile('site/src/app/docs/libraries/alpha/host/page.tsx', '')
      resetDocsTargetIndex()
      const reports = lintMarkdown('`createShell`\n', join(workspace.root, 'libs/alpha/README.md'), {
        siteUrl: 'https://docs.example/',
        docsSiteRoot: 'site',
      })

      expect(reports[0]?.data?.['url']).toBe('https://docs.example/docs/libraries/alpha/host/#api-createShell')
    })

    it('lists the candidates of a name documented in more than one place without a fix', () => {
      const workspace = createWorkspace()
      workspace.writeFile(
        'libs/alpha/src/types.ts',
        'export interface Options {\n  status: string\n}\nexport interface Other {\n  status: number\n}\n'
      )
      workspace.writeFile('libs/alpha/src/index.ts', "export type { Options, Other } from './types'\n")
      resetDocsTargetIndex()
      const reports = lintMarkdown('The `status`.\n', join(workspace.root, 'libs/alpha/README.md'))

      expect(reports[0]).toMatchObject({ messageId: 'unlinkedAmbiguous', data: { code: 'status' } })
      expect(reports[0]?.data?.['candidates']).toContain('\n    Options: https://www.hyperfrontend.dev/docs/libraries/alpha/#api-Options')
      expect(reports[0]?.data?.['candidates']).toContain('\n    Other: https://www.hyperfrontend.dev/docs/libraries/alpha/#api-Other')
      expect(reports[0]?.fix).toBeUndefined()
    })

    it("offers another package's documentation without applying it", () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const reports = lintMarkdown('Use `logger`.\n', join(workspace.root, 'libs/alpha/README.md'))

      expect(reports[0]).toMatchObject({
        messageId: 'unlinkedElsewhere',
        data: { code: 'logger', candidates: '\n    @acme/beta: https://www.hyperfrontend.dev/docs/libraries/beta/#api-logger' },
      })
      expect(reports[0]?.fix).toBeUndefined()
    })

    it('links a declared but unexported name to its source file', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const reports = lintMarkdown('Internally `helper` runs.\n', join(workspace.root, 'libs/alpha/README.md'))

      expect(reports[0]).toMatchObject({
        messageId: 'unlinkedResolved',
        data: { code: 'helper', what: 'the declaration', url: 'https://github.com/acme/repo/blob/main/libs/alpha/src/validate.ts' },
      })
    })

    it('reports a name nothing declares', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const reports = lintMarkdown('Call `frobnicate`.\n', join(workspace.root, 'libs/alpha/README.md'))

      expect(reports).toEqual([expect.objectContaining({ messageId: 'unlinkedUnknown', data: { code: 'frobnicate' } })])
    })

    it('reports every mention, including those in tables, emphasis and list items', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const text = '| A | B |\n| - | - |\n| `validate` | **`createShell`** |\n\n- _`validate`_\n'
      const reports = lintMarkdown(text, join(workspace.root, 'libs/alpha/README.md'))

      expect(reports.map((report) => report.data?.['code'])).toEqual(['validate', 'createShell', 'validate'])
    })
  })

  describe('linked mentions', () => {
    it('accepts a link that resolves, however deep the code sits inside it', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const text = [
        '[`createShell`](https://www.hyperfrontend.dev/docs/libraries/alpha/host/#api-createShell)',
        '[**`Options`**](https://www.hyperfrontend.dev/docs/libraries/alpha/#api-Options)',
        '[`helper`](https://github.com/acme/repo/blob/main/libs/alpha/src/validate.ts)',
        '[`anything`](https://developer.mozilla.org/)',
        '[`Quick`](#quick-start)',
      ].join('\n')

      expect(lintMarkdown(text, join(workspace.root, 'libs/alpha/README.md'))).toEqual([])
    })

    it('reports a link whose destination does not resolve, with the reason', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const text = '[`createShell`](https://www.hyperfrontend.dev/docs/libraries/alpha/#api-createShel)\n'
      const reports = lintMarkdown(text, join(workspace.root, 'libs/alpha/README.md'))

      expect(reports).toEqual([
        expect.objectContaining({
          messageId: 'brokenLink',
          data: {
            code: 'createShell',
            href: 'https://www.hyperfrontend.dev/docs/libraries/alpha/#api-createShel',
            reason: "@acme/alpha does not export 'createShel' from /docs/libraries/alpha/",
          },
        }),
      ])
    })

    it('checks repository links against the configured repository', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const text = '[`helper`](https://gitlab.example/acme/repo/blob/main/libs/alpha/src/missing.ts)\n'
      const reports = lintMarkdown(text, join(workspace.root, 'libs/alpha/README.md'), { repoUrl: 'https://gitlab.example/acme/repo' })

      expect(reports[0]).toMatchObject({
        messageId: 'brokenLink',
        data: { reason: 'the repository has no file at libs/alpha/src/missing.ts' },
      })
    })
  })
})
