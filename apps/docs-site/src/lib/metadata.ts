import type { Metadata } from 'next'
import { getLibraryArchitecture, getManifest, getSubmoduleReadme } from './docs-loader'
import { markdownPathFor } from './document-model'
import { getGuideIndex } from './guides'

/** Longest description surfaced to search and social snippets before truncation. */
const DESCRIPTION_MAX_LENGTH = 160

/** Default Open Graph card image shared by every page that does not supply its own. */
export const DEFAULT_OG_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  alt: 'HyperFrontend: compose your existing apps together securely, like Lego bricks.',
}

/** Atom feed advertisement, repeated on every page a reader might subscribe from. */
export const ARTICLES_FEED_ALTERNATE = {
  'application/atom+xml': [{ url: '/feed.xml', title: 'HyperFrontend Articles' }],
}

/** Default Twitter card image shared by every page that does not supply its own. */
export const DEFAULT_TWITTER_IMAGE = {
  url: '/twitter-image.png',
  width: 1200,
  height: 600,
  alt: 'HyperFrontend: compose your existing apps together securely, like Lego bricks.',
}

/**
 * Remove fenced code blocks from markdown so derived descriptions never quote
 * code samples.
 *
 * @param markdown - Raw markdown content
 * @returns The markdown with fenced blocks removed
 */
function stripCodeFences(markdown: string): string {
  const kept: string[] = []
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (!inFence) kept.push(line)
  }
  return kept.join('\n')
}

/**
 * Shorten a description to the snippet budget, cutting on a word boundary.
 *
 * @param text - Plain-text description candidate
 * @returns The text, truncated with an ellipsis when over budget
 */
