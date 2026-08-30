import { SITE_URL } from './site'

/**
 * What a document is, which decides how the LLM handoff names its subject.
 *
 * Every kind here is backed by a markdown source file, which is what makes a
 * machine-readable counterpart possible at all. Pages written directly in TSX
 * have no such source and are deliberately absent.
 */
export type DocumentKind = 'package' | 'architecture' | 'submodule' | 'guide' | 'article' | 'page'

/**
 * Minimum number of sections a document needs before an index earns its place
 * beside it. Below this the list restates a page the reader can already see
 * whole, and the rail is better off carrying only the actions.
 */
export const MIN_INDEX_SECTIONS = 3

/**
 * Everything a page needs to offer its own document-level actions.
 *
 * Built server-side from the same registry the machine-readable files are
 * emitted from, so the URL a reader copies and the URL an agent is handed are
 * the same string produced by the same rule.
 */
export interface DocumentDescriptor {
  /** Site-relative route of the HTML page, without a trailing slash */
  route: string
  /** Document title, as the page's H1 states it */
  title: string
  /** What the document is, in the LLM prompt's words: '@hyperfrontend/features' or 'the guide "Compose independent features"' */
  subject: string
  /** What kind of document this is */
  kind: DocumentKind
}

/**
 * Site-relative path of a document's machine-readable counterpart.
 *
 * The convention is the page route with `.md` appended. It survives the site's
 * `trailingSlash` setting (a path whose last segment carries an extension is
 * served as a file, not redirected to a directory form), it needs no routing
 * table of its own, and it is the convention agent tooling already probes for.
 *
 * `.txt` was rejected: Next's static export already writes the React Server
 * Component payload for `/docs/x/` to `/docs/x.txt`, so that name is taken.
 *
 * @param route - Site-relative page route, with or without a trailing slash
 * @returns The counterpart path, e.g. `/docs/libraries/features.md`
 *
 * @example
 * ```typescript
 * markdownPathFor('/docs/libraries/features/')  // '/docs/libraries/features.md'
 * markdownPathFor('/architecture')              // '/architecture.md'
 * ```
 */
export function markdownPathFor(route: string): string {
  return `${route.replace(/\/$/, '')}.md`
}

/**
 * Absolute URL for a site-relative path.
 *
 * @param path - Site-relative path beginning with a slash
 * @returns The path resolved against the canonical origin
 */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`
}

/**
 * Absolute URL of a document's machine-readable counterpart: the one address
 * that is handed to an LLM, fetched by the copy action, and linked from
 * `llms.txt`.
 *
 * @param route - Site-relative page route
 * @returns The absolute `.md` URL
 */
export function markdownUrlFor(route: string): string {
  return absoluteUrl(markdownPathFor(route))
}

/**
 * Compose the prompt handed to an external assistant.
 *
 * It names one fetchable URL and one instruction. The document itself is never
 * encoded into the query string: a README runs to tens of kilobytes, browsers
 * and the receiving apps both truncate long URLs (Claude's documented ceiling
 * is roughly 14,000 characters), and a link the model fetches stays current
 * while a pasted copy goes stale the moment the docs change.
 *
 * @param descriptor - The document being handed off
 * @returns A single-sentence prompt naming the canonical markdown URL
 *
 * @example
 * ```typescript
 * buildHandoffPrompt({ route: '/docs/libraries/features', title: 'Features', subject: '@hyperfrontend/features', kind: 'package' })
 * // 'Read https://www.hyperfrontend.dev/docs/libraries/features.md, the HyperFrontend
 * //  documentation for @hyperfrontend/features, and use it as context for my questions about it.'
 * ```
 */
export function buildHandoffPrompt(descriptor: DocumentDescriptor): string {
  return `Read ${markdownUrlFor(descriptor.route)}, the HyperFrontend documentation for ${descriptor.subject}, and use it as context for my questions about it.`
}

/**
 * Name a document the way the handoff prompt should refer to it.
 *
 * One rule, shared by the pages that render the actions and the pipeline that
 * writes `llms.txt`, so a document is described identically wherever it is
 * announced.
 *
 * @param kind - What kind of document it is
 * @param name - The package name for a package or submodule, the title otherwise
 * @returns The subject phrase, to be read after 'documentation for'
 *
 * @example
 * ```typescript
 * documentSubject('package', '@hyperfrontend/features')   // '@hyperfrontend/features'
 * documentSubject('guide', 'Compose independent features') // 'the guide "Compose independent features"'
 * ```
 */
export function documentSubject(kind: DocumentKind, name: string): string {
  switch (kind) {
    case 'package':
    case 'submodule':
      return name
    case 'architecture':
      return `the architecture of ${name}`
    case 'guide':
      return `the guide "${name}"`
    case 'article':
      return `the article "${name}"`
    case 'page':
      return name
  }
}

/** An external assistant the document can be handed off to. */
export interface HandoffTarget {
  /** Stable identifier, used to pick the icon */
  id: 'chatgpt' | 'claude'
  /** Menu label */
  label: string
  /** Deep link carrying the composed prompt */
  href: string
}

/**
 * Build the deep links that open the document in an external assistant.
 *
 * Both destinations pre-fill their composer from a `q` parameter and leave the
 * reader to send it. Neither auto-submits: Claude stopped doing so in October
 * 2025 after prompt-injection research showed a link could smuggle hidden
 * instructions past the visible text, and prefill-then-confirm is the safer
 * shape for a link a stranger's site produced. ChatGPT additionally takes a
 * `hints` value, and `search` is the one that matters here because the prompt
 * is useless unless the model actually fetches the URL.
 *
 * Neither link carries anything about the reader: the query string is a public
 * documentation URL and a fixed sentence, identical for every visitor.
 *
 * @param descriptor - The document being handed off
 * @returns Handoff targets in display order
 */
export function buildHandoffTargets(descriptor: DocumentDescriptor): HandoffTarget[] {
  const prompt = encodeURIComponent(buildHandoffPrompt(descriptor))
  return [
    { id: 'chatgpt', label: 'Open in ChatGPT', href: `https://chatgpt.com/?hints=search&q=${prompt}` },
    { id: 'claude', label: 'Open in Claude', href: `https://claude.ai/new?q=${prompt}` },
  ]
}
