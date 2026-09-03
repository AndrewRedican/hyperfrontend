#!/usr/bin/env node
import type { AnchorSplitResult, MarkdownLinkResult, TransformLinkResult, ContentExtractionResult } from './generate-docs.types'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { logger } from '@hyperfrontend/logging'
import { generateGuides } from './generate-guides'
import { generateMachineReadableDocs } from './generate-machine-readable'
import { generateSearchIndex } from './generate-search-index'
import { REPO_BLOB_BASE } from './repo'

logger.setLogLevel('log')

/**
 * Checks if a line contains a URL pointing to the docs site (www.hyperfrontend.dev).
 * Uses proper URL parsing to validate the host instead of substring matching.
 *
 * @param line - Text line to check for docs URLs
 * @returns True if the line contains a valid docs site URL
 */
function containsDocsUrl(line: string): boolean {
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
const DOCS_SITE_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(__dirname, '../.generated')
const DOCS_OUTPUT = join(OUTPUT_DIR, 'docs')
const API_OUTPUT = join(OUTPUT_DIR, 'api')
const TYPEDOC_BIN = join(DOCS_SITE_ROOT, 'node_modules', '.bin', 'typedoc')

/** Configuration for a library to document */
interface LibraryConfig {
  /** Display name */
  name: string
  /** npm package name */
  packageName: string
  /** URL slug */
  slug: string
  /** Source path relative to workspace root */
  srcPath: string
  /** Library category */
  category: 'core' | 'supporting' | 'utils' | 'plugin'
}

/** Package.json structure for entry point discovery */
interface PackageJson {
  /** Package name */
  name?: string
  /** Main entry point */
  main?: string
  /** Export map */
  exports?: Record<string, string | Record<string, string>>
  /** Keywords for npm */
  keywords?: string[]
  /** Package description */
  description?: string
  /** Released version */
  version?: string
  /** Whether the package is withheld from the registry */
  private?: boolean
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
    logger.log(`  ⚠ No package.json found at ${libPath}`)
    return []
  }

  const packageJson: PackageJson = parse(readFileSync(packageJsonPath, 'utf-8'))
  const entryPoints: string[] = []

  if (packageJson.exports && typeof packageJson.exports === 'object') {
    for (const [, exportValue] of entries(packageJson.exports)) {
      if (typeof exportValue === 'string') {
        const tsPath = convertJsPathToTs(exportValue)
        if (tsPath) entryPoints.push(tsPath)
      } else if (typeof exportValue === 'object') {
        const importPath = exportValue.import || exportValue.default || exportValue.require
        if (typeof importPath === 'string') {
          const tsPath = convertJsPathToTs(importPath)
          if (tsPath) entryPoints.push(tsPath)
        }
      }
    }
  }

  if (entryPoints.length === 0 && packageJson.main) {
    const tsPath = convertJsPathToTs(packageJson.main)
    if (tsPath) entryPoints.push(tsPath)
  }

  if (entryPoints.length === 0) {
    const defaultEntry = 'src/index.ts'
    if (existsSync(join(libPath, defaultEntry))) {
      entryPoints.push(defaultEntry)
    }
  }

  return [...createSet(entryPoints)]
}

/**
 * Converts a JavaScript path from package.json to a TypeScript source
 *
 * @param jsPath - JavaScript path (e.g., "./src/browser/index.js")
 * @returns TypeScript path (e.g., "src/browser/index.ts") or null if invalid
 */
