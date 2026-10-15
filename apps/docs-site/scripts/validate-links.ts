#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join, dirname, relative, sep, posix } from 'node:path'
import { glob } from 'glob'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { LIBRARIES } from '../src/lib/content'
import { REPO_URL } from './repo'

logger.setLogLevel('log')

const WORKSPACE_ROOT = resolve(__dirname, '../../..')
const DOCS_SITE_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = join(DOCS_SITE_ROOT, '.generated')
const SRC_DIR = join(DOCS_SITE_ROOT, 'src')
const GENERATED_API_DIR = join(GENERATED_DIR, 'api')

// ref: portable-path mirror of workspaceRelativePath from @hyperfrontend/project-scope/core/path; the docs site installs only published packages, so this script keeps its own copy

/**
 * Converts an absolute path into its workspace-relative portable form.
 *
 * @param file - Absolute path inside the workspace.
 * @returns The path from the workspace root with forward slashes.
 */
function workspaceRelativePath(file: string): string {
  return relative(WORKSPACE_ROOT, file).split(sep).join(posix.sep)
}

/**
 * Extracts the workspace-relative path a repository URL points at.
 *
 * Matched by prefix rather than by pattern so the repository coordinates stay
 * derived from the workspace manifest. Any branch name is accepted, and the
 * line-number fragment is dropped so the result names a file on disk.
 *
 * @param link - The URL to inspect
 * @param kind - `blob` for a file link, `tree` for a directory link
 * @returns The workspace-relative path, or undefined if the URL is not one of ours
 */
function repoUrlPath(link: string, kind: 'blob' | 'tree'): string | undefined {
  const prefix = `${REPO_URL}/${kind}/`

  if (!link.startsWith(prefix)) {
    return undefined
  }

  const segments = link.slice(prefix.length).split('/')

  if (segments.length < 2) {
    return undefined
  }

  return segments.slice(1).join('/').split('#')[0]
}

/**
 * Result of validating a single link.
 */
interface LinkValidationResult {
  /** Source file containing the link */
  file: string
  /** Line number where link appears */
  line: number
  /** The link URL */
  link: string
  /** Validation status */
  status: 'valid' | 'broken' | 'external' | 'transformed'
  /** Optional message explaining the status */
  message?: string
  /** Target URL after transformation (if applicable) */
  transformedTo?: string
}

/**
 * Summary of link validation across all files.
 */
interface ValidationSummary {
  /** Total number of links checked */
  totalLinks: number
  /** Number of valid links */
  validLinks: number
  /** Number of broken links */
  brokenLinks: number
  /** Number of external links (skipped) */
  externalLinks: number
  /** Number of transformed links */
  transformedLinks: number
  /** List of validation errors */
  errors: LinkValidationResult[]
}

/**
 * Extracted link information from markdown content.
 */
interface ExtractedLink {
  /** The link URL */
  link: string
  /** Line number where link appears */
  line: number
  /** Link text (display text) */
  text: string
}

/**
 * Extract all links from markdown content
 *
 * @param content - The markdown content to parse
 * @returns Array of link objects with link URL, line number, and link text
 */
function extractLinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = []
  const lines = content.split(/\r?\n/)

  // why: a destination may be wrapped in angle brackets so it can carry parentheses of its own, and the brackets are not part of the URL
  const markdownLinkPattern = /\[([^\]]*)\]\((<[^>]*>|[^)]+)\)/g

  const htmlLinkPattern = /href=["']([^"']+)["']/g

  lines.forEach((line, index) => {
    let match

    while ((match = markdownLinkPattern.exec(line)) !== null) {
      const destination = match[2]
      links.push({
        text: match[1],
        link: destination.startsWith('<') ? destination.slice(1, -1) : destination,
        line: index + 1,
      })
    }

    while ((match = htmlLinkPattern.exec(line)) !== null) {
      links.push({
        text: '',
        link: match[1],
        line: index + 1,
      })
    }
  })

  return links
}

