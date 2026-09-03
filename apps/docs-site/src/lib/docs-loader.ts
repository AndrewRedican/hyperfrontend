import type { ApiLinkIndex, PackageSymbolLinks } from '@/components/api-reference/api-link-context'
import type { EcosystemLibrary } from '@/lib/ecosystem'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { LIBRARIES } from '@/lib/content'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

const GENERATED_DIR = resolve(process.cwd(), '.generated')
const DOCS_DIR = join(GENERATED_DIR, 'docs')
const API_DIR = join(GENERATED_DIR, 'api')
const WORKSPACE_ROOT = resolve(process.cwd(), '../..')

/**
 * Map of URL slugs to generated content slugs for utils packages
 * URL path: /docs/libraries/utils/{shortSlug} -> Generated slug: {shortSlug}-utils
 */
const UTILS_SLUG_MAP: Record<string, string> = {
  data: 'data-utils',
  function: 'function-utils',
  'immutable-api': 'immutable-api-utils',
  json: 'json-utils',
  list: 'list-utils',
  'random-generator': 'random-generator-utils',
  string: 'string-utils',
  time: 'time-utils',
  ui: 'ui-utils',
}

/**
 * Convert a URL slug to the corresponding generated content slug.
 *
 * Accepts both the short form used by library landing pages (e.g., `string`) and
 * the full URL slug carried in `LibraryInfo` (e.g., `utils/string`). Either yields
 * the canonical generated-content directory name (`string-utils`).
 *
 * @param slug - The URL slug (e.g., 'data', 'utils/data', or 'nexus')
 * @returns The generated content slug (e.g., 'data-utils' or 'nexus')
 */
function resolveGeneratedSlug(slug: string): string {
  if (UTILS_SLUG_MAP[slug]) return UTILS_SLUG_MAP[slug]
  if (slug.startsWith('utils/')) {
    const short = slug.slice('utils/'.length)
    if (UTILS_SLUG_MAP[short]) return UTILS_SLUG_MAP[short]
  }
  return slug
}

/**
 * Single library entry in the documentation manifest.
 */
interface ManifestLibrary {
  /** Library display name */
  name: string
  /** npm package name */
  packageName: string
  /** URL slug */
  slug: string
  /** Library category */
  category: string
  /** Path to README file (null if missing) */
  readme: string | null
  /** Path to architecture doc (null if missing) */
  architecture: string | null
  /** Whether API docs exist */
  hasApi: boolean
  /** Keywords from package.json */
  keywords: string[]
  /** Description from package.json */
  description: string
  /** Released version, empty when the package.json carries none */
  version?: string
  /** Whether the package is withheld from the registry */
  isPrivate?: boolean
}

/**
 * Availability flags for top-level (non-library) documentation pages.
 */
interface ManifestRootDocs {
  /** Whether architecture doc exists */
  architecture: boolean
  /** Whether contributing doc exists */
  contributing: boolean
}

/**
 * Documentation manifest containing library metadata and generation info.
 */
interface Manifest {
  /** Timestamp when docs were generated */
  generatedAt: string
  /** Library metadata entries */
  libraries: ManifestLibrary[]
  /** Root documentation availability */
  rootDocs: ManifestRootDocs
}

/**
 * Load and parse the documentation manifest file
 *
 * @returns The manifest object or null if not found
 */
export function getManifest(): Manifest | null {
  const manifestPath = join(GENERATED_DIR, 'manifest.json')

  if (!existsSync(manifestPath)) {
    return null
  }

  return parse(readFileSync(manifestPath, 'utf-8'))
}

/**
 * Load README content for a library from generated or source files
 *
 * @param slug - The URL slug identifier for the library
 * @returns The README content as a string or null if not found
 */
export function getLibraryReadme(slug: string): string | null {
  const generatedSlug = resolveGeneratedSlug(slug)

  const generatedPath = join(DOCS_DIR, generatedSlug, 'readme.md')
  if (existsSync(generatedPath)) {
    return readFileSync(generatedPath, 'utf-8')
  }

  const directPaths = [join(WORKSPACE_ROOT, 'libs', slug, 'README.md'), join(WORKSPACE_ROOT, 'libs/utils', slug, 'README.md')]

  for (const p of directPaths) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8')
    }
  }

  return null
}

/**
 * Load README content for a library submodule
 *
 * @param librarySlug - The library URL slug (e.g., 'network-protocol')
 * @param submodulePath - The submodule path (e.g., 'channel', 'commits/classify')
 * @returns The README content or null if not found
 */
