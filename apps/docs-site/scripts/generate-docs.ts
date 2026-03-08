#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

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
 * @param librarySlug - Optional library slug if from a library
 * @returns Transformed markdown content
 */
function transformLinks(content: string, sourceContext: 'root' | 'library', librarySlug?: string): string {
  let transformed = content

  // Transform root document links to docs site pages
  const rootDocMappings: Record<string, string> = {
    'README.md': '/',
    'ARCHITECTURE.md': '/docs/architecture',
    'CONTRIBUTING.md': '/docs/contributing',
    'MANIFESTO.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/MANIFESTO.md',
    'LICENSE.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md',
    'SECURITY.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/SECURITY.md',
    'FUNDING.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/FUNDING.md',
  }

  for (const [file, url] of entries(rootDocMappings)) {
    // Match [text](README.md) or [text](./README.md)
    // eslint-disable-next-line workspace/no-unsafe-regex -- file names are from hardcoded mapping
    const pattern = createRegExp(`\\]\\(\\.?\\/?${file.replace('.', '\\.')}\\)`, 'g')
    transformed = transformed.replace(pattern, `](${url})`)
  }

  // Transform roadmap links
  transformed = transformed.replace(/\]\(\.?\/?(roadmap\/[^)]+\.md)\)/g, '](https://github.com/AndrewRedican/hyperfrontend/blob/main/$1)')

  // Transform .github links
  transformed = transformed.replace(
    /\]\(\.?\/?\.github\/([^)]+)\)/g,
    '](https://github.com/AndrewRedican/hyperfrontend/tree/main/.github/$1)'
  )

  // Transform libs/X/ARCHITECTURE.md links to library pages
  for (const [libName, slug] of entries(LIBRARY_SLUGS)) {
    // eslint-disable-next-line workspace/no-unsafe-regex -- library names are from hardcoded mapping
    const archPattern = createRegExp(`\\]\\(libs/${libName}/ARCHITECTURE\\.md(#[^)]*)?\\)`, 'g')
    transformed = transformed.replace(archPattern, `](/docs/libraries/${slug}$1)`)
  }

  // For library context, transform internal src/ links
  if (sourceContext === 'library' && librarySlug) {
    // Remove or comment out links to internal src/ files that don't get copied
    // These are internal documentation links that only make sense in the repo
    transformed = transformed.replace(
      /\[([^\]]+)\]\(src\/[^)]+\)/g,
      '$1' // Just keep the link text, remove the link
    )
  }

  return transformed
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
  const transformedContent = transformLinks(content, 'library', lib.slug)
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
  const transformedContent = transformLinks(content, 'library', lib.slug)
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