/**
 * Check if a link is external
 *
 * @param link - The link URL to check
 * @returns True if the link is external (http/https/mailto)
 */
function isExternalLink(link: string): boolean {
  return link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')
}

/**
 * Check if a link is an anchor link
 *
 * @param link - The link URL to check
 * @returns True if the link starts with #
 */
function isAnchorLink(link: string): boolean {
  return link.startsWith('#')
}

/**
 * Result of transforming a GitHub URL.
 */
interface TransformResult {
  /** Whether the URL was transformed */
  transformed: boolean
  /** Original URL */
  url: string
  /** Docs site path (if transformed) */
  docsSitePath?: string
}

/**
 * Transform GitHub blob/tree URLs to docs site paths
 *
 * @param link - The GitHub URL to transform
 * @returns Object with transformed flag, original URL, and optional docs site path
 */
function transformGitHubUrl(link: string): TransformResult {
  const repoTarget = repoUrlPath(link, 'blob') ?? repoUrlPath(link, 'tree')

  if (repoTarget !== undefined && repoTarget.startsWith('libs/')) {
    const libPath = repoTarget.replace(/^libs\//, '').split('/')[0]
    return {
      transformed: true,
      url: link,
      docsSitePath: `/docs/libraries/${libPath}`,
    }
  }

  return { transformed: false, url: link }
}

/**
 * Resolve a relative link to an absolute path
 *
 * @param link - The link URL to resolve
 * @param basePath - The base path of the file containing the link
 * @returns The absolute path of the resolved link
 */
function resolveRelativePath(link: string, basePath: string): string {
  const linkWithoutAnchor = link.split('#')[0]

  if (linkWithoutAnchor.startsWith('/')) {
    return join(SRC_DIR, 'app', linkWithoutAnchor)
  }

  const dir = dirname(basePath)
  return resolve(dir, linkWithoutAnchor)
}

/**
 * Check whether a site-absolute link resolves to a static asset in public/.
 *
 * Root-relative links normally resolve against src/app routes, but images and
 * other assets referenced from markdown (e.g. article hero images) are served
 * from the public directory instead.
 *
 * @param link - The original link URL
 * @returns True if the link maps to an existing file under public/
 */
function publicAssetExists(link: string): boolean {
  if (!link.startsWith('/')) {
    return false
  }
  const pathname = link.split('#')[0]
  if (pathname.startsWith('/media/')) {
    return existsSync(join(WORKSPACE_ROOT, 'assets', pathname.replace(/^\//, '')))
  }
  return existsSync(join(DOCS_SITE_ROOT, 'public', pathname))
}

/**
 * Strip the site's own origin from a link, leaving a site-absolute path.
 *
 * READMEs are copied byte-identical to npm, so an asset they show has to be
 * named by absolute URL. Those URLs are still ours, and checking them against
 * the filesystem rather than fetching them means a newly committed asset
 * validates before it has been deployed.
 *
 * @param link - The link URL to check
 * @returns The site-absolute path, or an empty string when the link is not ours
 */
function toSitePath(link: string): string {
  for (const origin of ['https://www.hyperfrontend.dev', 'https://hyperfrontend.dev']) {
    if (link.startsWith(`${origin}/`)) {
      return link.slice(origin.length)
    }
  }
  return ''
}

/**
 * Check whether a route path is served by a sibling dynamic segment.
 *
 * Next.js resolves `/articles/some-slug` through an `articles/[slug]/page.tsx`
 * route, so a literal directory for the slug never exists on disk.
 *
 * @param targetPath - The absolute path the route resolved to
 * @returns True if a bracketed sibling route can serve this path
 */
function hasDynamicRoute(targetPath: string): boolean {
  const parent = dirname(targetPath)
  if (!existsSync(parent)) {
    return false
  }

  return readdirSync(parent).some((entry) => entry.startsWith('[') && existsSync(join(parent, entry, 'page.tsx')))
}

/**
 * Check if a path exists (files or directories)
 *
 * @param targetPath - The path to check for existence
 * @returns True if the path exists as a file or directory
 */
function pathExists(targetPath: string): boolean {
  if (existsSync(targetPath)) {
    return true
  }

  const extensions = ['.md', '.mdx', '.tsx', '/page.tsx', '/index.tsx']
  for (const ext of extensions) {
    if (existsSync(targetPath + ext)) {
      return true
    }
  }

  const pageFile = join(targetPath, 'page.tsx')
  if (existsSync(pageFile)) {
    return true
  }

  return hasDynamicRoute(targetPath)
}

/** The reflection kinds TypeDoc writes that the anchor check tells apart. */
const MODULE_KIND = 2
const CLASS_KIND = 128
const INTERFACE_KIND = 256
const CONSTRUCTOR_KIND = 512
const PROPERTY_KIND = 1024
const METHOD_KIND = 2048
const ACCESSOR_KIND = 262144
const REFERENCE_KIND = 4194304

/** The prefix every symbol anchor on a reference page carries. */
const API_ANCHOR_PREFIX = 'api-'

/** The anchor of the reference section itself, present on every page that renders one. */
const API_REFERENCE_ANCHOR = 'api-reference'

/** The route every library page sits under. */
const LIBRARY_ROUTE_PREFIX = '/docs/libraries/'

/** The slugs utils libraries publish under, mapped to their generated bundle directories. */
const UTILS_BUNDLES: Record<string, string> = {
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
 * The anchors one module's reference renders.
 */
interface ModuleAnchors {
  /** Every exported symbol, each anchored as `api-<name>` */
  symbols: Set<string>
  /** Every property and method anchored individually, as the full anchor id */
  members: Set<string>
}

/**
 * A TypeDoc reflection, read only as far as the anchor check needs.
 */
interface Reflection {
  /** Reflection id, unique within the bundle */
  id?: number
  /** Reflection kind */
  kind?: number
  /** Symbol name */
  name?: string
  /** Child reflections */
  children?: Reflection[]
  /** For a re-export, the id of the declaration it stands for */
  target?: number
}

/** Each library's bundle, read once, keyed by module name; null when the bundle was not generated. */
const bundleAnchors = createMap<string, Map<string, ModuleAnchors> | null>()

/**
 * Collect the anchors a module's reference page renders.
 *
 * Mirrors the site's reference components: every export gets `api-<name>`,
 * and an interface or class also anchors each property and accessor as
 * `api-<Parent>-prop-<member>`, each method as `api-<Parent>-method-<member>`
 * and, for a class, its constructor as `api-<Parent>-constructor`. A type
 * alias renders its members inline with no anchor of their own, so a link to
 * one of those lands on the alias.
 *
 * A module re-exporting a symbol declared elsewhere lists a reference to it,
 * and the page renders the declaration the reference points at, so the
 * anchors come from the declaration while the name stays the export's.
 *
 * @param exports - The module's child reflections
 * @param lookup - Every reflection in the bundle, by id
 * @returns The anchors the page carries
 */
function collectModuleAnchors(exports: Reflection[], lookup: Map<number, Reflection>): ModuleAnchors {
  const symbols = createSet<string>()
  const members = createSet<string>()

  for (const exported of exports) {
    if (typeof exported.name !== 'string') continue
    symbols.add(exported.name)
    const node = exported.kind === REFERENCE_KIND && exported.target !== undefined ? (lookup.get(exported.target) ?? exported) : exported
    if (node.kind !== INTERFACE_KIND && node.kind !== CLASS_KIND) continue
    for (const child of node.children ?? []) {
      if (typeof child.name !== 'string') continue
      if (child.kind === PROPERTY_KIND || child.kind === ACCESSOR_KIND) members.add(`${API_ANCHOR_PREFIX}${node.name}-prop-${child.name}`)
      if (child.kind === METHOD_KIND) members.add(`${API_ANCHOR_PREFIX}${node.name}-method-${child.name}`)
      if (child.kind === CONSTRUCTOR_KIND) members.add(`${API_ANCHOR_PREFIX}${node.name}-constructor`)
    }
  }

  return { symbols, members }
}

/**
 * Read a library's generated bundle into the anchors each of its modules renders.
 *
 * A library with several entry points is a project of modules named by import
 * path; one with a single entry point is a project whose children are the
 * symbols themselves, and reads as one module named after the package.
 *
 * @param bundleSlug - The bundle's directory under the generated API directory
 * @param packageName - The package the bundle documents
 * @returns The anchors by module name, or null when the bundle was not generated
 */
function readBundleAnchors(bundleSlug: string, packageName: string): Map<string, ModuleAnchors> | null {
  const cached = bundleAnchors.get(bundleSlug)
  if (cached !== undefined) return cached

  const bundlePath = join(GENERATED_API_DIR, bundleSlug, 'api.json')
  if (!existsSync(bundlePath)) {
    bundleAnchors.set(bundleSlug, null)
    return null
  }

  const project = parse(readFileSync(bundlePath, 'utf-8')) as Reflection
  const modules = createMap<string, ModuleAnchors>()
  const children = project.children ?? []
  const lookup = createMap<number, Reflection>()

  const index = (node: Reflection): void => {
    if (typeof node.id === 'number') lookup.set(node.id, node)
    for (const child of node.children ?? []) index(child)
  }
  children.forEach(index)

  if (children.some((child) => child.kind === MODULE_KIND)) {
    for (const module of children) {
      if (module.kind === MODULE_KIND && typeof module.name === 'string')
        modules.set(module.name, collectModuleAnchors(module.children ?? [], lookup))
    }
  } else {
    modules.set(packageName, collectModuleAnchors(children, lookup))
  }

  bundleAnchors.set(bundleSlug, modules)
  return modules
}

/**
 * Check that an `api-` anchor on a library page names something the page renders.
 *
 * The markdown sweep used to accept any fragment, so a link could name a
 * symbol that was renamed, or reach the right page and the wrong entry, and
 * still pass. A landing page renders every entry's reference, so it anchors
 * any entry's exports; an entry page anchors only its own.
 *
 * @param sitePath - The site-absolute link, fragment included
 * @returns The problem, or null when the anchor resolves or is not an API anchor
 */
function apiAnchorProblem(sitePath: string): string | null {
  const [pathname, fragment] = sitePath.split('#')
  if (fragment === undefined || !fragment.startsWith(API_ANCHOR_PREFIX) || fragment === API_REFERENCE_ANCHOR) return null
  if (!pathname.startsWith(LIBRARY_ROUTE_PREFIX)) return null

  const route = pathname.slice(LIBRARY_ROUTE_PREFIX.length).replace(/\/$/, '')
  const library = LIBRARIES.filter((candidate) => route === candidate.slug || route.startsWith(`${candidate.slug}/`)).sort(
    (a, b) => b.slug.length - a.slug.length
  )[0]
  if (library === undefined) return `No library is documented at ${pathname}`

  const subpath = route.slice(library.slug.length).replace(/^\//, '')
  const bundleSlug = library.slug.startsWith('utils/') ? (UTILS_BUNDLES[library.slug.slice('utils/'.length)] ?? library.slug) : library.slug
  const modules = readBundleAnchors(bundleSlug, library.packageName)
  // why: a bundle is generated by `npm run generate`; without one there is nothing to check against, which the source-link sweep already treats as "nothing to report"
  if (modules === null) return null

  const scope = subpath === '' ? [...modules.values()] : [modules.get(`${library.packageName}/${subpath}`)]
  const page = scope.filter((anchors): anchors is ModuleAnchors => anchors !== undefined)
  if (page.length === 0) return `No API reference is rendered at ${pathname}`

  const symbol = fragment.slice(API_ANCHOR_PREFIX.length)
  if (page.some((anchors) => anchors.symbols.has(symbol) || anchors.members.has(fragment))) return null

  return `API anchor #${fragment} is not rendered at ${pathname}`
}

/**
 * Validate a single link
 *
 * @param link - The link URL to validate
 * @param filePath - The path of the file containing the link
 * @param line - The line number where the link appears
 * @returns Validation result with status and optional message
 */
function validateLink(link: string, filePath: string, line: number): LinkValidationResult {
  if (isAnchorLink(link)) {
    return {
      file: filePath,
      line,
      link,
      status: 'valid',
      message: 'Anchor link',
    }
  }

  if (isExternalLink(link)) {
    const sitePath = toSitePath(link)
    if (sitePath !== '') {
      if (publicAssetExists(sitePath) || pathExists(resolveRelativePath(sitePath, filePath))) {
        const anchorProblem = apiAnchorProblem(sitePath)
        return {
          file: filePath,
          line,
          link,
          status: anchorProblem === null ? 'valid' : 'broken',
          ...(anchorProblem === null ? {} : { message: anchorProblem }),
        }
      }
      return {
        file: filePath,
        line,
        link,
        status: 'broken',
        message: `Target not found on this site: ${sitePath}`,
      }
    }

    const githubTransform = transformGitHubUrl(link)
    if (githubTransform.transformed) {
      return {
        file: filePath,
        line,
        link,
        status: 'transformed',
        message: `GitHub URL can be transformed to docs site path`,
        transformedTo: githubTransform.docsSitePath,
      }
    }

    return {
      file: filePath,
      line,
      link,
      status: 'external',
      message: 'External link (not validated)',
    }
  }

  const resolvedPath = resolveRelativePath(link, filePath)

  if (pathExists(resolvedPath) || publicAssetExists(link)) {
    const anchorProblem = link.startsWith('/') ? apiAnchorProblem(link) : null
    return {
      file: filePath,
      line,
      link,
      status: anchorProblem === null ? 'valid' : 'broken',
      ...(anchorProblem === null ? {} : { message: anchorProblem }),
    }
  }

  return {
    file: filePath,
    line,
    link,
    status: 'broken',
    message: `Target not found: ${resolvedPath}`,
  }
}

/**
 * Validate all links in a markdown file
 *
 * @param filePath - The path to the markdown file to validate
 * @returns Array of validation results for each link in the file
 */
function validateFile(filePath: string): LinkValidationResult[] {
  const content = readFileSync(filePath, 'utf-8')
  const links = extractLinks(content)

  return links.map(({ link, line }) => validateLink(link, filePath, line))
}

/**
 * Validate the source links TypeDoc stamps into every generated API bundle.
 *
 * These are the "View source" targets on library API pages. They are not
 * reachable from any markdown file, so the markdown sweep never sees them, and
 * a generator change that reroots them lands silently. Every distinct link is
 * resolved against the workspace once.
 *
 * @returns Array of validation results, one per distinct broken or valid link
 */
function validateApiSources(): LinkValidationResult[] {
  if (!existsSync(GENERATED_API_DIR)) {
    return []
  }

  const results: LinkValidationResult[] = []

  for (const slug of readdirSync(GENERATED_API_DIR)) {
    const bundlePath = join(GENERATED_API_DIR, slug, 'api.json')

    if (!existsSync(bundlePath)) {
      continue
    }

    const bundle = parse(readFileSync(bundlePath, 'utf-8')) as unknown
    const seen = createSet<string>()

    const visit = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return

      if (isArray(node)) {
        node.forEach(visit)
        return
      }

      const record = node as Record<string, unknown>
      const url = record['url']

      if (typeof url === 'string' && typeof record['fileName'] === 'string' && !seen.has(url)) {
        seen.add(url)
        const targetPath = repoUrlPath(url, 'blob')

        if (targetPath !== undefined && !existsSync(join(WORKSPACE_ROOT, targetPath))) {
          results.push({
            file: workspaceRelativePath(bundlePath),
            line: typeof record['line'] === 'number' ? record['line'] : 0,
            link: url,
            status: 'broken',
            message: `Source link target not found: ${targetPath}`,
          })
        }
      }

      for (const value of values(record)) {
        visit(value)
      }
    }

    visit(bundle)
  }

  return results
}

/**
 * Main validation function
 *
 * @returns Promise resolving to validation summary with counts and errors
 */
async function validateLinks(): Promise<ValidationSummary> {
  logger.log('🔗 Validating documentation links...\n')

  const summary: ValidationSummary = {
    totalLinks: 0,
    validLinks: 0,
    brokenLinks: 0,
    externalLinks: 0,
    transformedLinks: 0,
    errors: [],
  }

  const generatedMdFiles = await glob('**/*.md', { cwd: GENERATED_DIR, absolute: true })

  const rootMdFiles = await glob('*.md', { cwd: WORKSPACE_ROOT, absolute: true })

  const libMdFiles = await glob('libs/**/*.md', { cwd: WORKSPACE_ROOT, absolute: true })

  const contentMdFiles = await glob('content/**/*.md', { cwd: DOCS_SITE_ROOT, absolute: true })

  const demoMdFiles = await glob('apps/demos/*/README.md', { cwd: WORKSPACE_ROOT, absolute: true })

  const allFiles = [...generatedMdFiles, ...rootMdFiles, ...libMdFiles, ...contentMdFiles, ...demoMdFiles]

  logger.log(`📄 Found ${allFiles.length} markdown files to validate\n`)

  for (const file of allFiles) {
    const results = validateFile(file)
    const relativePath = workspaceRelativePath(file)

    for (const result of results) {
      summary.totalLinks++

      switch (result.status) {
        case 'valid':
          summary.validLinks++
          break
        case 'broken':
          summary.brokenLinks++
          summary.errors.push({ ...result, file: relativePath })
          break
        case 'external':
          summary.externalLinks++
          break
        case 'transformed':
          summary.transformedLinks++
          break
      }
    }
  }

  const apiSourceResults = validateApiSources()

  logger.log(`🔗 Checked API source links across ${readdirSync(GENERATED_API_DIR).length} generated bundles\n`)

  for (const result of apiSourceResults) {
    summary.totalLinks++
    summary.brokenLinks++
    summary.errors.push(result)
  }

  logger.log('📊 Validation Summary')
  logger.log('─'.repeat(40))
  logger.log(`Total links:       ${summary.totalLinks}`)
  logger.log(`✓ Valid:           ${summary.validLinks}`)
  logger.log(`↗ External:        ${summary.externalLinks}`)
  logger.log(`⟳ Transformable:   ${summary.transformedLinks}`)
  logger.log(`✗ Broken:          ${summary.brokenLinks}`)
  logger.log('')

  if (summary.brokenLinks > 0) {
    logger.log('❌ Broken Links:')
    logger.log('─'.repeat(40))
    for (const err of summary.errors) {
      logger.log(`  ${err.file}:${err.line}`)
      logger.log(`    Link: ${err.link}`)
      logger.log(`    ${err.message}\n`)
    }
  }

  if (summary.brokenLinks === 0) {
    logger.log('✅ All internal links are valid!')
  }

  return summary
}

if (require.main === module) {
  validateLinks()
    .then((summary) => {
      if (summary.brokenLinks > 0) {
        process.exit(1)
      }
    })
    .catch((err) => {
      logger.error('Link validation failed:', err)
      process.exit(1)
    })
}

export { validateLinks, extractLinks, transformGitHubUrl }
