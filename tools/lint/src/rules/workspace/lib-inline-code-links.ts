/**
 * Inline code that names a package, an entry, a symbol, a member or a declaration in package
 * documentation links to where it is documented, and an existing link resolves. A mention with a
 * single documented target is linked by the fix.
 *
 * @module rules/workspace/lib-inline-code-links
 */

import type { MarkdownNode } from '@hyperfrontend/linter'
import { basename, dirname, join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { linkProblem } from './shared/docs-anchors.ts'
import { docsIndex, packageOfFile, repositoryUrl } from './shared/docs-catalog.ts'
import { resolveMention } from './shared/docs-mentions.ts'
import { workspaceRootOf } from './shared/locate.ts'

/** The site's origin. */
const SITE_URL = 'https://www.hyperfrontend.dev'

/** What every message advises after its finding. */
const PROSE = 'or, if `{{code}}` is not a navigable code or API concept here, write it as plain prose instead.'

/**
 * The inline code below a node.
 *
 * @param node - A Markdown node whose descendants are searched
 * @param found - Where the spans go
 * @returns The spans
 */
function inlineCodeOf(node: MarkdownNode, found: MarkdownNode[] = []): MarkdownNode[] {
  if (node.kind === 'inlineCode') found.push(node)
  for (const child of node.children ?? []) inlineCodeOf(child, found)
  return found
}

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/lib-inline-code-links',
  language: 'markdown',
  fixable: true,
  create(context) {
    const path = context.file.path
    if (!path.endsWith('.md') || basename(path) === 'CHANGELOG.md') return {}
    const root = workspaceRootOf(dirname(path))
    if (root === null) return {}
    const index = docsIndex(root, join(root, 'apps/docs-site'))
    if (packageOfFile(index, path) === null) return {}
    const origins = { siteUrl: SITE_URL, repoUrl: repositoryUrl(root) ?? '' }
    // why: a link is entered before the spans inside it, so a span's visit knows whether an author already linked it.
    const linked = createMap<MarkdownNode, MarkdownNode>()
    // why: a heading is its own anchor, and a link inside one would carry the reader away from the section it names.
    const headed = createSet<MarkdownNode>()
    return {
      link(node) {
        for (const span of inlineCodeOf(node)) linked.set(span, node)
      },
      heading(node) {
        for (const span of inlineCodeOf(node)) headed.add(span)
      },
      inlineCode(node) {
        if (headed.has(node)) return
        const code = node.value as string
        const start = node.position.start.offset
        const end = node.position.end.offset
        const prose = PROSE.replace('{{code}}', code)
        const link = linked.get(node)
        if (link !== undefined) {
          const href = link.url as string
          const reason = linkProblem(index, origins, href, path)
          if (reason !== null)
            context.report({ start, end, message: `Inline code \`${code}\` links to ${href}, which does not resolve: ${reason}.` })
          return
        }
        const mention = resolveMention(index, origins, code, path)
        if (mention.kind === 'exempt') return
        if (mention.kind === 'resolved') {
          const what = mention.via === undefined ? `the ${mention.target}` : `its parent, ${mention.via},`
          context.report({
            start,
            end,
            message: `Inline code \`${code}\` must link to its documentation: ${what} is documented at ${mention.url}. Link it there, ${prose}`,
            fix: { start, end, text: `[${context.file.text.slice(start, end)}](${mention.url})` },
          })
          return
        }
        if (mention.kind === 'unknown') {
          context.report({
            start,
            end,
            message: `Inline code \`${code}\` must link to its documentation, and no package, entry point, exported symbol, member or declaration by that name was found. Link it to the API reference, entry page, guide or concept page that explains it, ${prose.replace(' here,', ',')}`,
          })
          return
        }
        const listed = mention.candidates.map((candidate) => `\n    ${candidate}`).join('')
        const finding =
          mention.kind === 'ambiguous'
            ? 'and it is documented in more than one place:'
            : 'This package does not export it, but it is documented elsewhere:'
        context.report({
          start,
          end,
          message: `Inline code \`${code}\` must link to its documentation${mention.kind === 'ambiguous' ? ', ' : '. '}${finding}${listed}\n  Link the one this sentence means, ${prose}`,
        })
      },
    }
  },
})
