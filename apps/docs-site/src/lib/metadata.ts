import type { Metadata } from 'next'
import { getLibraryArchitecture, getManifest, getSubmoduleReadme } from './docs-loader'

/** Longest description surfaced to search and social snippets before truncation. */
const DESCRIPTION_MAX_LENGTH = 160

/** Default Open Graph card image shared by every page that does not supply its own. */
export const DEFAULT_OG_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  alt: 'HyperFrontend — compose your existing apps together securely, like Lego bricks.',
}

/** Default Twitter card image shared by every page that does not supply its own. */
export const DEFAULT_TWITTER_IMAGE = {
  url: '/twitter-image.png',
  width: 1200,
  height: 600,
  alt: 'HyperFrontend — compose your existing apps together securely, like Lego bricks.',
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

/**
 * Build the canonical, Open Graph, and Twitter fields shared by docs pages.
 *
 * @param title - Page title without the site suffix
 * @param description - Page description
 * @param path - Site-relative page path with a trailing slash
 * @returns Metadata slice with alternates, openGraph, and twitter populated
 */
function buildSocialMetadata(title: string, description: string | undefined, path: string): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: {
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
    ...buildSocialMetadata(library.name, library.description, path),
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
    ...buildSocialMetadata(title, description, path),
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
    ...buildSocialMetadata(title, description, `/docs/libraries/${librarySlug}/architecture/`),
  }
}
