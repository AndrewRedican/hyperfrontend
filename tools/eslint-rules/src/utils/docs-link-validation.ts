/**
 * Whether a link an author wrote around a code mention reaches something.
 *
 * Site links are checked against the pages the site publishes and the anchors
 * those pages carry, repository links against the workspace, relative links
 * against the document's neighbours, and bare anchors against the document's
 * own headings. Anything else is taken on trust.
 *
 * @module utils/docs-link-validation
 */

import type { LinkOrigins } from './docs-links'
import type { DocsTargetIndex } from './docs-targets'
import { dirname, join, relative } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { API_ANCHOR_PREFIX, PROPERTY_ANCHOR_INFIX } from './docs-links'
import { entryOfRoute, markdownOfRoute, routeExists } from './docs-targets'
import { exists, isDirectory, readFileIfExists } from './fs'

/** The anchor the site gives the reference section of every package and entry page. */
const API_REFERENCE_ANCHOR = 'api-reference'

/** Whether a link an author wrote reaches something. */
export type LinkVerdict = ValidLink | BrokenLink

/** The destination exists. */
export interface ValidLink {
  /** The verdict discriminator. */
  ok: true
}

/** The destination does not exist, or cannot be what the link says. */
export interface BrokenLink {
  /** The verdict discriminator. */
  ok: false
  /** What is wrong, for the message. */
  reason: string
}

/**
 * Turns heading text into the anchor id the site gives it.
 *
 * Mirrors the site's one slug algorithm: inline markdown is reduced to its
 * text, then lowercased, stripped to letters, digits, spaces and hyphens, and
 * hyphenated.
 *
 * @param heading - The heading text after the `#` markers.
 * @returns The anchor id.
 */
export function headingSlug(heading: string): string {
  const text = heading
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/<[^>]*>/g, '')
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Every anchor id a markdown document's headings receive on the site,
 * duplicates disambiguated the way the page does.
 *
 * @param markdown - The document.
 * @returns The anchor ids.
 */
