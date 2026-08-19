import type { GuideIndex, GuideIndexEntry } from '../../scripts/generate-guides.types'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { getManifest } from './docs-loader'
import { filterGuides } from './guide-filters'

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
  return filterGuides(getGuideIndex(), { package: packageName })
}

/**
 * One selectable package in the guides index's package filter.
 */
export interface GuidePackageOption {
  /** npm package name, the filter's URL value */
  packageName: string
  /** Library display name */
  name: string
  /** How many compiled guides involve the package */
  guideCount: number
}

/**
 * List every documented package as a guides-filter option, with how many
 * guides each one has.
 *
 * The options come from the documentation manifest rather than from the guide
 * corpus, so a package nobody has written a guide for yet is still selectable
 * and its shared URL still resolves to a deliberate empty state instead of a
 * filter the reader cannot see.
 *
 * @returns Options for every documented package, display-name sorted
 */
export function getGuidePackageOptions(): GuidePackageOption[] {
  const guides = getGuideIndex()
  const libraries = getManifest()?.libraries ?? []
  return libraries
    .map((library) => ({
      packageName: library.packageName,
      name: library.name,
      guideCount: guides.filter((guide) => guide.packages.includes(library.packageName)).length,
    }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName))
}