function convertJsPathToTs(jsPath: string): string | null {
  if (!jsPath) return null

  let normalized = jsPath.replace(/^\.\//, '')

  if (normalized.endsWith('.json')) {
    return null
  }

  if (normalized.endsWith('.js')) {
    normalized = normalized.slice(0, -3) + '.ts'
  } else if (!normalized.endsWith('.ts')) {
    normalized = join(normalized, 'index.ts')
  }

  return normalized
}

const LIBRARIES: LibraryConfig[] = [
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
  { name: 'Builder', packageName: '@hyperfrontend/builder', slug: 'builder', srcPath: 'libs/builder', category: 'core' },
  {
    name: 'State Machine',
    packageName: '@hyperfrontend/state-machine',
    slug: 'state-machine',
    srcPath: 'libs/state-machine',
    category: 'supporting',
  },
  { name: 'Logging', packageName: '@hyperfrontend/logging', slug: 'logging', srcPath: 'libs/logging', category: 'supporting' },
  { name: 'Web Worker', packageName: '@hyperfrontend/web-worker', slug: 'web-worker', srcPath: 'libs/web-worker', category: 'supporting' },
  { name: 'Versioning', packageName: '@hyperfrontend/versioning', slug: 'versioning', srcPath: 'libs/versioning', category: 'supporting' },
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
  { name: 'Features', packageName: '@hyperfrontend/features', slug: 'features', srcPath: 'libs/features', category: 'core' },
  { name: 'Questions', packageName: '@hyperfrontend/questions', slug: 'questions', srcPath: 'libs/questions', category: 'supporting' },
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

/** Workspace-relative directory holding the published articles, which render at `/articles/<slug>`. */
const ARTICLES_CONTENT_DIR = 'apps/docs-site/content/articles/'

/**
 * Library slug mappings for link transformation
 */
const LIBRARY_SLUGS: Record<string, string> = {
  nexus: 'nexus',
  'network-protocol': 'network-protocol',
  cryptography: 'cryptography',
  features: 'features',
  'project-scope': 'project-scope',
  builder: 'builder',
  'state-machine': 'state-machine',
  logging: 'logging',
  questions: 'questions',
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
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  while (normalized.startsWith('../')) {
    normalized = normalized.slice(3)
  }
  return normalized
}

/**
 * Split a link into its path and its trailing `#anchor`, if any.
 *
 * Mapping rules match on the path alone, so a link that carries an anchor
 * resolves to the same page as its anchorless twin and keeps the fragment.
 *
 * @param url - The original URL from the markdown link
 * @returns The path and the anchor (empty string when the link carries none)
 */
function splitAnchor(url: string): AnchorSplitResult {
  const anchorIndex = url.indexOf('#')
  if (anchorIndex === -1) return { path: url, anchor: '' }
  return { path: url.slice(0, anchorIndex), anchor: url.slice(anchorIndex) }
}

/**
 * Extract link text and URL from a markdown link segment.
 * Given a segment that starts after `[`, extracts the text and URL.
 *
 * @param segment - Text starting with link text, e.g., "click here](https://example.com) more text"
 * @returns Object with linkText, url, and remainder, or null if not a valid link
 */
function extractMarkdownLink(segment: string): MarkdownLinkResult | null {
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
 * @param librarySlug - URL slug of the library the content came from, when `sourceContext` is 'library'
 * @returns Object with transformed URL (or null to remove the link entirely)
 */
function transformLinkUrl(url: string, sourceContext: 'root' | 'library', librarySlug?: string): TransformLinkResult {
  const { path, anchor } = splitAnchor(url)
  const normalized = normalizeRelativePath(path)

  // why: A library's own README.md and ARCHITECTURE.md share their filenames with the workspace-root documents; without the slug they would resolve to the site's root pages instead of this library's.
  if (sourceContext === 'library' && librarySlug) {
    if (normalized === 'ARCHITECTURE.md') {
      return { url: `/docs/libraries/${librarySlug}/architecture${anchor}`, keepAsText: false }
    }
    if (normalized === 'README.md') {
      return { url: `/docs/libraries/${librarySlug}${anchor}`, keepAsText: false }
    }
  }

  const rootDocMappings: Record<string, string> = {
    'README.md': '/',
    'ARCHITECTURE.md': '/architecture',
    'CONTRIBUTING.md': '/docs/contributing',
    'MANIFESTO.md': '/docs/manifesto',
    'ACKNOWLEDGMENTS.md': '/docs/acknowledgments',
    'REGARDING_AI.md': '/docs/regarding-ai',
    'CODE_OF_CONDUCT.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/CODE_OF_CONDUCT.md',
    'LICENSE.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md',
    'SECURITY.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/SECURITY.md',
    'FUNDING.md': 'https://github.com/AndrewRedican/hyperfrontend/blob/main/FUNDING.md',
  }

  if (rootDocMappings[normalized]) {
    return { url: `${rootDocMappings[normalized]}${anchor}`, keepAsText: false }
  }

  if (normalized.startsWith('roadmap/') && normalized.endsWith('.md')) {
    return { url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/${normalized}`, keepAsText: false }
  }

  if (normalized.startsWith(ARTICLES_CONTENT_DIR) && normalized.endsWith('.md')) {
    const slug = normalized.slice(ARTICLES_CONTENT_DIR.length, -'.md'.length)
    return { url: `/articles/${slug}${anchor}`, keepAsText: false }
  }

  if (normalized.startsWith('.github/')) {
    const githubPath = normalized.slice(8)
    return { url: `https://github.com/AndrewRedican/hyperfrontend/tree/main/.github/${githubPath}`, keepAsText: false }
  }

  if (normalized.startsWith('libs/') && normalized.endsWith('/ARCHITECTURE.md')) {
    const parts = normalized.split('/')
    if (parts.length >= 3) {
      const libName = parts[1]
      const slug = LIBRARY_SLUGS[libName]
      if (slug) {
        return { url: `/docs/libraries/${slug}/architecture${anchor}`, keepAsText: false }
      }
    }
  }

  if (sourceContext === 'library') {
    if (normalized.startsWith('src/') || normalized === 'src') {
      return { url: null, keepAsText: true }
    }
  }

  return { url, keepAsText: false }
}

/**
 * Transform links in markdown content for the docs site context.
 *
 * Handles:
 * - A library's own README.md / ARCHITECTURE.md → that library's pages
 * - Root document links (README.md, LICENSE.md, etc.) → docs site pages
 * - Library architecture links (libs/X/ARCHITECTURE.md) → library architecture pages
 * - Internal src/ links → removes or transforms
 * - GitHub URLs → preserves as external links
 *
 * @param content - Markdown content to transform
 * @param sourceContext - Where this content came from ('root' | 'library')
 * @param librarySlug - URL slug of the library the content came from, when `sourceContext` is 'library'
 * @returns Transformed markdown content
 */
function transformLinks(content: string, sourceContext: 'root' | 'library', librarySlug?: string): string {
  const transformed = content
    .split('\n')
    .filter((line) => !(line.includes('👉 See') && containsDocsUrl(line)))
    .join('\n')

  const parts = transformed.split('[')
  const result: string[] = [parts[0]]

  for (let i = 1; i < parts.length; i++) {
    const segment = parts[i]
    const linkInfo = extractMarkdownLink(segment)

    if (linkInfo) {
      const { linkText, url, remainder } = linkInfo
      const transformation = transformLinkUrl(url, sourceContext, librarySlug)

      if (transformation.url === null && transformation.keepAsText) {
        result.push(linkText + remainder)
      } else if (transformation.url !== url) {
        result.push(`[${linkText}](${transformation.url})${remainder}`)
      } else {
        result.push(`[${segment}`)
      }
    } else {
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
function extractReadme(lib: LibraryConfig): ContentExtractionResult {
  const readmePath = join(WORKSPACE_ROOT, lib.srcPath, 'README.md')

  if (!existsSync(readmePath)) {
    logger.log(`  ⚠ No README.md found for ${lib.name}`)
    return { content: '', exists: false }
  }

  const content = readFileSync(readmePath, 'utf-8')
  const transformedContent = transformLinks(content, 'library', lib.slug)
  return { content: transformedContent, exists: true }
}

/**
 * Extract ARCHITECTURE.md content from a library if it exists
 *
 * @param lib - The library configuration
 * @returns An object with the content and whether it exists
 */
function extractArchitecture(lib: LibraryConfig): ContentExtractionResult {
  const archPath = join(WORKSPACE_ROOT, lib.srcPath, 'ARCHITECTURE.md')

  if (!existsSync(archPath)) {
    return { content: '', exists: false }
  }

  const content = readFileSync(archPath, 'utf-8')
  const transformedContent = transformLinks(content, 'library', lib.slug)
  return { content: transformedContent, exists: true }
}

/**
 * Removes the repository link from every source entry that points outside the
 * repository.
 *
 * A handful of reflections inherit members from TypeScript's own declaration
 * files, which resolve inside `node_modules` and so exist on disk but not in
 * version control. Their `sources[].fileName` is kept, since it still names
 * where the member comes from, while the link that would 404 is dropped. Both
 * API renderers omit the "View source" anchor when the link is absent.
 *
 * @param apiJsonPath - Path to the TypeDoc JSON bundle to rewrite in place
 */
function stripExternalSourceUrls(apiJsonPath: string): void {
  const bundle = parse(readFileSync(apiJsonPath, 'utf-8')) as unknown
  let stripped = 0

  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return

    if (isArray(node)) {
      node.forEach(visit)
      return
    }

    const record = node as Record<string, unknown>
    const fileName = record['fileName']

    if (typeof fileName === 'string' && fileName.includes('node_modules/') && 'url' in record) {
      delete record['url']
      stripped += 1
    }

    for (const value of values(record)) {
      visit(value)
    }
  }

  visit(bundle)

  if (stripped > 0) {
    writeFileSync(apiJsonPath, stringify(bundle, null, 2))
  }
}

/**
 * Run TypeDoc to generate API documentation JSON for a library.
 *
 * Entry points are automatically discovered from the library's package.json
 * exports field, ensuring documentation always matches the published API.
 *
 * Git detection is disabled so source links are identical in every build
 * environment: each `sources[].url` points at the file on the main branch of
 * the GitHub repository rather than the local commit.
 *
 * Both `--basePath` and `--displayBasePath` are passed. TypeDoc resolves the
 * source-link `{path}` against `displayBasePath` alone, falling back to the
 * common directory of the entry points rather than to `basePath`. Passing only
 * `basePath` roots every link at the library's own source directory, which
 * strips the `libs/<name>/src/` prefix and makes all of them 404.
 *
 * @param lib - The library configuration
 * @returns True if TypeDoc succeeded, false otherwise
 */
function generateTypeDoc(lib: LibraryConfig): boolean {
  const libPath = join(WORKSPACE_ROOT, lib.srcPath)

  const discoveredEntryPoints = discoverEntryPointsFromPackageJson(libPath)

  if (discoveredEntryPoints.length === 0) {
    logger.log(`  ⚠ No entry points found for ${lib.name}`)
    return false
  }

  const entryPoints = discoveredEntryPoints.map((ep) => join(libPath, ep))

  const missingEntryPoints = entryPoints.filter((ep) => !existsSync(ep))
  if (missingEntryPoints.length > 0) {
    logger.log(`  ⚠ Missing entry points for ${lib.name}:`)
    missingEntryPoints.forEach((ep) => logger.log(`      - ${ep}`))
    return false
  }

  const outputPath = join(API_OUTPUT, lib.slug, 'api.json')
  ensureDir(dirname(outputPath))

  const tsconfigPath = join(libPath, 'tsconfig.json')
  const hasTsconfig = existsSync(tsconfigPath)

  try {
    const args = [
      '--json',
      outputPath,
      '--excludePrivate',
      '--excludeInternal',
      '--excludeNotDocumented',
      'false',
      // why: The library page renders the README itself; letting TypeDoc embed a copy in api.json duplicates it into the page payload, authoring comments and all
      '--readme',
      'none',
      '--disableGit',
      '--basePath',
      WORKSPACE_ROOT,
      '--displayBasePath',
      WORKSPACE_ROOT,
      '--sourceLinkTemplate',
      `${REPO_BLOB_BASE}/{path}#L{line}`,
    ]

    if (hasTsconfig) {
      args.push('--tsconfig', tsconfigPath)
    }

    args.push(...entryPoints)

    logger.log(`  → Running TypeDoc for ${lib.name} (${discoveredEntryPoints.length} entry points)`)
    execFileSync(TYPEDOC_BIN, args, { cwd: WORKSPACE_ROOT, stdio: 'pipe' })
    stripExternalSourceUrls(outputPath)
    return true
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.log(`  ⚠ TypeDoc failed for ${lib.name}: ${errorMsg}`)
    return false
  }
}

/** Generated documentation for a library */
interface LibraryDoc {
  /** Display name */
  name: string
  /** npm package name */
  packageName: string
  /** URL slug */
  slug: string
  /** Library category */
  category: string
  /** README content, if present */
  readme: string | null
  /** Architecture doc content, if present */
  architecture: string | null
  /** Whether API docs were generated */
  hasApi: boolean
  /** Keywords from package.json */
  keywords: string[]
  /** Description from package.json */
  description: string
  /** Released version, empty when the package.json carries none */
  version: string
  /** Whether the package is withheld from the registry */
  isPrivate: boolean
}

/** Metadata extracted from a package.json */
interface PackageMetadata {
  /** Keywords from package.json */
  keywords: string[]
  /** Description from package.json */
  description: string
  /** Released version, empty when the package.json carries none */
  version: string
  /** Whether the package is withheld from the registry */
  isPrivate: boolean
}

/**
 * Load the published-facing fields of a library's package.json.
 *
 * @param lib - The library configuration
 * @returns Keywords, description, version, and registry visibility
 */
function extractPackageMetadata(lib: LibraryConfig): PackageMetadata {
  const packageJsonPath = join(WORKSPACE_ROOT, lib.srcPath, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return { keywords: [], description: '', version: '', isPrivate: false }
  }

  const packageJson: PackageJson = parse(readFileSync(packageJsonPath, 'utf-8'))
  return {
    keywords: packageJson.keywords ?? [],
    description: packageJson.description ?? '',
    version: packageJson.version ?? '',
    isPrivate: packageJson.private === true,
  }
}

/**
 * Main documentation generation function that processes all libraries
 */
function generateDocs() {
  logger.log('📚 Generating documentation...\n')

  ensureDir(OUTPUT_DIR)
  ensureDir(DOCS_OUTPUT)
  ensureDir(API_OUTPUT)

  const libraryDocs: LibraryDoc[] = []

  for (const lib of LIBRARIES) {
    logger.log(`📦 Processing ${lib.name}...`)

    const readme = extractReadme(lib)

    const architecture = extractArchitecture(lib)

    const hasApi = generateTypeDoc(lib)

    const { keywords, description, version, isPrivate } = extractPackageMetadata(lib)

    if (readme.exists) {
      const readmeOutput = join(DOCS_OUTPUT, lib.slug, 'readme.md')
      ensureDir(dirname(readmeOutput))
      writeFileSync(readmeOutput, readme.content)
    }

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
      keywords,
      description,
      version,
      isPrivate,
    })

    logger.log('')
  }

  logger.log('📐 Processing root ARCHITECTURE.md...')
  const rootArchPath = join(WORKSPACE_ROOT, 'ARCHITECTURE.md')
  if (existsSync(rootArchPath)) {
    const archContent = readFileSync(rootArchPath, 'utf-8')
    const transformedArchContent = transformLinks(archContent, 'root')
    writeFileSync(join(DOCS_OUTPUT, 'architecture.md'), transformedArchContent)
    logger.log('  ✓ Root architecture document extracted\n')
  }

  logger.log('📝 Processing CONTRIBUTING.md...')
  const contributingPath = join(WORKSPACE_ROOT, 'CONTRIBUTING.md')
  if (existsSync(contributingPath)) {
    const contributingContent = readFileSync(contributingPath, 'utf-8')
    const transformedContributingContent = transformLinks(contributingContent, 'root')
    writeFileSync(join(DOCS_OUTPUT, 'contributing.md'), transformedContributingContent)
    logger.log('  ✓ Contributing guide extracted\n')
  }

  generateGuides(LIBRARIES)

  const manifest = {
    generatedAt: createDate().toISOString(),
    libraries: libraryDocs,
    rootDocs: {
      architecture: existsSync(join(DOCS_OUTPUT, 'architecture.md')),
      contributing: existsSync(join(DOCS_OUTPUT, 'contributing.md')),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), stringify(manifest, null, 2))

  // why: the markdown counterparts read the manifest, the guide corpus, and the extracted root documents, so they are published only once all three exist
  generateMachineReadableDocs()

  generateSearchIndex()

  logger.log('✅ Documentation generation complete!')
  logger.log(`   Output: ${OUTPUT_DIR}`)
}

if (require.main === module) {
  // why: --guides-only gives guide authors a seconds-fast loop by skipping TypeDoc and README extraction
  if (process.argv.includes('--guides-only')) {
    generateGuides(LIBRARIES)
  } else {
    generateDocs()
  }
}

export { generateDocs, LIBRARIES }
