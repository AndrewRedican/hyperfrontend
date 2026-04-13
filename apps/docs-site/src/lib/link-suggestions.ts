import type { NavItem } from './navigation'
import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createURLSearchParams } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { docsNavigation, mainNavLinks } from './navigation'

/**
 * A link suggestion for a 404 page.
 */
export interface LinkSuggestion {
  /** Display title */
  title: string
  /** Link href */
  href: string
  /** Description or reason for suggestion */
  description: string
  /** Relevance score (higher = more relevant) */
  score: number
}

/**
 * A flattened route extracted from navigation.
 */
interface FlatRoute {
  /** The route's display slug */
  slug: string
  /** The route's URL path */
  href: string
}

/**
 * Flattens the navigation tree into an array of all valid routes.
 *
 * @param items - Array of navigation items to flatten
 * @param _parentPath - Parent path context for nested items (unused but reserved)
 * @returns Flattened array of route objects with slug and href
 */
function flattenNavigation(items: NavItem[], _parentPath = ''): FlatRoute[] {
  const result: FlatRoute[] = []

  for (const item of items) {
    if (item.href) {
      result.push({ slug: item.slug.toLowerCase(), href: item.href })
    }
    if (item.children) {
      result.push(...flattenNavigation(item.children, item.href ?? _parentPath))
    }
  }

  return result
}

/**
 * Extracts path segments from a URL path.
 *
 * @param path - The URL path to extract segments from
 * @returns Array of lowercase path segments
 */
function extractSegments(path: string): string[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => s.toLowerCase())
}

/**
 * Calculates similarity between two strings using Levenshtein distance.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns The edit distance between the two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculates a normalized similarity score between 0 and 1.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Similarity score where 1 is identical and 0 is completely different
 */
function stringSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b)
  const maxLength = max(a.length, b.length)
  if (maxLength === 0) return 1
  return 1 - distance / maxLength
}

/**
 * Escapes special regex characters in a string.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Checks if string contains a word boundary match.
 *
 * @param text - The text to search in
 * @param word - The word to search for
 * @returns True if the word appears at a word boundary
 */
function containsWord(text: string, word: string): boolean {
  const pattern = `\\b${escapeRegExp(word)}`
  // note: pattern is safe. the escapeRegExp sanitizes all special regex characters
  // eslint-disable-next-line workspace/no-unsafe-regex
  const regex = createRegExp(pattern, 'i')
  return regex.test(text)
}

/**
 * Scores a route against the requested path based on various matching criteria.
 *
 * @param route - The route object containing slug and href
 * @param requestedPath - The original requested path
 * @param requestedSegments - Pre-extracted segments from the requested path
 * @returns Relevance score (higher is more relevant)
 */
function scoreRoute(route: FlatRoute, requestedPath: string, requestedSegments: string[]): number {
  let score = 0
  const routeSegments = extractSegments(route.href)
  const routeSlugLower = route.slug.toLowerCase()

  if (route.href === requestedPath) {
    return 1000
  }

  for (let i = 0; i < min(routeSegments.length, requestedSegments.length); i++) {
    if (routeSegments[i] === requestedSegments[i]) {
      score += 30
    } else {
      break
    }
  }

  for (const segment of requestedSegments) {
    if (segment === routeSlugLower) {
      score += 50
    } else if (routeSlugLower.includes(segment) || segment.includes(routeSlugLower)) {
      score += 25
    } else {
      const similarity = stringSimilarity(segment, routeSlugLower)
      if (similarity > 0.6) {
        score += round(similarity * 20)
      }
    }

    for (const routeSegment of routeSegments) {
      if (segment === routeSegment) {
        score += 15
      } else if (containsWord(routeSegment, segment) || containsWord(segment, routeSegment)) {
        score += 10
      }
    }
  }

  const keywords: Record<string, string[]> = {
    docs: ['documentation', 'guide', 'getting-started', 'reference'],
    api: ['reference', 'libraries'],
    lib: ['libraries', 'utils'],
    utils: ['data', 'string', 'list', 'function', 'time', 'json'],
    start: ['quick-start', 'getting-started', 'installation'],
    install: ['quick-start', 'getting-started'],
    contribute: ['contributing'],
    help: ['docs', 'quick-start'],
    arch: ['architecture'],
    demo: ['demos'],
  }

  for (const segment of requestedSegments) {
    const relatedKeywords = keywords[segment]
    if (relatedKeywords) {
      for (const keyword of relatedKeywords) {
        if (route.href.includes(keyword) || routeSlugLower.includes(keyword)) {
          score += 15
        }
      }
    }
  }

  return score
}

