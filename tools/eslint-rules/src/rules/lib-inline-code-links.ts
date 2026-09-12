import type { Rule } from 'eslint'
import type { LinkOrigins } from '../utils/docs-links'
import { basename, dirname, join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { validateLink } from '../utils/docs-link-validation'
import { resolveCodeMention } from '../utils/docs-links'
import { getDocsTargetIndex, packageOfFile, readRepositoryUrl } from '../utils/docs-targets'
import { findNxWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-inline-code-links rule.
 */
export const RULE_NAME = 'lib-inline-code-links'

/** Origin of the documentation site, where every package's pages are published. */
export const DEFAULT_SITE_URL = 'https://www.hyperfrontend.dev'

/** Where the documentation site's project lives, relative to the workspace root. */
export const DEFAULT_DOCS_SITE_ROOT = 'apps/docs-site'

/** The one markdown file a package carries that is written by a tool rather than an author. */
const GENERATED_MARKDOWN = 'CHANGELOG.md'

/**
 * Options accepted by the rule.
 */
export interface InlineCodeLinksOptions {
  /** Origin of the documentation site; every resolved link is published under it. */
  siteUrl?: string
  /** The documentation site's project, relative to the workspace root, whose routes and content say which pages exist. */
  docsSiteRoot?: string
  /** Browsable repository URL; read from the workspace manifest when omitted. */
  repoUrl?: string
}

/**
 * The parts of an mdast node this rule reads.
 */
export interface MarkdownNode {
  /** Node type: `inlineCode`, `link`, `heading`, and so on. */
  type: string
  /** The text of an inline code span. */
  value?: string
  /** The destination of a link. */
  url?: string
  /** Child nodes, absent on leaves. */
  children?: MarkdownNode[]
}

/**
 * Collects every inline code node beneath a node.
 *
 * @param node - The node whose subtree is walked.
 * @param into - The set the spans are added to.
 * @returns The set, for chaining.
 */
export function collectInlineCode(node: MarkdownNode, into: Set<MarkdownNode> = createSet()): Set<MarkdownNode> {
  if (node.type === 'inlineCode') {
    into.add(node)
  }
  for (const child of node.children ?? []) {
    collectInlineCode(child, into)
  }
  return into
}

/**
 * Lays out the candidates of an ambiguous mention for a message.
 *
 * @param candidates - The labelled URLs.
 * @returns One line per candidate, indented under the message.
 */
function listCandidates(candidates: readonly string[]): string {
  return candidates.map((candidate) => `\n    ${candidate}`).join('')
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require inline code that names a package, entry point, symbol or declaration to link to where it is documented',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [
      {
        type: 'object',
        properties: {
          siteUrl: { type: 'string' },
          docsSiteRoot: { type: 'string' },
          repoUrl: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unlinkedResolved:
        'Inline code `{{code}}` must link to its documentation: {{what}} is documented at {{url}}. Link it there, or, if `{{code}}` is not a navigable code or API concept here, write it as plain prose instead.',
      unlinkedAmbiguous:
        'Inline code `{{code}}` must link to its documentation, and it is documented in more than one place:{{candidates}}\n  Link the one this sentence means, or, if `{{code}}` is not a navigable code or API concept here, write it as plain prose instead.',
      unlinkedElsewhere:
        'Inline code `{{code}}` must link to its documentation. This package does not export it, but it is documented elsewhere:{{candidates}}\n  Link the one this sentence means, or, if `{{code}}` is not a navigable code or API concept here, write it as plain prose instead.',
      unlinkedUnknown:
        'Inline code `{{code}}` must link to its documentation, and no package, entry point, exported symbol, member or declaration by that name was found. Link it to the API reference, entry page, guide or concept page that explains it, or, if `{{code}}` is not a navigable code or API concept, write it as plain prose instead.',
      brokenLink: 'Inline code `{{code}}` links to {{href}}, which does not resolve: {{reason}}.',
    },
  },

  create(context) {
    const filename = context.filename
    if (!filename.endsWith('.md') || basename(filename) === GENERATED_MARKDOWN) {
      return {}
    }

    const workspaceRoot = findNxWorkspaceRoot(dirname(filename))
    if (workspaceRoot === null) {
      return {}
    }

    const options = (context.options[0] ?? {}) as InlineCodeLinksOptions
    const index = getDocsTargetIndex(workspaceRoot, join(workspaceRoot, options.docsSiteRoot ?? DEFAULT_DOCS_SITE_ROOT))
    if (packageOfFile(index, filename) === null) {
      return {}
    }

    const origins: LinkOrigins = {
      siteUrl: (options.siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, ''),
      repoUrl: options.repoUrl ?? readRepositoryUrl(workspaceRoot) ?? '',
    }
    const sourceCode = context.sourceCode
    // why: a link is entered before the spans inside it, so by the time a span is visited it is known whether an author already linked it and where to
    const linked = createMap<MarkdownNode, MarkdownNode>()
    // why: a heading is its own anchor, and a link inside one would carry the reader away from the section it names
    const headed = createSet<MarkdownNode>()

    return {
      link(node: MarkdownNode) {
        for (const span of collectInlineCode(node)) {
          linked.set(span, node)
        }
      },

      heading(node: MarkdownNode) {
        for (const span of collectInlineCode(node)) {
          headed.add(span)
        }
      },

      inlineCode(node: MarkdownNode) {
        const code = node.value ?? ''
        if (headed.has(node)) {
          return
        }

        const link = linked.get(node)
        if (link !== undefined) {
          const href = link.url ?? ''
          const verdict = validateLink(index, origins, href, filename)
          if (verdict.ok === false) {
            context.report({ node: node as unknown as Rule.Node, messageId: 'brokenLink', data: { code, href, reason: verdict.reason } })
          }
          return
        }

        const mention = resolveCodeMention(index, origins, code, filename)
        if (mention.kind === 'exempt') {
          return
        }
        if (mention.kind === 'resolved') {
          const what = mention.via === undefined ? `the ${mention.target}` : `its parent, ${mention.via},`
          context.report({
            node: node as unknown as Rule.Node,
            messageId: 'unlinkedResolved',
            data: { code, what, url: mention.url },
            fix: (fixer) =>
              fixer.replaceText(node as unknown as Rule.Node, `[${sourceCode.getText(node as unknown as Rule.Node)}](${mention.url})`),
          })
          return
        }
        if (mention.kind === 'ambiguous' || mention.kind === 'elsewhere') {
          context.report({
            node: node as unknown as Rule.Node,
            messageId: mention.kind === 'ambiguous' ? 'unlinkedAmbiguous' : 'unlinkedElsewhere',
            data: { code, candidates: listCandidates(mention.candidates) },
          })
          return
        }
        context.report({ node: node as unknown as Rule.Node, messageId: 'unlinkedUnknown', data: { code } })
      },
    }
  },
}

export default rule
