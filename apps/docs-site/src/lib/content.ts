import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import matter from 'gray-matter'

const WORKSPACE_ROOT = resolve(process.cwd(), '../..')

/**
 * Information about a library in the documentation system.
 */
export interface LibraryInfo {
  /** Display name of the library */
  name: string
  /** npm package name */
  packageName: string
  /** URL slug for routing */
  slug: string
  /** Path to README file */
  readmePath: string
  /** Path to architecture documentation (optional) */
  architecturePath?: string
  /** TypeScript entry point files */
  entryPoints: string[]
  /** Library category */
  category: 'core' | 'supporting' | 'utils' | 'plugin'
}

export const LIBRARIES: LibraryInfo[] = [
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
  {
    name: 'Builder',
    packageName: '@hyperfrontend/builder',
    slug: 'builder',
    readmePath: 'libs/builder/README.md',
    entryPoints: ['libs/builder/src/index.ts'],
    category: 'core',
  },
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
  {
    name: 'Project Scope',
    packageName: '@hyperfrontend/project-scope',
    slug: 'project-scope',
    readmePath: 'libs/project-scope/README.md',
    architecturePath: 'libs/project-scope/ARCHITECTURE.md',
    entryPoints: ['libs/project-scope/src/index.ts'],
    category: 'supporting',
  },
  {
    name: 'Versioning',
    packageName: '@hyperfrontend/versioning',
    slug: 'versioning',
    readmePath: 'libs/versioning/README.md',
    entryPoints: ['libs/versioning/src/index.ts'],
    category: 'supporting',
  },
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
    name: 'Immutable API Utils',
    packageName: '@hyperfrontend/immutable-api-utils',
    slug: 'utils/immutable-api',
    readmePath: 'libs/utils/immutable-api/README.md',
    entryPoints: ['libs/utils/immutable-api/src/index.ts'],
    category: 'utils',
  },
  {
    name: 'JSON Utils',
    packageName: '@hyperfrontend/json-utils',
    slug: 'utils/json',
    readmePath: 'libs/utils/json/README.md',
    entryPoints: ['libs/utils/json/src/index.ts'],
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
    name: 'Random Generator Utils',
    packageName: '@hyperfrontend/random-generator-utils',
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
  {
    name: 'Questions',
    packageName: '@hyperfrontend/questions',
    slug: 'questions',
    readmePath: 'libs/questions/README.md',
    entryPoints: ['libs/questions/src/index.ts'],
    category: 'supporting',
  },
  {
    name: 'Features',
    packageName: '@hyperfrontend/features',
    slug: 'features',
    readmePath: 'libs/features/README.md',
    architecturePath: 'libs/features/ARCHITECTURE.md',
    entryPoints: [
      'libs/features/src/index.ts',
      'libs/features/src/host/index.ts',
      'libs/features/src/hostee/index.ts',
      'libs/features/src/cli/index.ts',
      'libs/features/src/server/index.ts',
    ],
    category: 'core',
  },
]

/**
 * Parsed markdown file with frontmatter data extracted.
 */
export interface ParsedMarkdown {
  /** Markdown content without frontmatter */
  content: string
  /** Frontmatter data as key-value pairs */
  data: Record<string, unknown>
  /** Original file content including frontmatter */
  rawContent: string
}

/**
 * Extracted section from markdown content.
 */
export interface ExtractedSection {
  /** Section heading text */
  title: string
  /** Heading level (1-6) */
  level: number
  /** Section content (excluding heading) */
  content: string
  /** URL anchor slug */
  anchor: string
}

/**
 * Internal section builder during parsing.
 */
interface SectionBuilder {
  /** Section heading text */
  title: string
  /** Heading level (1-6) */
  level: number
  /** Lines of content being collected */
  content: string[]
  /** URL anchor slug */
  anchor: string
}

