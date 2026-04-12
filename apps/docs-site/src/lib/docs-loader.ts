import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

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
 * @param slug - The URL slug (e.g., 'data' or 'nexus')
 * @returns The generated content slug (e.g., 'data-utils' or 'nexus')
 */
function resolveGeneratedSlug(slug: string): string {
  return UTILS_SLUG_MAP[slug] || slug
}

/**
 * Documentation manifest containing library metadata and generation info.
 */
interface Manifest {
  /** Timestamp when docs were generated */
  generatedAt: string
  /** Library metadata entries */
  libraries: {
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
  }[]
  /** Root documentation availability */
  rootDocs: {
    /** Whether architecture doc exists */
    architecture: boolean
    /** Whether contributing doc exists */
    contributing: boolean
  }
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

  const directPaths = [
    join(WORKSPACE_ROOT, 'libs', slug, 'README.md'),
    join(WORKSPACE_ROOT, 'libs/utils', slug, 'README.md'),
    join(WORKSPACE_ROOT, 'plugins', slug, 'README.md'),
  ]

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
    return <Contributor[]>data.contributors
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

  const pluginsDir = join(WORKSPACE_ROOT, 'plugins')
  if (existsSync(pluginsDir)) {
    readdirSync(pluginsDir).forEach((item) => {
      const itemPath = join(pluginsDir, item)
      if (statSync(itemPath).isDirectory()) {
        libs.push(item)
      }
    })
  }

  return libs
}

/**
 * Library data for the packages index page.
 */
export interface LibraryData {
  /** Library display name */
  name: string
  /** npm package name */
  packageName: string
  /** URL slug */
  slug: string
  /** Library category */
  category: string
  /** Whether API docs exist */
  hasApi: boolean
  /** Keywords from package.json */
  keywords: string[]
  /** Description from package.json */
  description: string
  /** Full href path for the library */
  href: string
}

/**
 * Get all library data for the packages index page.
 * Returns data from manifest if available, otherwise constructs from filesystem.
 *
 * @returns Array of library data with keywords and descriptions
 */
export function getAllLibraryData(): LibraryData[] {
  const manifest = getManifest()

  if (manifest) {
    return manifest.libraries.map((lib) => {
      const isUtils = lib.category === 'utils'
      const isPlugin = lib.category === 'plugin'
      let href: string

      if (isPlugin) {
        href = `/docs/plugins/${lib.slug}`
      } else if (isUtils) {
        const shortSlug = lib.slug.replace('-utils', '')
        href = `/docs/libraries/utils/${shortSlug}`
      } else {
        href = `/docs/libraries/${lib.slug}`
      }

      return {
        name: lib.name,
        packageName: lib.packageName,
        slug: lib.slug,
        category: lib.category,
        hasApi: lib.hasApi,
        keywords: lib.keywords || [],
        description: lib.description || '',
        href,
      }
    })
  }

  return []
}
