/**
 * Whether a link in package documentation lands where it says: a heading of the same document,
 * a file beside it, a page of the documentation site and the anchor on it, or a file of the
 * repository. Headings are slugged the way the site slugs them; other hosts are taken on trust.
 *
 * @module rules/workspace/shared/docs-anchors
 */

import type { DocsIndex } from './docs-catalog.ts'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { entryOfRoute, markdownOfRoute, routeExists } from './docs-catalog.ts'

/** Where destinations are published. */
export interface LinkOrigins {
  /** The documentation site's origin. */
  readonly siteUrl: string
  /** The browsable repository URL, or empty when the workspace names none. */
  readonly repoUrl: string
}

const anchorsByFile = createMap<string, ReadonlySet<string>>()

/**
 * Slugs heading text as the site does: inline markup reduced to the text it shows, tags
 * dropped, then lower-cased with everything but letters, digits, spaces and hyphens removed and
 * runs of spaces turned into single hyphens.
 *
 * @param heading - The heading text after its `#` markers
 * @returns The anchor, empty when nothing survives
 */
export function headingSlug(heading: string): string {
  let text = heading
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
  for (let previous = ''; previous !== text; ) {
    previous = text
    text = text.replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
  }
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Lists the anchors a Markdown document's headings receive, a repeated slug numbered from `-1`
 * as the page numbers it; fenced blocks and headings that slug to nothing give none.
 *
 * @param markdown - The document
 * @returns The slug of every heading the document holds
 */
export function headingAnchors(markdown: string): Set<string> {
  const anchors = createSet<string>()
  let fenced = false
  for (const line of markdown.split(/\r?\n/)) {
    const start = line.trimStart()
    if (start.startsWith('```') || start.startsWith('~~~')) fenced = !fenced
    const heading = fenced ? null : /^#{1,6}\s+(.*)$/.exec(line)
    const slug = heading === null ? '' : headingSlug(heading[1] as string)
    if (slug === '') continue
    let anchor = slug
    for (let repeat = 1; anchors.has(anchor); repeat += 1) anchor = `${slug}-${repeat}`
    anchors.add(anchor)
  }
  return anchors
}

/**
 * Reads the anchors of a document on disk, once per document.
 *
 * @param file - The document
 * @returns Its anchors, none when it cannot be read
 */
function anchorsOf(file: string): ReadonlySet<string> {
  let anchors = anchorsByFile.get(file)
  if (anchors === undefined) {
    let text = ''
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      // why: a document that cannot be read carries no headings, so every anchor into it is missing.
    }
    anchors = headingAnchors(text)
    anchorsByFile.set(file, anchors)
  }
  return anchors
}

/**
 * Words what is missing when a document lacks an anchor.
 *
 * @param document - The document, as the reader should find it
 * @param anchor - A fragment the document lacks, without the `#`
 * @returns The reason
 */
function missingAnchor(document: string, anchor: string): string {
  return `${document} has no heading with the anchor '${anchor}'`
}

/**
 * Checks an `api-` anchor against the exports the page's reference lists: an entry page lists
 * its entry's, a landing page every entry's.
 *
 * @param index - The catalogue
 * @param path - The page's path as linked
 * @param anchor - The anchor after `api-`
 * @returns The reason it misses, or null
 */
function apiProblem(index: DocsIndex, path: string, anchor: string): string | null {
  const owner = entryOfRoute(index, path)
  if (owner === null) return `${path} is not a package page, so it has no api-* anchors`
  if (anchor === 'reference') return null
  const parts = /^(.*?)-(prop|method)-(.*)$/.exec(anchor)
  const name = parts === null ? anchor : (parts[1] as string)
  const entries = [...owner.pkg.entries.values()]
  const listed = owner.entry === null ? entries : [owner.entry]
  const symbol = listed.map((entry) => entry.symbols.get(name)).find((found) => found !== undefined)
  if (symbol === undefined) {
    const routes = entries.filter((entry) => !listed.includes(entry) && entry.symbols.has(name)).map((entry) => entry.route)
    return `${owner.pkg.name} does not export '${name}' from ${path}${routes.length === 0 ? '' : `; it is exported by ${routes.join(', ')}`}`
  }
  if (parts === null) return null
  const [, , kind, member] = parts as unknown as [string, string, 'prop' | 'method', string]
  if ((kind === 'prop' ? symbol.properties : symbol.methods).includes(member)) return null
  return `${name} has no ${kind === 'prop' ? 'property' : 'method'} '${member}' with an anchor of its own`
}

/**
 * Checks a page of the site and the anchor on it.
 *
 * @param index - The catalogue
 * @param url - The link
 * @returns The reason it misses, or null
 */
function siteProblem(index: DocsIndex, url: URL): string | null {
  const path = url.pathname
  if (!routeExists(index, path)) return `the site has no page at ${path}`
  if (url.hash === '') return null
  const anchor = url.hash.slice(1)
  if (anchor.startsWith('api-')) return apiProblem(index, path, anchor.slice(4))
  const document = markdownOfRoute(index, path)
  if (document === null) return null
  const shown = relative(index.root, document).split(sep).join(posix.sep)
  if (!existsSync(document)) return `${path} renders ${shown}, which does not exist`
  return anchorsOf(document).has(anchor) ? null : missingAnchor(shown, anchor)
}

/**
 * Checks a `blob` or `tree` link into the repository against the workspace.
 *
 * @param index - The catalogue
 * @param rest - The link's path after the repository's
 * @returns The reason it misses, or null
 */
function repositoryProblem(index: DocsIndex, rest: string): string | null {
  const [view, , ...parts] = rest.split('/').slice(1)
  if ((view !== 'blob' && view !== 'tree') || parts.length === 0) return null
  const path = parts.join('/')
  const target = join(index.root, path)
  if (!existsSync(target)) return `the repository has no file at ${path}`
  return view === 'blob' && statSync(target).isDirectory() ? `${path} is a directory; link it with /tree/ rather than /blob/` : null
}

/**
 * Tells why a link from a document does not resolve.
 *
 * @param index - The catalogue
 * @param origins - The site and repository
 * @param href - The link as written
 * @param file - The document holding it
 * @returns The reason, or null when it resolves or cannot be checked
 */
export function linkProblem(index: DocsIndex, origins: LinkOrigins, href: string, file: string): string | null {
  if (href.startsWith('#')) {
    const anchor = href.slice(1)
    return anchorsOf(file).has(anchor) ? null : missingAnchor('this document', anchor)
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
    let url: URL
    try {
      url = createURL(href)
    } catch {
      return `'${href}' is not a valid URL`
    }
    const bare = (host: string): string => host.replace(/^www\./, '')
    if (bare(url.host) === bare(createURL(origins.siteUrl).host)) return siteProblem(index, url)
    if (origins.repoUrl === '') return null
    const repository = createURL(origins.repoUrl)
    const base = repository.pathname.replace(/\/+$/, '')
    if (url.host !== repository.host || (url.pathname !== base && !url.pathname.startsWith(`${base}/`))) return null
    return repositoryProblem(index, url.pathname.slice(base.length))
  }
  const hash = href.indexOf('#')
  const target = join(dirname(file), hash === -1 ? href : href.slice(0, hash))
  const shown = relative(index.root, target).split(sep).join(posix.sep)
  if (!existsSync(target)) return `${shown} does not exist`
  if (hash === -1 || statSync(target).isDirectory()) return null
  const anchor = href.slice(hash + 1)
  return anchorsOf(target).has(anchor) ? null : missingAnchor(shown, anchor)
}