/**
 * Read and parse a markdown file with frontmatter
 *
 * @param relativePath - The relative path to the markdown file from workspace root
 * @returns The parsed markdown file with content, data, and raw content, or null if not found
 */
export function parseMarkdownFile(relativePath: string): ParsedMarkdown | null {
  const fullPath = join(WORKSPACE_ROOT, relativePath)

  if (!existsSync(fullPath)) {
    return null
  }

  const fileContents = readFileSync(fullPath, 'utf8')
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
export function extractSections(content: string): ExtractedSection[] {
  const sections: ExtractedSection[] = []
  const lines = content.split('\n')

  let currentSection: SectionBuilder | null = null

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headerMatch) {
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
  const cleaned = content.replace(/<p align="center">[\s\S]*?<\/p>/g, '')

  return cleaned.replace(/^\[!\[.*?\]\(.*?\)\]\(.*?\)\s*$/gm, '').trim()
}

/**
 * Context for transforming relative links in submodule content
 */
export interface TransformLinksContext {
  /** The library slug (e.g., 'network-protocol') */
  librarySlug?: string
  /** The current submodule path (e.g., 'browser') */
  submodulePath?: string
}

/**
 * Transform links from GitHub URLs to docs site URLs
 *
 * @param content - The markdown content with GitHub links
 * @param context - Optional context for resolving relative links in submodules
 * @returns The content with transformed links
 */
export function transformLinks(content: string, context?: TransformLinksContext): string {
  let transformed = content

  transformed = transformed.replace(
    /\]\(https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/libs\/([^/)]+)\/README\.md\)/g,
    '](/docs/libraries/$1)'
  )

  transformed = transformed.replace(
    /\]\(https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/libs\/utils\/([^/)]+)\/README\.md\)/g,
    '](/docs/libraries/utils/$1)'
  )

  transformed = transformed.replace(
    /\]\(https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/ARCHITECTURE\.md\)/g,
    '](/architecture)'
  )

  transformed = transformed.replace(
    /\]\(https:\/\/github\.com\/AndrewRedican\/hyperfrontend\/blob\/main\/libs\/([^/)]+)\/ARCHITECTURE\.md\)/g,
    '](/docs/libraries/$1/architecture)'
  )

  transformed = transformed.replace(/\[([^\]]+)\]\(\.\.\/\.\.\/libs\/([^/]+)\/README\.md\)/g, '[$1](/docs/libraries/$2)')

  if (context?.librarySlug) {
    transformed = transformed.replace(/\[([^\]]+)\]\(\.\.\/([^/]+)\/README\.md\)/g, `[$1](/docs/libraries/${context.librarySlug}/$2)`)

    transformed = transformed.replace(/\[([^\]]+)\]\(\.\.\/\.\.\/README\.md\)/g, `[$1](/docs/libraries/${context.librarySlug})`)

    // why: Inside a library, `ARCHITECTURE.md` names that library's own guide, not the workspace-root overview the filename would otherwise resolve to.
    transformed = transformed.replace(
      /\[([^\]]+)\]\((?:\.\/|\.\.\/\.\.\/)?ARCHITECTURE\.md\)/g,
      `[$1](/docs/libraries/${context.librarySlug}/architecture)`
    )
  } else {
    transformed = transformed.replace(/\[([^\]]+)\]\(\.\/ARCHITECTURE\.md\)/g, '[$1](/architecture)')
  }

  return transformed
}

/**
 * Mermaid diagram extracted from markdown.
 */
export interface MermaidDiagram {
  /** The diagram markup */
  diagram: string
  /** Position index in the original content */
  index: number
}

/**
 * Extract Mermaid diagram blocks from markdown
 *
 * @param content - The markdown content to extract diagrams from
 * @returns An array of diagram objects with diagram text and index
 */
export function extractMermaidDiagrams(content: string): MermaidDiagram[] {
  const diagrams: MermaidDiagram[] = []
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
  return existsSync(join(WORKSPACE_ROOT, relativePath))
}