/**
 * Generates human-readable descriptions for suggestions.
 *
 * @param href - The href of the suggested page
 * @param slug - The slug of the suggested page
 * @returns A human-readable description of what the page contains
 */
function generateDescription(href: string, slug: string): string {
  if (href === '/docs') return 'Start exploring the documentation'
  if (href === '/docs/quick-start') return 'Learn how to get up and running'
  if (href === '/architecture') return 'Understand the system architecture'
  if (href === '/demos') return 'See live demonstrations'
  if (href === '/docs/contributing') return 'Learn how to contribute'
  if (href.includes('/libraries/')) {
    const isUtils = href.includes('/utils/')
    const libName = slug.replace(/-/g, ' ')
    return isUtils ? `Utility library: ${libName}` : `Documentation for ${libName}`
  }
  if (href.includes('/plugins/')) return `Plugin: ${slug}`
  return `View ${slug.replace(/-/g, ' ')} page`
}

/**
 * Suggests related pages based on a requested path that resulted in 404.
 *
 * @param requestedPath - The path that was not found
 * @param count - Number of suggestions to return (default: 3)
 * @returns Array of link suggestions sorted by relevance
 */
export function suggestRelatedLinks(requestedPath: string, count = 3): LinkSuggestion[] {
  const allRoutes = [...mainNavLinks.map((item) => ({ slug: item.slug, href: item.href ?? '/' })), ...flattenNavigation(docsNavigation)]

  const requestedSegments = extractSegments(requestedPath)

  const scoredRoutes = allRoutes.map((route) => ({
    ...route,
    score: scoreRoute(route, requestedPath, requestedSegments),
    description: generateDescription(route.href, route.slug),
  }))

  scoredRoutes.sort((a, b) => b.score - a.score)

  const seen = createSet<string>()
  const unique = scoredRoutes.filter((route) => {
    if (seen.has(route.href)) return false
    seen.add(route.href)
    return true
  })

  const topResults = unique.slice(0, count)

  const defaults: LinkSuggestion[] = [
    { title: 'Documentation', href: '/docs', description: 'Start exploring the documentation', score: 5 },
    { title: 'Quick Start', href: '/docs/quick-start', description: 'Learn how to get up and running', score: 4 },
    { title: 'Demos', href: '/demos', description: 'See live demonstrations', score: 3 },
  ]

  const results: LinkSuggestion[] = []
  const usedHrefs = createSet<string>()

  for (const route of topResults) {
    if (!usedHrefs.has(route.href) && route.score > 0) {
      results.push({
        title: route.slug,
        href: route.href,
        description: route.description,
        score: route.score,
      })
      usedHrefs.add(route.href)
    }
    if (results.length >= count) break
  }

  for (const def of defaults) {
    if (results.length >= count) break
    if (!usedHrefs.has(def.href)) {
      results.push(def)
      usedHrefs.add(def.href)
    }
  }

  return results.slice(0, count)
}

/**
 * Generates a GitHub issue URL with pre-filled content for reporting a broken link.
 *
 * @param brokenPath - The path that was not found
 * @param referrer - Optional referrer URL
 * @returns GitHub new issue URL with query params
 */
export function generateBugReportUrl(brokenPath: string, referrer?: string): string {
  const baseUrl = 'https://github.com/AndrewRedican/hyperfrontend/issues/new'

  const title = `[Broken Link] 404 error at ${brokenPath}`

  const body = `## Broken Link Report

**URL that returned 404:**
\`${brokenPath}\`

${referrer ? `**Referrer (where you came from):**\n\`${referrer}\`\n` : ''}
**Browser/Device:**
<!-- Please fill in your browser and device info -->

**Additional context:**
<!-- Optional: What were you trying to find? -->

---
*This issue was auto-generated from the 404 page.*`

  const labels = 'bug,documentation'

  const params = createURLSearchParams({
    title,
    body,
    labels,
  })

  return `${baseUrl}?${params.toString()}`
}
