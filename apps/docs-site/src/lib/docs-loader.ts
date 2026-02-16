import fs from 'fs'
import path from 'path'

const GENERATED_DIR = path.resolve(process.cwd(), '.generated')
const DOCS_DIR = path.join(GENERATED_DIR, 'docs')
const API_DIR = path.join(GENERATED_DIR, 'api')
const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..')

interface Manifest {
  generatedAt: string
  libraries: {
    name: string
    packageName: string
    slug: string
    category: string
    readme: string | null
    architecture: string | null
    hasApi: boolean
  }[]
  rootDocs: {
    architecture: boolean
    contributing: boolean
  }
}

/**
 * Load and parse the documentation manifest file
 *
 * @returns The manifest object or null if not found
 */
export function getManifest(): Manifest | null {
  const manifestPath = path.join(GENERATED_DIR, 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
}

/**
 * Load README content for a library from generated or source files
 *
 * @param slug - The URL slug identifier for the library
 * @returns The README content as a string or null if not found
 */
export function getLibraryReadme(slug: string): string | null {
  // First check generated content
  const generatedPath = path.join(DOCS_DIR, slug, 'readme.md')
  if (fs.existsSync(generatedPath)) {
    return fs.readFileSync(generatedPath, 'utf-8')
  }

  // Fall back to direct file access (for development)
  const directPaths = [
    path.join(WORKSPACE_ROOT, 'libs', slug, 'README.md'),
    path.join(WORKSPACE_ROOT, 'libs/utils', slug, 'README.md'),
    path.join(WORKSPACE_ROOT, 'plugins', slug, 'README.md'),
  ]

  for (const p of directPaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8')
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
  // First check generated content
  const generatedPath = path.join(DOCS_DIR, slug, 'architecture.md')
  if (fs.existsSync(generatedPath)) {
    return fs.readFileSync(generatedPath, 'utf-8')
  }

  // Fall back to direct file access
  const directPaths = [
    path.join(WORKSPACE_ROOT, 'libs', slug, 'ARCHITECTURE.md'),
    path.join(WORKSPACE_ROOT, 'libs/utils', slug, 'ARCHITECTURE.md'),
  ]

  for (const p of directPaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8')
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
  const apiPath = path.join(API_DIR, slug, 'api.json')

  if (!fs.existsSync(apiPath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(apiPath, 'utf-8'))
}

/**
 * Load the root ARCHITECTURE.md from generated or source files
 *
 * @returns The architecture document content or null if not found
 */
export function getRootArchitecture(): string | null {
  const generatedPath = path.join(DOCS_DIR, 'architecture.md')
  if (fs.existsSync(generatedPath)) {
    return fs.readFileSync(generatedPath, 'utf-8')
  }

  // Fall back to direct file access
  const directPath = path.join(WORKSPACE_ROOT, 'ARCHITECTURE.md')
  if (fs.existsSync(directPath)) {
    return fs.readFileSync(directPath, 'utf-8')
  }

  return null
}

/**
 * Load the CONTRIBUTING.md guide from generated or source files
 *
 * @returns The contributing guide content or null if not found
 */
export function getContributingGuide(): string | null {
  const generatedPath = path.join(DOCS_DIR, 'contributing.md')
  if (fs.existsSync(generatedPath)) {
    return fs.readFileSync(generatedPath, 'utf-8')
  }

  // Fall back to direct file access
  const directPath = path.join(WORKSPACE_ROOT, 'CONTRIBUTING.md')
  if (fs.existsSync(directPath)) {
    return fs.readFileSync(directPath, 'utf-8')
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

  // Fall back to scanning directories
  const libs: string[] = []

  // Main libs
  const libsDir = path.join(WORKSPACE_ROOT, 'libs')
  if (fs.existsSync(libsDir)) {
    fs.readdirSync(libsDir).forEach((item) => {
      const itemPath = path.join(libsDir, item)
      if (fs.statSync(itemPath).isDirectory() && item !== 'utils') {
        libs.push(item)
      }
    })
  }

  // Utils sub-packages
  const utilsDir = path.join(WORKSPACE_ROOT, 'libs/utils')
  if (fs.existsSync(utilsDir)) {
    fs.readdirSync(utilsDir).forEach((item) => {
      const itemPath = path.join(utilsDir, item)
      if (fs.statSync(itemPath).isDirectory()) {
        libs.push(`${item}-utils`)
      }
    })
  }

  // Plugins
  const pluginsDir = path.join(WORKSPACE_ROOT, 'plugins')
  if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir).forEach((item) => {
      const itemPath = path.join(pluginsDir, item)
      if (fs.statSync(itemPath).isDirectory()) {
        libs.push(item)
      }
    })
  }

  return libs
}