function truncateDescription(text: string): string {
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text
  const cut = text.slice(0, DESCRIPTION_MAX_LENGTH - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).trimEnd()}…`
}

/**
 * Derive a plain-text description from the first meaningful paragraph of a
 * markdown document: headings, badges, tables, block quotes, lists, and code
 * are skipped, inline markdown is stripped, and the result is truncated to
 * the snippet budget.
 *
 * @param markdown - Raw markdown content
 * @returns The derived description, or null when no suitable paragraph exists
 */
function extractDescription(markdown: string): string | null {
  for (const block of stripCodeFences(markdown).split(/\n[ \t]*\n/)) {
    const paragraph = block.replace(/\s+/g, ' ').trim()
    if (paragraph.length < 30) continue
    if ('#!|><-*'.includes(paragraph.charAt(0)) || paragraph.startsWith('[')) continue
    const text = paragraph
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length >= 30) return truncateDescription(text)
  }
  return null
}

/** One `rel="alternate"` entry: where the representation lives, and what to call it. */
interface AlternateLink {
  /** Site-relative URL of the alternate representation */
  url: string
  /** Human-readable name for the representation */
  title: string
}

/**
 * Advertise a page's machine-readable counterpart from the page itself, as a
 * `<link rel="alternate">`.
 *
 * The type names the format the file is written in. It is served as
 * `text/plain` so that a browser shows it instead of downloading it, which is
 * a delivery decision; what the resource contains is Markdown, and that is
 * what a client choosing between representations needs to be told.
 *
 * @param route - Site-relative page route
 * @param title - Page title, so the alternate is named rather than anonymous
 * @returns An `alternates.types` fragment, ready to merge
 *
 * @example
 * ```typescript
 * markdownAlternate('/docs/libraries/features', 'Features')
 * // { 'text/markdown': [{ url: '/docs/libraries/features.md', title: 'Features as Markdown' }] }
 * ```
 */
export function markdownAlternate(route: string, title: string): Record<string, AlternateLink[]> {
  return { 'text/markdown': [{ url: markdownPathFor(route), title: `${title} as Markdown` }] }
}

/**
 * What a page needs to be shared as a piece of writing rather than as a
 * destination.
 */
interface SocialArticleOptions {
  /** ISO date the page's claims were last re-established, when the page records one */
  modifiedTime?: string
}

/**
 * Build the canonical, Open Graph, and Twitter fields shared by docs pages.
 *
 * @param title - Page title without the site suffix
 * @param description - Page description
 * @param path - Site-relative page path with a trailing slash
 * @param article - Present when the page is a piece of writing, so it is shared as an article rather than as a website
 * @param hasMarkdown - Whether the page is rendered from a markdown source, and so has a counterpart to advertise
 * @returns Metadata slice with alternates, openGraph, and twitter populated
 */
function buildSocialMetadata(
  title: string,
  description: string | undefined,
  path: string,
  article?: SocialArticleOptions,
  hasMarkdown = false
): Metadata {
  return {
    alternates: { canonical: path, types: hasMarkdown ? markdownAlternate(path, title) : undefined },
    openGraph: article
      ? {
          title,
          description,
          url: path,
          siteName: 'HyperFrontend',
          type: 'article',
          modifiedTime: article.modifiedTime,
          images: [DEFAULT_OG_IMAGE],
        }
      : {
          title,
          description,
          url: path,
          siteName: 'HyperFrontend',
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  }
}

/**
 * Generate metadata for a library documentation page.
 *
 * @param slug - The library URL slug
 * @returns Metadata object with title, description, keywords, canonical, and social cards
 */
export function getLibraryMetadata(slug: string): Metadata {
  const manifest = getManifest()
  const library = manifest?.libraries.find((lib) => lib.slug === slug)

  if (!library) {
    return {
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
    }
  }

  const path = library.category === 'utils' ? `/docs/libraries/utils/${slug.replace('-utils', '')}/` : `/docs/libraries/${slug}/`

  return {
    title: library.name,
    description: library.description,
    keywords: library.keywords,
    ...buildSocialMetadata(library.name, library.description, path, undefined, true),
  }
}

/**
 * Coordinates identifying one submodule documentation page.
 */
export interface SubmoduleMetadataOptions {
  /** Library URL slug (e.g., 'versioning' or 'utils/immutable-api') */
  librarySlug: string
  /** Full npm package name (e.g., '@hyperfrontend/versioning') */
  packageName: string
  /** Submodule subpath identifying the secondary entrypoint (e.g., 'commits/parse') */
  submodulePath: string
  /** Site-relative route path with a trailing slash */
  path: string
}

/**
 * Generate metadata for a library submodule documentation page. The
 * description comes from the submodule README's first meaningful paragraph,
 * falling back to the library's manifest description, then a generic sentence.
 *
 * @param options - Submodule page coordinates
 * @returns Metadata object with title, description, canonical, and social cards
 */
export function getSubmoduleMetadata(options: SubmoduleMetadataOptions): Metadata {
  const { librarySlug, packageName, submodulePath, path } = options
  const title = `${submodulePath} — ${packageName}`
  const readme = getSubmoduleReadme(librarySlug, submodulePath)
  const library = getManifest()?.libraries.find((lib) => lib.packageName === packageName)
  const description =
    (readme ? extractDescription(readme) : null) ??
    library?.description ??
    `Documentation for the ${submodulePath} entrypoint of ${packageName}.`

  return {
    title,
    description,
    ...buildSocialMetadata(title, description, path, undefined, readme !== null),
  }
}

/**
 * Generate metadata for the guides index.
 *
 * @returns Metadata object with title, description, canonical, and social cards
 */
export function getGuidesIndexMetadata(): Metadata {
  const description =
    'Tutorials and how-to guides for the HyperFrontend packages. Every code example is extracted from running source or run against a named version.'

  return {
    title: 'Guides & Tutorials',
    description,
    ...buildSocialMetadata('Guides & Tutorials', description, '/docs/guides/'),
  }
}

/**
 * Generate metadata for a guide page. The description is the guide's problem
 * statement, the text a reader searching for this material would recognize.
 *
 * A guide is shared as an article rather than as a website, dated by the day
 * its examples were last run: that is the claim the page actually makes about
 * its own freshness.
 *
 * @param slug - The guide slug from the URL
 * @returns Metadata object with title, description, keywords, canonical, and social cards
 */
export function getGuideMetadata(slug: string): Metadata {
  const guide = getGuideIndex().find((entry) => entry.slug === slug)

  if (!guide) {
    return { title: 'Guide Not Found' }
  }

  return {
    title: guide.title,
    description: truncateDescription(guide.problem),
    keywords: [...guide.packages, ...guide.keywords],
    ...buildSocialMetadata(
      guide.title,
      truncateDescription(guide.problem),
      `/docs/guides/${slug}/`,
      { modifiedTime: guide.verification.verifiedOn },
      true
    ),
  }
}

/**
 * Generate metadata for a library architecture documentation page. The
 * description comes from the architecture doc's first meaningful paragraph,
 * falling back to the library's manifest description, then a generic sentence.
 *
 * @param librarySlug - The library URL slug
 * @returns Metadata object with title, description, canonical, and social cards
 */
export function getArchitectureMetadata(librarySlug: string): Metadata {
  const library = getManifest()?.libraries.find((lib) => lib.slug === librarySlug)
  const packageName = library?.packageName ?? `@hyperfrontend/${librarySlug}`
  const title = `Architecture — ${packageName}`
  const doc = getLibraryArchitecture(librarySlug)
  const description = (doc ? extractDescription(doc) : null) ?? library?.description ?? `Architecture documentation for ${packageName}.`

  return {
    title,
    description,
    ...buildSocialMetadata(title, description, `/docs/libraries/${librarySlug}/architecture/`, undefined, doc !== null),
  }
}

/**
 * Generate metadata for the fit assessment. The description is written for the
 * search result itself: someone deciding between microfrontend approaches has
 * to recognize this page as the thing that answers that question.
 *
 * It is shared as an article dated by the research snapshot, because the page's
 * claims are only as current as the comparison behind them.
 *
 * @param lastReviewed - ISO date the underlying research was last verified
 * @returns Metadata object with title, description, keywords, canonical, and social cards
 */
export function getFitAssessmentMetadata(lastReviewed: string): Metadata {
  const title = 'Is HyperFrontend right for you?'
  const description =
    'Answer a few questions about ownership, deployment, and isolation to see which microfrontend approach fits your situation, or whether you need one at all.'

  return {
    title,
    description,
    keywords: [
      'microfrontend decision',
      'microfrontend architecture',
      'choose a microfrontend framework',
      'module federation alternative',
      'iframe microfrontends',
      'single-spa alternative',
      'do I need microfrontends',
      'hyperfrontend',
    ],
    ...buildSocialMetadata(title, description, '/docs/is-hyperfrontend-right-for-you/', { modifiedTime: lastReviewed }),
  }
}
