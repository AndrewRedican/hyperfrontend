#!/usr/bin/env node
import type { DocumentSource } from '../src/lib/document-sources'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { globSync } from 'glob'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { absoluteUrl, markdownPathFor, markdownUrlFor } from '../src/lib/document-model'
import { collectDocuments } from '../src/lib/document-sources'
import { SITE_ONE_LINER } from '../src/lib/share'
import { SITE_URL } from '../src/lib/site'

const PUBLIC_DIR = resolve(__dirname, '../public')
const LLMS_TXT = join(PUBLIC_DIR, 'llms.txt')

/**
 * Canonical URL of the agent-facing index, named in every document footer so
 * one fetched file leads to the whole corpus.
 */
const LLMS_TXT_URL = absoluteUrl('/llms.txt')

/**
 * Origins that mean this site. Package READMEs are published to npm
 * byte-identical, so the links they carry to their own documentation are
 * written as absolute URLs rather than as routes, and both spellings of the
 * host appear.
 */
const SELF_ORIGINS = [SITE_URL, 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev']

/**
 * Reduce a link target to the site path it addresses.
 *
 * @param target - The link target as authored
 * @returns The site-relative path, or an empty string when the target points elsewhere
 */
function toSitePath(target: string): string {
  if (target.startsWith('/')) return target
  for (const origin of SELF_ORIGINS) {
    if (target.startsWith(`${origin}/`)) return target.slice(origin.length)
  }
  return ''
}

/**
 * Resolve one link target to the address it should carry in a published
 * markdown file.
 *
 * A markdown file is read far from the page it was published on, by clients
 * with no notion of the site's routing, so `/docs/libraries/features` means
 * nothing there. Pointing those links at `.md` files rather than at pages
 * keeps an agent that follows them inside the machine-readable corpus instead
 * of dropping it back into HTML.
 *
 * @param target - The link target as authored
 * @param markdownRoutes - Routes that have a markdown counterpart
 * @returns The address to publish, unchanged when it is not ours to rewrite
 */
function resolveTarget(target: string, markdownRoutes: Set<string>): string {
  const sitePath = toSitePath(target)
  if (!sitePath) return target

  const [path, hash] = sitePath.split('#')
  const route = path.replace(/\/$/, '')

  if (markdownRoutes.has(route) && !hash) {
    return markdownUrlFor(route)
  }

  // why: an anchor addresses a heading on the rendered page, and assets address themselves; both keep the page URL, normalised to the trailing-slash form the site serves
  const canonical = /\.[a-z0-9]+$/i.test(path) ? path : `${route}/`
  return hash ? `${absoluteUrl(canonical)}#${hash}` : absoluteUrl(canonical)
}

/** What a line looks like once its HTML comments are gone. */
interface CommentScan {
  /** The line with every comment span removed */
  text: string
  /** Whether a comment is still open when the line ends */
  inComment: boolean
}

/**
 * Remove HTML comment spans from one line.
 *
 * The scan walks the line instead of matching whole comments in one pass,
 * because a comment can open on one line and close on another, and the text
 * after a close can open a comment of its own. Whatever a single pass left
 * behind would be published as document text.
 *
 * @param line - The line as authored
 * @param inComment - Whether a comment was already open when the line began
 * @returns The surviving text, and whether a comment is open at the end of it
 */
function stripComments(line: string, inComment: boolean): CommentScan {
  let rest = line
  let text = ''
  let open = inComment

  while (rest !== '') {
    if (open) {
      const end = rest.indexOf('-->')
      if (end === -1) return { text, inComment: true }
      rest = rest.slice(end + 3)
      open = false
      continue
    }

    const start = rest.indexOf('<!--')
    if (start === -1) {
      text += rest
      break
    }

    text += rest.slice(0, start)
    rest = rest.slice(start + 4)
    open = true
  }

  return { text, inComment: open }
}

/**
 * Turn a document body into the file that gets published.
 *
 * Three things happen to every line outside a fenced code block: authoring
 * comments are dropped, links are resolved to absolute addresses, and runs of
 * blank lines left behind by stripped badge blocks are collapsed. Inside a
 * fence none of it applies, because a comment, a link, or a blank line there
 * is sample text the reader is meant to see.
 *
 * Dropping comments matches what the HTML page does: the rendering pipeline
 * removes them from the parsed tree so in-source authoring notes never reach a
 * reader. A markdown file that kept them would publish the notes the page
 * withholds.
 *
 * @param markdown - The document body
 * @param markdownRoutes - Routes that have a markdown counterpart
 * @returns The publishable body
 */
function publishBody(markdown: string, markdownRoutes: Set<string>): string {
  const lines: string[] = []
  let inFence = false
  let inComment = false

  for (const line of markdown.split('\n')) {
    // why: a fence marker reached inside a comment is commented-out text, not the start of a code block
    if (!inComment && line.trimStart().startsWith('```')) {
      inFence = !inFence
      lines.push(line)
      continue
    }

    if (inFence) {
      lines.push(line)
      continue
    }

    const openedInComment = inComment
    const scan = stripComments(line, inComment)
    inComment = scan.inComment

    // why: a line that is nothing but comment body leaves no gap behind, so it is dropped rather than published blank
    if (openedInComment && inComment && scan.text === '') continue

    const resolved = scan.text
      .replace(
        /\]\(([^)\s]+)([^)]*)\)/g,
        (_match, target: string, suffix: string) => `](${resolveTarget(target, markdownRoutes)}${suffix})`
      )
      .replace(
        /\b(href|src)=("|')([^"']+)\2/g,
        (_match, attribute: string, quote: string, target: string) =>
          `${attribute}=${quote}${resolveTarget(target, markdownRoutes)}${quote}`
      )

    // why: stripping a badge block or a comment leaves the blank lines that surrounded it, and three in a row read as a gap in the document
    if (resolved.trim() === '' && lines.length > 0 && lines[lines.length - 1].trim() === '') continue

    lines.push(resolved)
  }

  return lines.join('\n')
}

