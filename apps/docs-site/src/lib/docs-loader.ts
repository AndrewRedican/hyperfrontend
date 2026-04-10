import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
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
