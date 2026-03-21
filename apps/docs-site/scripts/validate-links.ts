#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join, dirname, relative } from 'node:path'
import { glob } from 'glob'
import { log, error } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'

const WORKSPACE_ROOT = resolve(__dirname, '../../..')
const DOCS_SITE_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = join(DOCS_SITE_ROOT, '.generated')
const SRC_DIR = join(DOCS_SITE_ROOT, 'src')
const GITHUB_BLOB_PATTERN = /^https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/[^/]+\/(.+)/
const GITHUB_TREE_PATTERN = /^https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/tree\/[^/]+\/(.+)/

interface LinkValidationResult {
  file: string
  line: number
  link: string
  status: 'valid' | 'broken' | 'external' | 'transformed'
  message?: string
  transformedTo?: string
}

interface ValidationSummary {
  totalLinks: number
  validLinks: number
  brokenLinks: number
  externalLinks: number
  transformedLinks: number
  errors: LinkValidationResult[]
}

/**
 * Extract all links from markdown content
 *
 * @param content - The markdown content to parse
 * @returns Array of link objects with link URL, line number, and link text
 */
function extractLinks(content: string): Array<{ link: string; line: number; text: string }> {
  const links: Array<{ link: string; line: number; text: string }> = []
  const lines = content.split('\n')

  // Markdown link pattern: [text](url)
  const markdownLinkPattern = /\[([^\]]*)\]\(([^)]+)\)/g

  // HTML link pattern: href="url"
  const htmlLinkPattern = /href=["']([^"']+)["']/g

  lines.forEach((line, index) => {
    let match

    // Extract markdown links
    while ((match = markdownLinkPattern.exec(line)) !== null) {
      links.push({
        text: match[1],
        link: match[2],
        line: index + 1,
      })
    }

    // Extract HTML links
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
 * Transform GitHub blob/tree URLs to docs site paths
 *
 * @param link - The GitHub URL to transform
 * @returns Object with transformed flag, original URL, and optional docs site path
 */
function transformGitHubUrl(link: string): { transformed: boolean; url: string; docsSitePath?: string } {
  // Match GitHub blob URLs
  let match = GITHUB_BLOB_PATTERN.exec(link)
  if (match) {
    const filePath = match[1]
    // Transform libs/* paths to docs site library pages
    if (filePath.startsWith('libs/')) {
      const libPath = filePath.replace(/^libs\//, '').split('/')[0]
      return {
        transformed: true,
        url: link,
        docsSitePath: `/docs/libraries/${libPath}`,
      }
    }
  }

  // Match GitHub tree URLs
  match = GITHUB_TREE_PATTERN.exec(link)
  if (match) {
    const dirPath = match[1]
    if (dirPath.startsWith('libs/')) {
      const libPath = dirPath.replace(/^libs\//, '').split('/')[0]
      return {
        transformed: true,
        url: link,
        docsSitePath: `/docs/libraries/${libPath}`,
      }
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
  // Remove anchor from link
  const linkWithoutAnchor = link.split('#')[0]

  if (linkWithoutAnchor.startsWith('/')) {
    // Absolute path from docs site root
    return join(SRC_DIR, 'app', linkWithoutAnchor)
  }

  // Relative path from current file
  const dir = dirname(basePath)
  return resolve(dir, linkWithoutAnchor)
}

/**
 * Check if a path exists (files or directories)
 *
 * @param targetPath - The path to check for existence
 * @returns True if the path exists as a file or directory
 */
function pathExists(targetPath: string): boolean {
  // Try exact path
  if (existsSync(targetPath)) {
    return true
  }

  // Try with common extensions
  const extensions = ['.md', '.mdx', '.tsx', '/page.tsx', '/index.tsx']
  for (const ext of extensions) {
    if (existsSync(targetPath + ext)) {
      return true
    }
  }

  // For docs site routes, check if page.tsx exists
  const pageFile = join(targetPath, 'page.tsx')
  if (existsSync(pageFile)) {
    return true
  }

  return false
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
  // Skip anchor links
  if (isAnchorLink(link)) {
    return {
      file: filePath,
      line,
      link,
      status: 'valid',
      message: 'Anchor link',
    }
  }

  // Handle external links
  if (isExternalLink(link)) {
    // Check for GitHub URL transformation
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

  // Handle internal links
  const resolvedPath = resolveRelativePath(link, filePath)

  if (pathExists(resolvedPath)) {
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
 * Main validation function
 *
 * @returns Promise resolving to validation summary with counts and errors
 */
async function validateLinks(): Promise<ValidationSummary> {
  log('🔗 Validating documentation links...\n')

  const summary: ValidationSummary = {
    totalLinks: 0,
    validLinks: 0,
    brokenLinks: 0,
    externalLinks: 0,
    transformedLinks: 0,
    errors: [],
  }

  // Find all markdown files in generated docs
  const generatedMdFiles = await glob('**/*.md', { cwd: GENERATED_DIR, absolute: true })

  // Find all markdown files in workspace root (READMEs, etc.)
  const rootMdFiles = await glob('*.md', { cwd: WORKSPACE_ROOT, absolute: true })

  // Find markdown in libs
  const libMdFiles = await glob('libs/**/*.md', { cwd: WORKSPACE_ROOT, absolute: true })

  const allFiles = [...generatedMdFiles, ...rootMdFiles, ...libMdFiles]

  log(`📄 Found ${allFiles.length} markdown files to validate\n`)

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

  // Print results
  log('📊 Validation Summary')
  log('─'.repeat(40))
  log(`Total links:       ${summary.totalLinks}`)
  log(`✓ Valid:           ${summary.validLinks}`)
  log(`↗ External:        ${summary.externalLinks}`)
  log(`⟳ Transformable:   ${summary.transformedLinks}`)
  log(`✗ Broken:          ${summary.brokenLinks}`)
  log('')

  if (summary.brokenLinks > 0) {
    log('❌ Broken Links:')
    log('─'.repeat(40))
    for (const err of summary.errors) {
      log(`  ${err.file}:${err.line}`)
      log(`    Link: ${err.link}`)
      log(`    ${err.message}\n`)
    }
  }

  if (summary.brokenLinks === 0) {
    log('✅ All internal links are valid!')
  }

  return summary
}

// Run if executed directly
if (require.main === module) {
  validateLinks()
    .then((summary) => {
      // Exit with error code if there are broken links
      if (summary.brokenLinks > 0) {
        process.exit(1)
      }
    })
    .catch((err) => {
      error('Link validation failed:', err)
      process.exit(1)
    })
}

export { validateLinks, extractLinks, transformGitHubUrl }
