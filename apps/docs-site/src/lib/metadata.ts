import type { Metadata } from 'next'
import { getManifest } from './docs-loader'

/**
 * Generate metadata for a library documentation page.
 *
 * @param slug - The library URL slug
 * @returns Metadata object with title, description, and keywords
 */
export function getLibraryMetadata(slug: string): Metadata {
  const manifest = getManifest()
  const library = manifest?.libraries.find((lib) => lib.slug === slug)

  if (!library) {
    return {
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
    }
  }

  return {
    title: library.name,
    description: library.description,
    keywords: library.keywords,
  }
}