export function getSubmoduleReadme(librarySlug: string, submodulePath: string): string | null {
  const generatedPath = join(DOCS_DIR, librarySlug, submodulePath, 'readme.md')
  if (existsSync(generatedPath)) {
    return readFileSync(generatedPath, 'utf-8')
  }

  const sourcePaths = [
    join(WORKSPACE_ROOT, 'libs', librarySlug, 'src', 'lib', submodulePath, 'README.md'),
    join(WORKSPACE_ROOT, 'libs', librarySlug, 'src', submodulePath, 'README.md'),
  ]

  for (const p of sourcePaths) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8')
    }
  }

  return null
}

/**
 * Load architecture documentation for a library from generated or source files
 *
 * @param slug - The URL slug identifier for the library
 * @returns The architecture document content or null if not found
 */
export function getLibraryArchitecture(slug: string): string | null {
  const generatedSlug = resolveGeneratedSlug(slug)

  const generatedPath = join(DOCS_DIR, generatedSlug, 'architecture.md')
  if (existsSync(generatedPath)) {
    return readFileSync(generatedPath, 'utf-8')
  }

  const directPaths = [join(WORKSPACE_ROOT, 'libs', slug, 'ARCHITECTURE.md'), join(WORKSPACE_ROOT, 'libs/utils', slug, 'ARCHITECTURE.md')]

  for (const p of directPaths) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8')
    }
  }

  return null
}

/**
 * Load TypeDoc-generated API documentation JSON for a library
 *
 * @param slug - The URL slug identifier for the library
 * @returns The parsed API documentation object or null if not found
 */
export function getLibraryApi(slug: string): unknown | null {
  const generatedSlug = resolveGeneratedSlug(slug)
  const apiPath = join(API_DIR, generatedSlug, 'api.json')

  if (!existsSync(apiPath)) {
    return null
  }

  return parse(readFileSync(apiPath, 'utf-8'))
}

/**
 * Load the root ARCHITECTURE.md from generated or source files
 *
 * @returns The architecture document content or null if not found
 */
export function getRootArchitecture(): string | null {
  const generatedPath = join(DOCS_DIR, 'architecture.md')
  if (existsSync(generatedPath)) {
    return readFileSync(generatedPath, 'utf-8')
  }

  const directPath = join(WORKSPACE_ROOT, 'ARCHITECTURE.md')
  if (existsSync(directPath)) {
    return readFileSync(directPath, 'utf-8')
  }

  return null
}

/**
 * Load the CONTRIBUTING.md guide from generated or source files
 *
 * @returns The contributing guide content or null if not found
 */
export function getContributingGuide(): string | null {
  const generatedPath = join(DOCS_DIR, 'contributing.md')
  if (existsSync(generatedPath)) {
    return readFileSync(generatedPath, 'utf-8')
  }

  const directPath = join(WORKSPACE_ROOT, 'CONTRIBUTING.md')
  if (existsSync(directPath)) {
    return readFileSync(directPath, 'utf-8')
  }

  return null
}

/**
 * Transform relative markdown links to docs site URLs.
 *
 * @param content - The markdown content with relative links
 * @returns The content with transformed links
 */
function transformRootDocLinks(content: string): string {
  const linkMappings: Array<[string, string]> = [
    ['ARCHITECTURE.md', '/architecture'],
    ['CONTRIBUTING.md', '/docs/contributing'],
    ['MANIFESTO.md', '/docs/manifesto'],
    ['ACKNOWLEDGMENTS.md', '/docs/acknowledgments'],
    ['REGARDING_AI.md', '/docs/regarding-ai'],
  ]

  let transformed = content

  for (const [source, target] of linkMappings) {
    // why: Replace ](SOURCE.md) and ](SOURCE.md#anchor) patterns with target URL
    const linkPrefix = `](${source}`
    let searchStart = 0

    while (true) {
      const linkStart = transformed.indexOf(linkPrefix, searchStart)
      if (linkStart === -1) break

      const afterSource = linkStart + linkPrefix.length
      const char = transformed[afterSource]

      if (char === ')') {
        // why: Simple case: ](SOURCE.md)
        transformed = transformed.slice(0, linkStart) + `](${target})` + transformed.slice(afterSource + 1)
        searchStart = linkStart + target.length + 3
      } else if (char === '#') {
        // why: Anchor case: ](SOURCE.md#section)
        const closeIndex = transformed.indexOf(')', afterSource)
        if (closeIndex !== -1) {
          const anchor = transformed.slice(afterSource, closeIndex)
          transformed = transformed.slice(0, linkStart) + `](${target}${anchor})` + transformed.slice(closeIndex + 1)
          searchStart = linkStart + target.length + anchor.length + 3
        } else {
          searchStart = afterSource
        }
      } else {
        searchStart = afterSource
      }
    }
  }

  return transformed
}

