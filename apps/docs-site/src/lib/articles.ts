import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { splitList } from './article-format'

export { formatArticleDate, splitList } from './article-format'

const ARTICLES_DIR = resolve(process.cwd(), 'content/articles')

/**
 * A long-form article hosted canonically on the docs site.
 */
export interface Article {
  /** URL slug derived from the markdown filename */
  slug: string
  /** Article title */
  title: string
  /** Short summary used for cards and metadata */
  description: string
  /** Publication date in YYYY-MM-DD format */
  date: string
  /** Author display name */
  author: string
  /** Human-readable reading time (e.g., "39 min read") */
  readingTime: string
  /** Site-relative path to the hero image */
  heroImage: string
  /** URL of the syndicated copy on Medium, if any */
  mediumUrl?: string
  /** URL of the syndicated copy on Hackernoon, if any */
  hackernoonUrl?: string
  /** Content category (e.g., "first-principles"); empty when uncategorized */
  category: string
  /** Discovery tags */
  tags: string[]
  /** npm packages this article is most relevant to */
  packages: string[]
  /** Slugs of related articles */
  related: string[]
  /** Last substantive revision date in YYYY-MM-DD format; empty when never revised */
  updated: string
  /** Markdown body without frontmatter */
  content: string
}

/**
 * Frontmatter fields parsed from an article markdown file.
 */
interface ArticleFrontmatter {
  /** Article title */
  title?: string
  /** Short summary used for cards and metadata */
  description?: string
  /** Publication date in YYYY-MM-DD format */
  date?: string
  /** Author display name */
  author?: string
  /** Human-readable reading time */
  readingTime?: string
  /** Site-relative path to the hero image */
  heroImage?: string
  /** URL of the syndicated copy on Medium */
  mediumUrl?: string
  /** URL of the syndicated copy on Hackernoon */
  hackernoonUrl?: string
  /** Content category */
  category?: string
  /** Comma-separated discovery tags */
  tags?: string
  /** Comma-separated npm package names */
  packages?: string
  /** Comma-separated slugs of related articles */
  related?: string
  /** Last substantive revision date in YYYY-MM-DD format */
  updated?: string
}

/**
 * Frontmatter block split from an article markdown file.
 */
interface ParsedArticleFile {
  /** Flat key/value pairs from the frontmatter block */
  data: Record<string, string>
  /** Markdown body without the frontmatter block */
  content: string
}

/**
 * Split a markdown file into its frontmatter fields and body.
 *
 * Supports the flat `key: 'value'` subset of YAML used by article files;
 * nested structures and folded blocks are not supported.
 *
 * @param raw - Full markdown file contents
 * @returns Parsed frontmatter fields and the remaining body
 */
function parseArticleFile(raw: string): ParsedArticleFile {
  if (!raw.startsWith('---\n')) {
    return { data: {}, content: raw }
  }

  const closingIndex = raw.indexOf('\n---\n', 4)
  if (closingIndex === -1) {
    return { data: {}, content: raw }
  }

  const data: Record<string, string> = {}

  for (const line of raw.slice(4, closingIndex).split('\n')) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    // why: Frontmatter values may be quoted for YAML compatibility; the quotes are not part of the value
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1)
    }

    if (key) {
      data[key] = value
    }
  }

  return { data, content: raw.slice(closingIndex + 5) }
}

/**
 * Load and parse a single article by its URL slug.
 *
 * @param slug - The article slug (markdown filename without extension)
 * @returns The parsed article or null if not found
 */
export function getArticle(slug: string): Article | null {
  const filePath = join(ARTICLES_DIR, `${slug}.md`)

  if (!existsSync(filePath)) {
    return null
  }

  const { data, content } = parseArticleFile(readFileSync(filePath, 'utf-8'))
  const frontmatter = data as ArticleFrontmatter

  return {
    slug,
    title: frontmatter.title ?? slug,
    description: frontmatter.description ?? '',
    date: frontmatter.date ?? '',
    author: frontmatter.author ?? '',
    readingTime: frontmatter.readingTime ?? '',
    heroImage: frontmatter.heroImage ?? '',
    mediumUrl: frontmatter.mediumUrl,
    hackernoonUrl: frontmatter.hackernoonUrl,
    category: frontmatter.category ?? '',
    tags: splitList(frontmatter.tags),
    packages: splitList(frontmatter.packages),
    related: splitList(frontmatter.related),
    updated: frontmatter.updated ?? '',
    content,
  }
}

/**
 * List every article slug available in the content directory.
 *
 * @returns Array of article slugs
 */
export function getAllArticleSlugs(): string[] {
  if (!existsSync(ARTICLES_DIR)) {
    return []
  }

  return readdirSync(ARTICLES_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice(0, -3))
}

/**
 * Load all articles, newest first.
 *
 * @returns Array of parsed articles sorted by publication date descending
 */
export function getAllArticles(): Article[] {
  const articles: Article[] = []

  for (const slug of getAllArticleSlugs()) {
    const article = getArticle(slug)
    if (article) {
      articles.push(article)
    }
  }

  // why: ISO YYYY-MM-DD dates sort correctly as plain strings
  return articles.sort((a, b) => b.date.localeCompare(a.date))
}
