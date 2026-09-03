#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join, dirname, relative } from 'node:path'
import { glob } from 'glob'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { REPO_URL } from './repo'

logger.setLogLevel('log')

const WORKSPACE_ROOT = resolve(__dirname, '../../..')
const DOCS_SITE_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = join(DOCS_SITE_ROOT, '.generated')
const SRC_DIR = join(DOCS_SITE_ROOT, 'src')
const GENERATED_API_DIR = join(GENERATED_DIR, 'api')

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
function repoRelativePath(link: string, kind: 'blob' | 'tree'): string | undefined {
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
  const lines = content.split('\n')

  const markdownLinkPattern = /\[([^\]]*)\]\(([^)]+)\)/g

  const htmlLinkPattern = /href=["']([^"']+)["']/g

  lines.forEach((line, index) => {
    let match

    while ((match = markdownLinkPattern.exec(line)) !== null) {
      links.push({
        text: match[1],
        link: match[2],
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
  const targetPath = repoRelativePath(link, 'blob') ?? repoRelativePath(link, 'tree')

  if (targetPath !== undefined && targetPath.startsWith('libs/')) {
    const libPath = targetPath.replace(/^libs\//, '').split('/')[0]
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
  const path = link.split('#')[0]
  if (path.startsWith('/media/')) {
    return existsSync(join(WORKSPACE_ROOT, 'assets', path.replace(/^\//, '')))
  }
  return existsSync(join(DOCS_SITE_ROOT, 'public', path))
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
        return {
          file: filePath,
          line,
          link,
          status: 'valid',
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
    return {
      file: filePath,
      line,
      link,
      status: 'valid',
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
        const targetPath = repoRelativePath(url, 'blob')

        if (targetPath !== undefined && !existsSync(join(WORKSPACE_ROOT, targetPath))) {
          results.push({
            file: relative(WORKSPACE_ROOT, bundlePath),
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
    const relativePath = relative(WORKSPACE_ROOT, file)

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