/**
 * Load the MANIFESTO.md from generated or source files
 *
 * @returns The manifesto content or null if not found
 */
export function getManifesto(): string | null {
  const generatedPath = join(DOCS_DIR, 'manifesto.md')
  if (existsSync(generatedPath)) {
    return transformRootDocLinks(readFileSync(generatedPath, 'utf-8'))
  }

  const directPath = join(WORKSPACE_ROOT, 'MANIFESTO.md')
  if (existsSync(directPath)) {
    return transformRootDocLinks(readFileSync(directPath, 'utf-8'))
  }

  return null
}

/**
 * Load the ACKNOWLEDGMENTS.md from generated or source files
 *
 * @returns The acknowledgments content or null if not found
 */
export function getAcknowledgments(): string | null {
  const generatedPath = join(DOCS_DIR, 'acknowledgments.md')
  if (existsSync(generatedPath)) {
    return transformRootDocLinks(readFileSync(generatedPath, 'utf-8'))
  }

  const directPath = join(WORKSPACE_ROOT, 'ACKNOWLEDGMENTS.md')
  if (existsSync(directPath)) {
    return transformRootDocLinks(readFileSync(directPath, 'utf-8'))
  }

  return null
}

/**
 * Load the REGARDING_AI.md from generated or source files
 *
 * @returns The regarding AI content or null if not found
 */
export function getRegardingAi(): string | null {
  const generatedPath = join(DOCS_DIR, 'regarding-ai.md')
  if (existsSync(generatedPath)) {
    return transformRootDocLinks(readFileSync(generatedPath, 'utf-8'))
  }

  const directPath = join(WORKSPACE_ROOT, 'REGARDING_AI.md')
  if (existsSync(directPath)) {
    return transformRootDocLinks(readFileSync(directPath, 'utf-8'))
  }

  return null
}

/**
 * Contributor entry from .all-contributorsrc
 */
export interface Contributor {
  /** GitHub login */
  login: string
  /** Display name */
  name: string
  /** Avatar URL */
  avatar_url: string
  /** Profile URL */
  profile: string
  /** Contribution types */
  contributions: string[]
}

/**
 * Load the contributors list from .all-contributorsrc
 *
 * @returns Array of contributors or empty array if not found
 */
export function getContributors(): Contributor[] {
  const contributorsPath = join(WORKSPACE_ROOT, '.all-contributorsrc')
  if (!existsSync(contributorsPath)) {
    return []
  }

  const data = parse(readFileSync(contributorsPath, 'utf-8'))
  if (data && typeof data === 'object' && 'contributors' in data && isArray(data.contributors)) {
    return data.contributors as Contributor[]
  }

  return []
}

/**
 * Retrieve a list of all library slug identifiers
 *
 * @returns An array of library slugs
 */
export function getAllLibrarySlugs(): string[] {
  const manifest = getManifest()
  if (manifest) {
    return manifest.libraries.map((lib) => lib.slug)
  }

  const libs: string[] = []

  const libsDir = join(WORKSPACE_ROOT, 'libs')
  if (existsSync(libsDir)) {
    readdirSync(libsDir).forEach((item) => {
      const itemPath = join(libsDir, item)
      if (statSync(itemPath).isDirectory() && item !== 'utils') {
        libs.push(item)
      }
    })
  }

  const utilsDir = join(WORKSPACE_ROOT, 'libs/utils')
  if (existsSync(utilsDir)) {
    readdirSync(utilsDir).forEach((item) => {
      const itemPath = join(utilsDir, item)
      if (statSync(itemPath).isDirectory()) {
        libs.push(`${item}-utils`)
      }
    })
  }

  return libs
}

/** Reflection kind number TypeDoc gives module containers. */
const MODULE_KIND = 2

/** Minimal structural view of TypeDoc JSON used to index exported symbols. */
interface RawApiNode {
  /** Element name */
  name?: string
  /** Reflection kind number */
  kind?: number
  /** Child declarations */
  children?: RawApiNode[]
}

