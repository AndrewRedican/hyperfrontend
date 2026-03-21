#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

/**
 * Checks if a line contains a URL pointing to the docs site (www.hyperfrontend.dev).
 * Uses proper URL parsing to validate the host instead of substring matching.
 *
 * @param line - Text line to check for docs URLs
 * @returns True if the line contains a valid docs site URL
 */
function containsDocsUrl(line: string): boolean {
  // Extract URLs from the line using a simple pattern
  const urlPattern = /https?:\/\/[^\s)>\]"']+/g
  const urls = line.match(urlPattern) ?? []

  for (const url of urls) {
    try {
      const parsed = createURL(url)
      if (parsed.host === 'www.hyperfrontend.dev' || parsed.host === 'hyperfrontend.dev') {
        return true
      }
    } catch {
      // Invalid URL, skip
    }
  }
  return false
}

const WORKSPACE_ROOT = resolve(__dirname, '../../..')
const OUTPUT_DIR = resolve(__dirname, '../.generated')
const DOCS_OUTPUT = join(OUTPUT_DIR, 'docs')
const API_OUTPUT = join(OUTPUT_DIR, 'api')

interface LibraryConfig {
  name: string
  packageName: string
  slug: string
  srcPath: string
  category: 'core' | 'supporting' | 'utils' | 'plugin'
}

interface PackageJson {
  name?: string
  main?: string
  exports?: Record<string, string | Record<string, string>>
}

/**
 * Discovers TypeScript entry points from a library's package.json.
 *
 * Reads the `exports` field (preferred) or falls back to `main` field.
 * Converts JavaScript paths (./src/X/index.js) to TypeScript (src/X/index.ts).
 *
 * @param libPath - Absolute path to the library directory
 * @returns Array of relative entry point paths (e.g., ['src/index.ts', 'src/browser/index.ts'])
 */
function discoverEntryPointsFromPackageJson(libPath: string): string[] {
  const packageJsonPath = join(libPath, 'package.json')

  if (!existsSync(packageJsonPath)) {
    log(`  ⚠ No package.json found at ${libPath}`)
    return []
  }

  const packageJson: PackageJson = parse(readFileSync(packageJsonPath, 'utf-8'))
  const entryPoints: string[] = []

  // First try exports field (modern packages)
  if (packageJson.exports && typeof packageJson.exports === 'object') {
    for (const [, exportValue] of entries(packageJson.exports)) {
      // Handle direct string exports: "./browser": "./src/browser/index.js"
      if (typeof exportValue === 'string') {
        const tsPath = convertJsPathToTs(exportValue)
        if (tsPath) entryPoints.push(tsPath)
      }
      // Handle conditional exports: "./browser": { "import": "./src/browser/index.js" }
      else if (typeof exportValue === 'object') {
        const importPath = exportValue.import || exportValue.default || exportValue.require
        if (typeof importPath === 'string') {
          const tsPath = convertJsPathToTs(importPath)
          if (tsPath) entryPoints.push(tsPath)
        }
      }
    }
  }

  // Fall back to main field if no exports
  if (entryPoints.length === 0 && packageJson.main) {
    const tsPath = convertJsPathToTs(packageJson.main)
    if (tsPath) entryPoints.push(tsPath)
  }

  // Final fallback: check for standard src/index.ts
  if (entryPoints.length === 0) {
    const defaultEntry = 'src/index.ts'
    if (existsSync(join(libPath, defaultEntry))) {
      entryPoints.push(defaultEntry)
    }
  }

  return [...createSet(entryPoints)] // Deduplicate
}

/**
 * Converts a JavaScript path from package.json to a TypeScript source
 *
 * @param jsPath - JavaScript path (e.g., "./src/browser/index.js")
 * @returns TypeScript path (e.g., "src/browser/index.ts") or null if invalid
 */