export function headingAnchors(markdown: string): Set<string> {
  const anchors = createSet<string>()
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```') || line.trimStart().startsWith('~~~')) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }
    const match = /^#{1,6}\s+(.*)$/.exec(line)
    if (match === null) {
      continue
    }
    let id = headingSlug(match[1] ?? '')
    if (id === '') {
      continue
    }
    if (anchors.has(id)) {
      let suffix = 1
      while (anchors.has(`${id}-${suffix}`)) {
        suffix++
      }
      id = `${id}-${suffix}`
    }
    anchors.add(id)
  }
  return anchors
}

/**
 * Checks an anchor against the page it is on.
 *
 * @param index - The target index.
 * @param route - The page's route.
 * @param anchor - The anchor without its `#`.
 * @returns Whether the page has that anchor.
 */
function checkAnchor(index: DocsTargetIndex, route: string, anchor: string): LinkVerdict {
  const owner = entryOfRoute(index, route)
  if (anchor.startsWith(API_ANCHOR_PREFIX)) {
    if (owner === null) {
      return { ok: false, reason: `${route} is not a package page, so it has no ${API_ANCHOR_PREFIX}* anchors` }
    }
    if (anchor === API_REFERENCE_ANCHOR) {
      return { ok: true }
    }
    const [name, property] = anchor.slice(API_ANCHOR_PREFIX.length).split(PROPERTY_ANCHOR_INFIX) as [string, string | undefined]
    const entries = owner.entry === null ? [...owner.pkg.entries.values()] : [owner.entry]
    const symbol = entries.map((entry) => entry.symbols.get(name)).find((candidate) => candidate !== undefined)
    if (symbol !== undefined) {
      if (property === undefined || symbol.properties.includes(property)) {
        return { ok: true }
      }
      return { ok: false, reason: `${name} has no property '${property}' with an anchor of its own` }
    }
    const elsewhere = [...owner.pkg.entries.values()].filter((entry) => entry.symbols.has(name))
    const hint = elsewhere.length > 0 ? `; it is exported by ${elsewhere.map((entry) => entry.route).join(', ')}` : ''
    return { ok: false, reason: `${owner.pkg.name} does not export '${name}' from ${route}${hint}` }
  }
  const markdown = markdownOfRoute(index, route)
  if (markdown === null) {
    return { ok: true }
  }
  const text = readFileIfExists(markdown)
  if (text === null) {
    return { ok: false, reason: `${route} renders ${relative(index.workspaceRoot, markdown)}, which does not exist` }
  }
  return headingAnchors(text).has(anchor)
    ? { ok: true }
    : { ok: false, reason: `${relative(index.workspaceRoot, markdown)} has no heading with the anchor '${anchor}'` }
}

/**
 * Checks a link to the documentation site.
 *
 * @param index - The target index.
 * @param url - The parsed URL.
 * @returns Whether the page, and the anchor when there is one, exist.
 */
function checkSiteLink(index: DocsTargetIndex, url: URL): LinkVerdict {
  const route = url.pathname
  if (!routeExists(index, route)) {
    return { ok: false, reason: `the site has no page at ${route}` }
  }
  const anchor = url.hash.replace(/^#/, '')
  return anchor === '' ? { ok: true } : checkAnchor(index, route, anchor)
}

/**
 * Checks a link into the repository.
 *
 * @param index - The target index.
 * @param url - The parsed URL.
 * @param repoUrl - The repository's browsable URL.
 * @returns Whether the file or directory exists in the workspace.
 */
function checkRepositoryLink(index: DocsTargetIndex, url: URL, repoUrl: string): LinkVerdict {
  const repoPath = createURL(repoUrl).pathname.replace(/\/$/, '')
  if (!url.pathname.startsWith(`${repoPath}/`)) {
    return { ok: true }
  }
  // why: after the repository come the view, the branch and the path, and only the view and the path say anything about the workspace
  const [view, , ...segments] = url.pathname.slice(repoPath.length + 1).split('/')
  if ((view !== 'blob' && view !== 'tree') || segments.length === 0) {
    return { ok: true }
  }
  const target = join(index.workspaceRoot, segments.join('/'))
  if (!exists(target)) {
    return { ok: false, reason: `the repository has no file at ${relative(index.workspaceRoot, target)}` }
  }
  if (view === 'blob' && isDirectory(target)) {
    return { ok: false, reason: `${relative(index.workspaceRoot, target)} is a directory; link it with /tree/ rather than /blob/` }
  }
  return { ok: true }
}

/**
 * Checks that a link an author wrote around a code mention reaches something.
 *
 * Site links must name a published page, and an anchor on one must be a
 * heading of the document it renders or, for `api-` anchors, a symbol the
 * page's reference lists. Repository links must name a file or directory
 * that exists. Relative links are resolved against the mentioning file, and
 * a bare anchor against its own headings. Any other external link is taken
 * on trust: nothing offline can say whether it resolves.
 *
 * @param index - The target index.
 * @param origins - Where the site and the repository are.
 * @param href - The link as written.
 * @param file - Absolute path of the markdown file carrying it.
 * @returns Whether the link resolves, with a reason when it does not.
 *
 * @example Validating an API anchor
 * ```typescript
 * validateLink(index, origins, 'https://www.hyperfrontend.dev/docs/libraries/features/host/#api-createShell', file)
 * // { ok: true }
 * ```
 */
export function validateLink(index: DocsTargetIndex, origins: LinkOrigins, href: string, file: string): LinkVerdict {
  if (href.startsWith('#')) {
    const own = readFileIfExists(file) ?? ''
    return headingAnchors(own).has(href.slice(1))
      ? { ok: true }
      : { ok: false, reason: `this document has no heading with the anchor '${href.slice(1)}'` }
  }
  if (/^[a-z]+:/i.test(href)) {
    let url: URL
    try {
      url = createURL(href)
    } catch {
      return { ok: false, reason: `'${href}' is not a valid URL` }
    }
    const site = createURL(origins.siteUrl)
    const bare = site.host.replace(/^www\./, '')
    if (url.host === site.host || url.host === bare || url.host === `www.${bare}`) {
      return checkSiteLink(index, url)
    }
    if (origins.repoUrl !== '' && url.host === createURL(origins.repoUrl).host) {
      return checkRepositoryLink(index, url, origins.repoUrl)
    }
    return { ok: true }
  }
  const [path, anchor] = href.split('#') as [string, string | undefined]
  const target = join(dirname(file), path)
  if (!exists(target)) {
    return { ok: false, reason: `${relative(index.workspaceRoot, target)} does not exist` }
  }
  if (anchor !== undefined && anchor !== '' && !isDirectory(target)) {
    const text = readFileIfExists(target) ?? ''
    if (!headingAnchors(text).has(anchor)) {
      return { ok: false, reason: `${relative(index.workspaceRoot, target)} has no heading with the anchor '${anchor}'` }
    }
  }
  return { ok: true }
}