/**
 * Compose the published markdown file for one document.
 *
 * The body is the document itself, untouched beyond the link rewriting the
 * page already performs. The footer names where the file came from and where
 * the rest of the corpus is, so a file that arrives alone is still navigable.
 *
 * @param document - The document being published
 * @param markdownRoutes - Routes that have a markdown counterpart
 * @returns The file contents
 */
function renderDocument(document: DocumentSource, markdownRoutes: Set<string>): string {
  const body = publishBody(document.markdown, markdownRoutes).trim()
  // why: every page shows its title as an H1, so a document whose source omits one would publish untitled
  const titled = body.startsWith('# ') ? body : `# ${document.title}\n\n${body}`

  return [
    titled,
    '',
    '---',
    '',
    `Canonical page: ${absoluteUrl(`${document.route}/`)}`,
    `This file: ${markdownUrlFor(document.route)}`,
    `Documentation index: ${LLMS_TXT_URL}`,
    '',
  ].join('\n')
}

/** One heading of the `llms.txt` index, and the documents filed beneath it. */
interface LlmsSection {
  /** Section heading */
  title: string
  /** Documents listed under it, in the order they should be read */
  documents: DocumentSource[]
}

/**
 * Group the corpus into the sections `llms.txt` lists.
 *
 * Secondary entry points are deliberately left out. There are hundreds of
 * them, listing them would push the index past the context budget the
 * convention exists to protect, and each one is reachable by appending `.md`
 * to its own route anyway.
 *
 * @param documents - Every collected document
 * @returns Sections in reading order, empty ones removed
 */
function llmsSections(documents: DocumentSource[]): LlmsSection[] {
  /**
   * Select the documents of one kind.
   *
   * @param kind - The kind to select
   * @returns Matching documents, in collection order
   */
  const ofKind = (kind: DocumentSource['kind']) => documents.filter((document) => document.kind === kind)

  return [
    { title: 'Overview', documents: ofKind('page') },
    { title: 'Packages', documents: ofKind('package') },
    { title: 'Architecture', documents: ofKind('architecture') },
    { title: 'Guides and tutorials', documents: ofKind('guide') },
    { title: 'Articles', documents: ofKind('article') },
  ].filter((section) => section.documents.length > 0)
}

/**
 * Compose the `llms.txt` index.
 *
 * @param documents - Every collected document
 * @returns The file contents
 */
function renderLlmsTxt(documents: DocumentSource[]): string {
  const lines = [
    '# HyperFrontend',
    '',
    // why: the shared one-liner names the project before the sentence, which the H1 above has already done
    `> ${SITE_ONE_LINER.replace(/^HyperFrontend: (.)/, (_match, first: string) => first.toUpperCase())}`,
    '',
    'Every documentation page on this site has a Markdown counterpart at its own URL: append `.md` to the page route. The links below point straight at those files.',
    '',
  ]

  for (const section of llmsSections(documents)) {
    lines.push(`## ${section.title}`, '')
    for (const document of section.documents) {
      lines.push(`- [${document.title}](${markdownUrlFor(document.route)}): ${document.summary}`)
    }
    lines.push('')
  }

  lines.push(
    '## Optional',
    '',
    `- [Secondary entry points](${SITE_URL}/sitemap.xml): each package documents its subpath exports on its own page, and each of those has a \`.md\` counterpart under the same rule. The sitemap lists every route.`,
    `- [Search index](${SITE_URL}/search-index.json): every page, section anchor, and exported API symbol on the site, as JSON.`,
    ''
  )

  return lines.join('\n')
}

/**
 * Write every document's markdown counterpart under `public/`, plus the
 * `llms.txt` index that points at them.
 *
 * Publishing them as static files rather than as routes is what makes them
 * survive the static export the site deploys as: they are copied into the
 * output verbatim and served by path, needing no server and no route table.
 *
 * Stale files are cleared first, so a document that stops being published
 * stops being served. The sweep is safe because no markdown is committed under
 * `public/`; everything matching is output of this function.
 */
export function generateMachineReadableDocs(): void {
  logger.log('📄 Publishing machine-readable documentation...')

  for (const stale of globSync('**/*.md', { cwd: PUBLIC_DIR, absolute: true })) {
    rmSync(stale)
  }
  rmSync(LLMS_TXT, { force: true })

  const documents = collectDocuments()
  const markdownRoutes = createSet(documents.map((document) => document.route))
  const byKind = createMap<string, number>()

  for (const document of documents) {
    const target = join(PUBLIC_DIR, markdownPathFor(document.route).slice(1))
    const directory = dirname(target)
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true })
    }
    writeFileSync(target, renderDocument(document, markdownRoutes))
    byKind.set(document.kind, (byKind.get(document.kind) ?? 0) + 1)
  }

  writeFileSync(LLMS_TXT, renderLlmsTxt(documents))

  const breakdown = [...byKind].map(([kind, count]) => `${count} ${kind}`).join(', ')
  logger.log(`  ${documents.length} documents published (${breakdown}) → public/**/*.md + public/llms.txt\n`)
}

if (require.main === module) {
  generateMachineReadableDocs()
}