function convertJsPathToTs(jsPath: string): string | null {
  if (!jsPath) return null

  // Remove leading ./
  let normalized = jsPath.replace(/^\.\//, '')

  // Skip non-source files (e.g., package.json exports)
  if (normalized.endsWith('.json')) {
    return null
  }

  // Convert .js to .ts
  if (normalized.endsWith('.js')) {
    normalized = normalized.slice(0, -3) + '.ts'
  } else if (!normalized.endsWith('.ts')) {
    // If no extension, assume it's a directory with index.ts
    normalized = join(normalized, 'index.ts')
  }

  return normalized
}

const LIBRARIES: LibraryConfig[] = [
  // Core libraries
  { name: 'Nexus', packageName: '@hyperfrontend/nexus', slug: 'nexus', srcPath: 'libs/nexus', category: 'core' },
  {
    name: 'Network Protocol',
    packageName: '@hyperfrontend/network-protocol',
    slug: 'network-protocol',
    srcPath: 'libs/network-protocol',
    category: 'core',
  },
  {
    name: 'Cryptography',
    packageName: '@hyperfrontend/cryptography',
    slug: 'cryptography',
    srcPath: 'libs/cryptography',
    category: 'core',
  },
  {
    name: 'Project Scope',
    packageName: '@hyperfrontend/project-scope',
    slug: 'project-scope',
    srcPath: 'libs/project-scope',
    category: 'core',
  },

  // Supporting libraries
  {
    name: 'State Machine',
    packageName: '@hyperfrontend/state-machine',
    slug: 'state-machine',
    srcPath: 'libs/state-machine',
    category: 'supporting',
  },
  { name: 'Logging', packageName: '@hyperfrontend/logging', slug: 'logging', srcPath: 'libs/logging', category: 'supporting' },
  { name: 'Web Worker', packageName: '@hyperfrontend/web-worker', slug: 'web-worker', srcPath: 'libs/web-worker', category: 'supporting' },
  {
    name: 'Versioning',
    packageName: '@hyperfrontend/versioning',
    slug: 'versioning',
    srcPath: 'libs/versioning',
    category: 'supporting',
  },

  // Utils sub-packages
  { name: 'Data Utils', packageName: '@hyperfrontend/data-utils', slug: 'data-utils', srcPath: 'libs/utils/data', category: 'utils' },
  {
    name: 'Function Utils',
    packageName: '@hyperfrontend/function-utils',
    slug: 'function-utils',
    srcPath: 'libs/utils/function',
    category: 'utils',
  },
  {
    name: 'Immutable API Utils',
    packageName: '@hyperfrontend/immutable-api-utils',
    slug: 'immutable-api-utils',
    srcPath: 'libs/utils/immutable-api',
    category: 'utils',
  },
  { name: 'JSON Utils', packageName: '@hyperfrontend/json-utils', slug: 'json-utils', srcPath: 'libs/utils/json', category: 'utils' },
  { name: 'List Utils', packageName: '@hyperfrontend/list-utils', slug: 'list-utils', srcPath: 'libs/utils/list', category: 'utils' },
  {
    name: 'Random Generator Utils',
    packageName: '@hyperfrontend/random-generator-utils',
    slug: 'random-generator-utils',
    srcPath: 'libs/utils/random-generator',
    category: 'utils',
  },
  {
    name: 'String Utils',
    packageName: '@hyperfrontend/string-utils',
    slug: 'string-utils',
    srcPath: 'libs/utils/string',
    category: 'utils',
  },
  { name: 'Time Utils', packageName: '@hyperfrontend/time-utils', slug: 'time-utils', srcPath: 'libs/utils/time', category: 'utils' },
  { name: 'UI Utils', packageName: '@hyperfrontend/ui-utils', slug: 'ui-utils', srcPath: 'libs/utils/ui', category: 'utils' },

  // Plugin
  { name: 'Features Plugin', packageName: '@hyperfrontend/features', slug: 'features', srcPath: 'plugins/features', category: 'plugin' },
]

/**
 * Create a directory if it doesn't exist
 *
 * @param dir - The directory path to create
 */
function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Library slug mappings for link transformation
 */
const LIBRARY_SLUGS: Record<string, string> = {
  nexus: 'nexus',
  'network-protocol': 'network-protocol',
  cryptography: 'cryptography',
  'project-scope': 'project-scope',
  'state-machine': 'state-machine',
  logging: 'logging',
  'web-worker': 'web-worker',
  versioning: 'versioning',
}

/**
 * Normalize a relative path by removing leading `./` and `../` segments.
 *
 * @param path - The path to normalize
 * @returns The normalized filename (basename)
 */
function normalizeRelativePath(path: string): string {
  let normalized = path
  // Remove leading ./
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  // Remove all leading ../
  while (normalized.startsWith('../')) {
    normalized = normalized.slice(3)
  }
  return normalized
}

/**
 * Extract link text and URL from a markdown link segment.
 * Given a segment that starts after `[`, extracts the text and URL.
 *
 * @param segment - Text starting with link text, e.g., "click here](https://example.com) more text"
 * @returns Object with linkText, url, and remainder, or null if not a valid link
 */
function extractMarkdownLink(segment: string): { linkText: string; url: string; remainder: string } | null {
  const linkEndIndex = segment.indexOf('](')
  if (linkEndIndex === -1) return null

  const linkText = segment.slice(0, linkEndIndex)
  const afterBracket = segment.slice(linkEndIndex + 2)

  const urlEndIndex = afterBracket.indexOf(')')
  if (urlEndIndex === -1) return null

  const url = afterBracket.slice(0, urlEndIndex)
  const remainder = afterBracket.slice(urlEndIndex + 1)

  return { linkText, url, remainder }
}

/**
 * Transform a single markdown link URL based on transformation rules.
 *
 * @param url - The original URL from the markdown link
 * @param sourceContext - Where this content came from ('root' | 'library')
 * @returns Object with transformed URL (or null to remove the link entirely)
 */
function transformLinkUrl(url: string, sourceContext: 'root' | 'library'): { url: string | null; keepAsText: boolean } {
  const normalized = normalizeRelativePath(url)

  // Root document mappings
  const rootDocMappings: Record<string, string> = {
    'README.md': '/',
    'ARCHITECTURE.md': '/architecture',
    'CONTRIBUTING.md': '/docs/contributing',
    'MANIFESTO.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/MANIFESTO.md',
    'LICENSE.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md',
    'SECURITY.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/SECURITY.md',
    'FUNDING.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/FUNDING.md',
  }

  // Check root document mappings
  if (rootDocMappings[normalized]) {
    return { url: rootDocMappings[normalized], keepAsText: false }
  }

  // Transform roadmap links to GitHub
  if (normalized.startsWith('roadmap/') && normalized.endsWith('.md')) {
    return { url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/${normalized}`, keepAsText: false }
  }

  // Transform .github links to GitHub
  if (normalized.startsWith('.github/')) {
    const path = normalized.slice(8) // Remove '.github/'
    return { url: `https://github.com/AndrewRedican/hyperfrontend/tree/main/.github/${path}`, keepAsText: false }
  }

  // Transform libs/X/ARCHITECTURE.md links to library pages
  if (normalized.startsWith('libs/') && normalized.includes('/ARCHITECTURE.md')) {
    const parts = normalized.split('/')
    if (parts.length >= 3) {
      const libName = parts[1]
      const slug = LIBRARY_SLUGS[libName]
      if (slug) {
        // Preserve anchor if present
        const anchorIndex = normalized.indexOf('#')
        const anchor = anchorIndex !== -1 ? normalized.slice(anchorIndex) : ''
        return { url: `/docs/libraries/${slug}${anchor}`, keepAsText: false }
      }
    }
  }

  // For library context, remove internal src/ links
  if (sourceContext === 'library') {
    if (normalized.startsWith('src/') || normalized === 'src') {
      return { url: null, keepAsText: true }
    }
  }

  // No transformation needed
  return { url, keepAsText: false }
}

/**
 * Transform links in markdown content for the docs site context.
 *
 * Handles:
 * - Root document links (README.md, LICENSE.md, etc.) → docs site pages
 * - Library architecture links (libs/X/ARCHITECTURE.md) → library pages
 * - Internal src/ links → removes or transforms
 * - GitHub URLs → preserves as external links
 *
 * @param content - Markdown content to transform
 * @param sourceContext - Where this content came from ('root' | 'library')
 * @returns Transformed markdown content
 */
function transformLinks(content: string, sourceContext: 'root' | 'library'): string {
  // Remove self-referential "See docs" lines added to library READMEs for GitHub/npm visibility.
  // Filter out any line that contains the 👉 See [**docs**] pattern pointing to the docs site.
  const transformed = content
    .split('\n')
    .filter((line) => !(line.includes('👉 See') && containsDocsUrl(line)))
    .join('\n')

  // Process all markdown links by splitting on '[' and reconstructing
  const parts = transformed.split('[')
  const result: string[] = [parts[0]] // First part is before any links

  for (let i = 1; i < parts.length; i++) {
    const segment = parts[i]
    const linkInfo = extractMarkdownLink(segment)

    if (linkInfo) {
      const { linkText, url, remainder } = linkInfo
      const transformation = transformLinkUrl(url, sourceContext)

      if (transformation.url === null && transformation.keepAsText) {
        // Remove link, keep text only
        result.push(linkText + remainder)
      } else if (transformation.url !== url) {
        // URL was transformed
        result.push(`[${linkText}](${transformation.url})${remainder}`)
      } else {
        // No transformation, keep original
        result.push(`[${segment}`)
      }
    } else {
      // Not a valid link, preserve original with the '['
      result.push(`[${segment}`)
    }
  }

  return result.join('')
}

/**
 * Extract README.md content from a library
 *
 * @param lib - The library configuration
 * @returns An object with the content and whether it exists
 */
function extractReadme(lib: LibraryConfig): { content: string; exists: boolean } {
  const readmePath = join(WORKSPACE_ROOT, lib.srcPath, 'README.md')

  if (!existsSync(readmePath)) {
    log(`  ⚠ No README.md found for ${lib.name}`)
    return { content: '', exists: false }
  }

  const content = readFileSync(readmePath, 'utf-8')
  // Transform links for docs site context
  const transformedContent = transformLinks(content, 'library')
  return { content: transformedContent, exists: true }
}

/**
 * Extract ARCHITECTURE.md content from a library if it exists
 *
 * @param lib - The library configuration
 * @returns An object with the content and whether it exists
 */
function extractArchitecture(lib: LibraryConfig): { content: string; exists: boolean } {
  const archPath = join(WORKSPACE_ROOT, lib.srcPath, 'ARCHITECTURE.md')

  if (!existsSync(archPath)) {
    return { content: '', exists: false }
  }

  const content = readFileSync(archPath, 'utf-8')
  // Transform links for docs site context
  const transformedContent = transformLinks(content, 'library')
  return { content: transformedContent, exists: true }
}

/**
 * Run TypeDoc to generate API documentation JSON for a library.
 *
 * Entry points are automatically discovered from the library's package.json
 * exports field, ensuring documentation always matches the published API.
 *
 * @param lib - The library configuration
 * @returns True if TypeDoc succeeded, false otherwise
 */
function generateTypeDoc(lib: LibraryConfig): boolean {
  const libPath = join(WORKSPACE_ROOT, lib.srcPath)

  // Dynamically discover entry points from package.json
  const discoveredEntryPoints = discoverEntryPointsFromPackageJson(libPath)

  if (discoveredEntryPoints.length === 0) {
    log(`  ⚠ No entry points found for ${lib.name}`)
    return false
  }

  const entryPoints = discoveredEntryPoints.map((ep) => join(libPath, ep))

  // Verify all entry points exist
  const missingEntryPoints = entryPoints.filter((ep) => !existsSync(ep))
  if (missingEntryPoints.length > 0) {
    log(`  ⚠ Missing entry points for ${lib.name}:`)
    missingEntryPoints.forEach((ep) => log(`      - ${ep}`))
    return false
  }

  const outputPath = join(API_OUTPUT, lib.slug, 'api.json')
  ensureDir(dirname(outputPath))

  // Find tsconfig.json for the library
  const tsconfigPath = join(libPath, 'tsconfig.json')
  const hasTsconfig = existsSync(tsconfigPath)

  try {
    const args = ['typedoc', '--json', outputPath, '--excludePrivate', '--excludeInternal', '--excludeNotDocumented', 'false']

    // Add tsconfig if it exists
    if (hasTsconfig) {
      args.push('--tsconfig', tsconfigPath)
    }

    args.push(...entryPoints)

    log(`  → Running TypeDoc for ${lib.name} (${discoveredEntryPoints.length} entry points)`)
    execFileSync('npx', args, { cwd: WORKSPACE_ROOT, stdio: 'pipe' })
    return true
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`  ⚠ TypeDoc failed for ${lib.name}: ${errorMsg.slice(0, 200)}`)
    return false
  }
}

interface LibraryDoc {
  name: string
  packageName: string
  slug: string
  category: string
  readme: string | null
  architecture: string | null
  hasApi: boolean
}

/**
 * Main documentation generation function that processes all libraries
 */
function generateDocs() {
  log('📚 Generating documentation...\n')

  // Ensure output directories exist
  ensureDir(OUTPUT_DIR)
  ensureDir(DOCS_OUTPUT)
  ensureDir(API_OUTPUT)

  const libraryDocs: LibraryDoc[] = []

  for (const lib of LIBRARIES) {
    log(`📦 Processing ${lib.name}...`)

    // Extract README
    const readme = extractReadme(lib)

    // Extract Architecture doc (if exists)
    const architecture = extractArchitecture(lib)

    // Generate TypeDoc API
    const hasApi = generateTypeDoc(lib)

    // Save README content
    if (readme.exists) {
      const readmeOutput = join(DOCS_OUTPUT, lib.slug, 'readme.md')
      ensureDir(dirname(readmeOutput))
      writeFileSync(readmeOutput, readme.content)
    }

    // Save Architecture content
    if (architecture.exists) {
      const archOutput = join(DOCS_OUTPUT, lib.slug, 'architecture.md')
      ensureDir(dirname(archOutput))
      writeFileSync(archOutput, architecture.content)
    }

    libraryDocs.push({
      name: lib.name,
      packageName: lib.packageName,
      slug: lib.slug,
      category: lib.category,
      readme: readme.exists ? `${lib.slug}/readme.md` : null,
      architecture: architecture.exists ? `${lib.slug}/architecture.md` : null,
      hasApi,
    })

    log('')
  }

  // Extract root architecture document
  log('📐 Processing root ARCHITECTURE.md...')
  const rootArchPath = join(WORKSPACE_ROOT, 'ARCHITECTURE.md')
  if (existsSync(rootArchPath)) {
    const archContent = readFileSync(rootArchPath, 'utf-8')
    const transformedArchContent = transformLinks(archContent, 'root')
    writeFileSync(join(DOCS_OUTPUT, 'architecture.md'), transformedArchContent)
    log('  ✓ Root architecture document extracted\n')
  }

  // Extract CONTRIBUTING.md
  log('📝 Processing CONTRIBUTING.md...')
  const contributingPath = join(WORKSPACE_ROOT, 'CONTRIBUTING.md')
  if (existsSync(contributingPath)) {
    const contributingContent = readFileSync(contributingPath, 'utf-8')
    const transformedContributingContent = transformLinks(contributingContent, 'root')
    writeFileSync(join(DOCS_OUTPUT, 'contributing.md'), transformedContributingContent)
    log('  ✓ Contributing guide extracted\n')
  }

  // Write manifest
  const manifest = {
    generatedAt: createDate().toISOString(),
    libraries: libraryDocs,
    rootDocs: {
      architecture: existsSync(join(DOCS_OUTPUT, 'architecture.md')),
      contributing: existsSync(join(DOCS_OUTPUT, 'contributing.md')),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), stringify(manifest, null, 2))

  log('✅ Documentation generation complete!')
  log(`   Output: ${OUTPUT_DIR}`)
}

// Run if executed directly
if (require.main === module) {
  generateDocs()
}

export { generateDocs, LIBRARIES }
