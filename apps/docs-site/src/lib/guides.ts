import type { GuideIndex, GuideIndexEntry } from '../../scripts/generate-guides.types'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

const GUIDES_DIR = resolve(process.cwd(), '.generated/guides')

/**
 * A fully loaded guide: its index entry plus the compiled markdown.
 */
export interface Guide extends GuideIndexEntry {
  /** Compiled guide markdown with snippets resolved */
  content: string
}

export type { GuideIndexEntry } from '../../scripts/generate-guides.types'

/**
 * Load the compiled guide corpus index.
 *
 * @returns Every compiled guide's index entry, slug-sorted; empty when guides have not been generated
 */
export function getGuideIndex(): GuideIndexEntry[] {
  const indexPath = join(GUIDES_DIR, 'index.json')
  if (!existsSync(indexPath)) {
    return []
  }
  const index: GuideIndex = parse(readFileSync(indexPath, 'utf-8'))
  return index.guides
}

/**
 * Get all guide slugs for static route generation.
 *
 * @returns Slugs of every compiled guide
 */
export function getAllGuideSlugs(): string[] {
  return getGuideIndex().map((guide) => guide.slug)
}

/**
 * Load one compiled guide by slug.
 *
 * @param slug - The guide slug from the URL
 * @returns The guide with its compiled content, or null when it does not exist
 */
export function getGuide(slug: string): Guide | null {
  const entry = getGuideIndex().find((guide) => guide.slug === slug)
  if (!entry) {
    return null
  }
  const contentPath = join(GUIDES_DIR, slug, 'guide.md')
  if (!existsSync(contentPath)) {
    return null
  }
  return { ...entry, content: readFileSync(contentPath, 'utf-8') }
}

/**
 * List the guides that involve a package, owners first.
 *
 * @param packageName - Full npm package name (e.g. '@hyperfrontend/nexus')
 * @returns Index entries of every guide whose packages list includes the package
 */
export function getGuidesForPackage(packageName: string): GuideIndexEntry[] {
  const involved = getGuideIndex().filter((guide) => guide.packages.includes(packageName))
  return involved.sort((a, b) => {
    const aOwns = a.packages[0] === packageName ? 0 : 1
    const bOwns = b.packages[0] === packageName ? 0 : 1
    return aOwns - bOwns || a.slug.localeCompare(b.slug)
  })
}