let packageLinksCache: Map<string, PackageSymbolLinks> | null = null

/**
 * Index every documented hyperfrontend package: its docs page href and the
 * exported symbol names that get an `api-<name>` anchor on that page.
 *
 * @returns Map from npm package name to its docs location and symbols
 */
function collectPackageSymbolLinks(): Map<string, PackageSymbolLinks> {
  if (packageLinksCache) return packageLinksCache

  const links = createMap<string, PackageSymbolLinks>()
  const manifest = getManifest()

  for (const lib of manifest?.libraries ?? []) {
    if (!lib.hasApi) continue
    const api = getLibraryApi(lib.slug) as RawApiNode | null
    if (!api?.children) continue

    const symbols: Record<string, true> = {}
    for (const child of api.children) {
      if (child.kind === MODULE_KIND) {
        for (const moduleChild of child.children ?? []) {
          if (moduleChild.name) symbols[moduleChild.name] = true
        }
      } else if (child.name) {
        symbols[child.name] = true
      }
    }

    const href = lib.category === 'utils' ? `/docs/libraries/utils/${lib.slug.replace('-utils', '')}/` : `/docs/libraries/${lib.slug}/`
    links.set(lib.packageName, { href, symbols })
  }

  packageLinksCache = links
  return links
}

/**
 * Build the symbol-link index for one library page: every hyperfrontend
 * package its API data references, restricted to the referenced symbols
 * verified to exist in the target package's generated docs.
 *
 * @param slug - The URL slug identifier for the library
 * @param packageName - The npm package the page documents
 * @returns Package name mapped to docs href and linkable symbols
 */
export function getApiLinkIndex(slug: string, packageName: string): ApiLinkIndex {
  const api = getLibraryApi(slug)
  if (!api) return {}

  const referenced = createMap<string, Set<string>>()

  /**
   * Recursively collects referenced package/symbol pairs from TypeDoc data.
   *
   * @param node - The JSON subtree to scan
   */
  const visit = (node: unknown): void => {
    if (isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    const refPackage = record['package']
    const refName = record['name']
    if (record['type'] === 'reference' && typeof refPackage === 'string' && typeof refName === 'string') {
      const names = referenced.get(refPackage) ?? createSet<string>()
      names.add(refName.replace(/^globalThis\./, ''))
      referenced.set(refPackage, names)
    }
    for (const value of values(record)) visit(value)
  }
  visit(api)

  const packages = collectPackageSymbolLinks()
  const index: ApiLinkIndex = {}

  for (const [refPackage, names] of referenced) {
    const links = packages.get(refPackage)
    if (!links) continue
    const symbols: Record<string, true> = {}
    let linkable = 0
    for (const name of names) {
      if (links.symbols[name]) {
        symbols[name] = true
        linkable++
      }
    }
    if (linkable > 0) index[refPackage] = { href: links.href, symbols }
  }

  // why: References TypeDoc leaves unattributed fall back to the page's own package, so its full export map must be present.
  const own = packages.get(packageName)
  if (own) index[packageName] = own

  return index
}

/**
 * Library data for the packages index page.
 */
export interface LibraryData extends EcosystemLibrary {
  /** URL slug */
  slug: string
  /** Library category */
  category: string
  /** Whether API docs exist */
  hasApi: boolean
}

/**
 * Every documented library, ready for the ecosystem index page.
 *
 * The package set comes from `LIBRARIES`, the list the `docs-site-libraries`
 * lint rule holds against the workspace, so a library that lint accepts can
 * never be missing from the page. Description, keywords, and version are read
 * from the generated manifest, which copies them straight out of each
 * package.json, so the cards say what npm says. A library the manifest has not
 * covered yet still appears, with the fields the manifest owns left empty.
 *
 * @returns One entry per documented library, in `LIBRARIES` order
 */
export function getAllLibraryData(): LibraryData[] {
  const manifest = getManifest()
  const published = createMap((manifest?.libraries ?? []).map((lib) => [lib.packageName, lib]))

  return LIBRARIES.map((lib) => {
    const entry = published.get(lib.packageName)

    return {
      name: lib.name,
      packageName: lib.packageName,
      slug: lib.slug,
      category: lib.category,
      hasApi: entry?.hasApi ?? false,
      keywords: entry?.keywords ?? [],
      description: entry?.description ?? '',
      version: entry?.version ?? '',
      isPrivate: entry?.isPrivate ?? false,
      href: `/docs/libraries/${lib.slug}`,
    }
  })
}
