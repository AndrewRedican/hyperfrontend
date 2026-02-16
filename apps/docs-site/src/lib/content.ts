import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..')

export interface LibraryInfo {
  name: string
  packageName: string
  slug: string
  readmePath: string
  architecturePath?: string
  entryPoints: string[]
  category: 'core' | 'supporting' | 'utils' | 'plugin'
}

export const LIBRARIES: LibraryInfo[] = [
  // Core libraries
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    architecturePath: 'libs/nexus/ARCHITECTURE.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  },
  {
    name: 'Network Protocol',
    packageName: '@hyperfrontend/network-protocol',
    slug: 'network-protocol',
    readmePath: 'libs/network-protocol/README.md',
    entryPoints: ['libs/network-protocol/src/index.ts'],
    category: 'core',
  },
  {
    name: 'Cryptography',
    packageName: '@hyperfrontend/cryptography',
    slug: 'cryptography',
    readmePath: 'libs/cryptography/README.md',
    entryPoints: ['libs/cryptography/src/browser/index.ts', 'libs/cryptography/src/node/index.ts', 'libs/cryptography/src/common/index.ts'],
    category: 'core',
  },
  // Supporting libraries
  {
    name: 'State Machine',
    packageName: '@hyperfrontend/state-machine',
    slug: 'state-machine',
    readmePath: 'libs/state-machine/README.md',
    architecturePath: 'libs/state-machine/ARCHITECTURE.md',
    entryPoints: ['libs/state-machine/src/index.ts'],
    category: 'supporting',
  },
  {
    name: 'Logging',
    packageName: '@hyperfrontend/logging',
    slug: 'logging',
    readmePath: 'libs/logging/README.md',
    entryPoints: ['libs/logging/src/index.ts'],
    category: 'supporting',
  },
  {
    name: 'Web Worker',
    packageName: '@hyperfrontend/web-worker',
    slug: 'web-worker',
    readmePath: 'libs/web-worker/README.md',
    entryPoints: ['libs/web-worker/src/index.ts'],
    category: 'supporting',
  },
  // Utils sub-packages
  {
    name: 'Data Utils',
    packageName: '@hyperfrontend/data-utils',
    slug: 'utils/data',
    readmePath: 'libs/utils/data/README.md',
    entryPoints: ['libs/utils/data/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Function Utils',
    packageName: '@hyperfrontend/function-utils',
    slug: 'utils/function',
    readmePath: 'libs/utils/function/README.md',
    entryPoints: ['libs/utils/function/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Immutable API',
    packageName: '@hyperfrontend/immutable-api',
    slug: 'utils/immutable-api',
    readmePath: 'libs/utils/immutable-api/README.md',
    entryPoints: ['libs/utils/immutable-api/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'List Utils',
    packageName: '@hyperfrontend/list-utils',
    slug: 'utils/list',
    readmePath: 'libs/utils/list/README.md',
    entryPoints: ['libs/utils/list/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Random Generator',
    packageName: '@hyperfrontend/random-generator',
    slug: 'utils/random-generator',
    readmePath: 'libs/utils/random-generator/README.md',
    entryPoints: ['libs/utils/random-generator/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'String Utils',
    packageName: '@hyperfrontend/string-utils',
    slug: 'utils/string',
    readmePath: 'libs/utils/string/README.md',
    entryPoints: ['libs/utils/string/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Time Utils',
    packageName: '@hyperfrontend/time-utils',
    slug: 'utils/time',
    readmePath: 'libs/utils/time/README.md',
    entryPoints: ['libs/utils/time/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'UI Utils',
    packageName: '@hyperfrontend/ui-utils',
    slug: 'utils/ui',
    readmePath: 'libs/utils/ui/README.md',
    entryPoints: ['libs/utils/ui/src/index.ts'],
    category: 'utils',
  },
  // Plugin
  {
    name: 'Features Plugin',
    packageName: '@hyperfrontend/features',
    slug: 'features',
    readmePath: 'plugins/features/README.md',
    entryPoints: ['plugins/features/src/index.ts'],
    category: 'plugin',
  },
]

export interface ParsedMarkdown {
  content: string
  data: Record<string, unknown>
  rawContent: string
}

/**
 * Read and parse a markdown file with frontmatter
 *
 * @param relativePath - The relative path to the markdown file from workspace root
 * @returns The parsed markdown file with content, data, and raw content, or null if not found
 */
export function parseMarkdownFile(relativePath: string): ParsedMarkdown | null {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath)

  if (!fs.existsSync(fullPath)) {
    return null
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { content, data } = matter(fileContents)

  return {
    content,
    data,
    rawContent: fileContents,
  }
}

/**
 * Extract sections from markdown content
 *
 * @param content - The markdown content to extract sections from
 * @returns An array of sections with title, level, content, and anchor
 */
export function extractSections(content: string): { title: string; level: number; content: string; anchor: string }[] {
  const sections: { title: string; level: number; content: string; anchor: string }[] = []
  const lines = content.split('\n')

  let currentSection: { title: string; level: number; content: string[]; anchor: string } | null = null

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections.push({
          ...currentSection,
          content: currentSection.content.join('\n').trim(),
        })
      }

      const level = headerMatch[1].length
      const title = headerMatch[2]
      const anchor = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')

      currentSection = { title, level, content: [], anchor }
    } else if (currentSection) {
      currentSection.content.push(line)
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push({
      ...currentSection,
      content: currentSection.content.join('\n').trim(),
    })
  }

  return sections
}

/**
 * Remove badge section from README content (typically at the top)
 *
 * @param content - The markdown content to clean
 * @returns The content with badges removed
 */
export function removeBadges(content: string): string {
  // Remove badge blocks (typically <p align="center"> blocks with badges)
  const cleaned = content.replace(/<p align="center">[\s\S]*?<\/p>/g, '')

  // Remove standalone badge markdown
  return cleaned.replace(/^\[!\[.*?\]\(.*?\)\]\(.*?\)\s*$/gm, '').trim()
}

/**
 * Transform links from GitHub URLs to docs site URLs
 *
 * @param content - The markdown content with GitHub links
 * @returns The content with transformed links
 */
export function transformLinks(content: string): string {
  let transformed = content

  // Transform GitHub blob URLs to docs site URLs
  transformed = transformed.replace(
    /https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/libs\/([^/]+)\/README\.md/g,
    '/docs/libraries/$1'
  )

  transformed = transformed.replace(
    /https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/libs\/utils\/([^/]+)\/README\.md/g,
    '/docs/libraries/utils/$1'
  )

  transformed = transformed.replace(
    /https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/plugins\/([^/]+)\/README\.md/g,
    '/docs/plugins/$1'
  )

  // Transform GitHub architecture doc links
  transformed = transformed.replace(/https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/ARCHITECTURE\.md/g, '/architecture')

  transformed = transformed.replace(
    /https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/libs\/([^/]+)\/ARCHITECTURE\.md/g,
    '/docs/libraries/$1/architecture'
  )

  // Transform relative links
  transformed = transformed.replace(/\[([^\]]+)\]\(\.\/ARCHITECTURE\.md\)/g, '[$1](/architecture)')

  transformed = transformed.replace(/\[([^\]]+)\]\(\.\.\/\.\.\/libs\/([^/]+)\/README\.md\)/g, '[$1](/docs/libraries/$2)')

  return transformed
}

/**
 * Extract Mermaid diagram blocks from markdown
 *
 * @param content - The markdown content to extract diagrams from
 * @returns An array of diagram objects with diagram text and index
 */
export function extractMermaidDiagrams(content: string): { diagram: string; index: number }[] {
  const diagrams: { diagram: string; index: number }[] = []
  const regex = /```mermaid\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    diagrams.push({
      diagram: match[1].trim(),
      index: match.index,
    })
  }

  return diagrams
}

/**
 * Find a library by its URL slug
 *
 * @param slug - The URL slug identifier for the library
 * @returns The library info or undefined if not found
 */
export function getLibraryBySlug(slug: string): LibraryInfo | undefined {
  return LIBRARIES.find((lib) => lib.slug === slug)
}

/**
 * Filter libraries by category
 *
 * @param category - The category to filter by
 * @returns An array of libraries matching the category
 */
export function getLibrariesByCategory(category: LibraryInfo['category']): LibraryInfo[] {
  return LIBRARIES.filter((lib) => lib.category === category)
}

/**
 * Check if a file exists in the workspace
 *
 * @param relativePath - The relative path from workspace root
 * @returns True if the file exists, false otherwise
 */
export function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(WORKSPACE_ROOT, relativePath))
}
