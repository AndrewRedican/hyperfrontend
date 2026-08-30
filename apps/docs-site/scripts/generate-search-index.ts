import type { SearchDocument, SearchIndex } from '../src/lib/search/search-contract'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { getAllArticles } from '../src/lib/articles'
import { libraryRoute } from '../src/lib/library-routes'
import { docsNavigation, mainNavLinks } from '../src/lib/navigation'
import { extractMarkdownSections } from '../src/lib/slug'

const OUTPUT_DIR = resolve(__dirname, '../.generated')
const PUBLIC_INDEX = resolve(__dirname, '../public/search-index.json')

/** TypeDoc reflection kinds that receive an `api-<name>` anchor on library pages. */
const API_SYMBOL_KINDS = createSet([8, 32, 64, 128, 256, 2097152])

/** TypeDoc reflection kind for a module (descended into, never indexed itself). */
const MODULE_KIND = 2

/** Minimal shape of a navigation item for traversal. */
interface NavNode {
  /** Display slug */
  slug: string
  /** Full npm package name, when the item is a package */
  packageName?: string
  /** Route, when the item links somewhere */
  href?: string
  /** Nested items */
  children?: NavNode[]
}

/** One library entry read from the generated docs manifest. */
interface ManifestLibrary {
  /** Display name */
  name: string
  /** npm package name */
  packageName: string
  /** Generated-content slug */
  slug: string
  /** Library category */
  category: string
  /** Package description */
  description: string
  /** Package keywords */
  keywords: string[]
}

/** The generated docs manifest, narrowed to what the index producer reads. */
interface DocsManifest {
  /** Documented libraries */
  libraries: ManifestLibrary[]
}

/** Minimal shape of a TypeDoc reflection node. */
interface TypedocNode {
  /** Symbol name */
  name?: string
  /** Reflection kind */
  kind?: number
  /** Nested reflections */
  children?: TypedocNode[]
}

/**
 * Read markdown sections from a generated file, when it exists.
 *
 * @param relativePath - Path under `.generated/`
 * @returns Sections, or undefined when the file is absent or has none
 */
function sectionsFrom(relativePath: string) {
  const filePath = join(OUTPUT_DIR, relativePath)
  if (!existsSync(filePath)) return undefined
  const sections = extractMarkdownSections(readFileSync(filePath, 'utf-8')).map(({ title, anchor }) => ({ title, anchor }))
  return sections.length > 0 ? sections : undefined
}

/**
 * Collect the exported symbol names that render with an `api-<name>` anchor
 * on a library page, from that library's TypeDoc JSON.
 *
 * @param slug - Generated-content library slug
 * @returns Unique symbol names in stable (sorted) order
 */
function collectApiSymbols(slug: string): string[] {
  const apiPath = join(OUTPUT_DIR, 'api', slug, 'api.json')
  if (!existsSync(apiPath)) return []

  const names = createSet<string>()
  const visit = (node: TypedocNode, depth: number) => {
    for (const child of node.children ?? []) {
      if (child.kind === MODULE_KIND && depth < 2) {
        visit(child, depth + 1)
      } else if (typeof child.kind === 'number' && API_SYMBOL_KINDS.has(child.kind) && child.name) {
        names.add(child.name)
      }
    }
  }
  visit(parse(readFileSync(apiPath, 'utf-8')), 0)
  return [...names].sort()
}

/**
 * Walk the navigation tree, emitting one document per linked route that no
 * richer source already covers.
 *
 * @param nodes - Navigation items
 * @param seen - Routes already emitted by richer sources
 * @param parentPackage - Nearest ancestor package name
 * @param documents - Accumulator
 */
function collectNavDocuments(nodes: NavNode[], seen: Set<string>, parentPackage: string | undefined, documents: SearchDocument[]): void {
  for (const node of nodes) {
    const ownPackage = node.packageName ?? parentPackage
    if (node.href && !seen.has(node.href)) {
      seen.add(node.href)
      const segments = node.href.split('/').filter(Boolean)
      const isSubmodule = node.href.startsWith('/docs/libraries/') && segments.length > 3
      // why: Many libraries expose a submodule of the same name (parse, models, operations); the import path is what makes a result identifiable
      const subpath = isSubmodule ? segments.slice(3).join('/') : ''
      documents.push({
        url: node.href,
        title: isSubmodule && ownPackage ? `${ownPackage}/${subpath}` : node.slug,
        kind: isSubmodule ? 'submodule' : 'page',
        description: isSubmodule && ownPackage ? `${subpath} entry point of ${ownPackage}` : undefined,
        package: isSubmodule ? ownPackage : undefined,
        terms: isSubmodule ? [node.slug, subpath] : undefined,
      })
    }
    if (node.children) {
      collectNavDocuments(node.children, seen, ownPackage, documents)
    }
  }
}

/**
 * Compile the omni-search index over libraries, API symbols, submodules,
 * guides, articles, and hand-authored pages, and emit it to
 * `public/search-index.json`.
 *
 * The output honors the contract in `src/lib/search/search-contract.ts`:
 * deterministic ordering, no timestamps, every entry addressable.
 */
function generateSearchIndex(): void {
  logger.log('🔍 Compiling search index...')

  const documents: SearchDocument[] = []
  const seen = createSet<string>()

  const manifestPath = join(OUTPUT_DIR, 'manifest.json')
  const manifest: DocsManifest = existsSync(manifestPath) ? parse(readFileSync(manifestPath, 'utf-8')) : { libraries: [] }

  for (const library of manifest.libraries) {
    const route = libraryRoute(library.slug, library.category)
    seen.add(route)
    documents.push({
      url: route,
      title: library.name,
      kind: 'library',
      description: library.description || undefined,
      package: library.packageName,
      terms: isArray(library.keywords) && library.keywords.length > 0 ? library.keywords : undefined,
      sections: sectionsFrom(`docs/${library.slug}/readme.md`),
    })

    const architectureSections = sectionsFrom(`docs/${library.slug}/architecture.md`)
    if (existsSync(join(OUTPUT_DIR, 'docs', library.slug, 'architecture.md'))) {
      seen.add(`${route}/architecture`)
      documents.push({
        url: `${route}/architecture`,
        title: `${library.name} architecture`,
        kind: 'architecture',
        package: library.packageName,
        sections: architectureSections,
      })
    }

    for (const symbol of collectApiSymbols(library.slug)) {
      documents.push({
        url: route,
        anchor: `api-${symbol}`,
        title: symbol,
        kind: 'api',
        package: library.packageName,
      })
    }
  }

  const guidesIndexPath = join(OUTPUT_DIR, 'guides', 'index.json')
  if (existsSync(guidesIndexPath)) {
    const guideIndex = parse(readFileSync(guidesIndexPath, 'utf-8'))
    for (const guide of guideIndex.guides) {
      seen.add(guide.route)
      documents.push({
        url: guide.route,
        title: guide.title,
        kind: 'guide',
        description: guide.problem,
        package: guide.packages[0],
        terms: [...guide.packages, ...guide.keywords],
        sections: sectionsFrom(`guides/${guide.slug}/guide.md`),
      })
    }
  }

  for (const article of getAllArticles()) {
    const route = `/articles/${article.slug}`
    seen.add(route)
    const sections = extractMarkdownSections(article.content).map(({ title, anchor }) => ({ title, anchor }))
    documents.push({
      url: route,
      title: article.title,
      kind: 'article',
      description: article.description || undefined,
      terms: [...article.tags, ...article.packages, article.category].filter(Boolean),
      sections: sections.length > 0 ? sections : undefined,
    })
  }

  if (existsSync(join(OUTPUT_DIR, 'docs', 'architecture.md'))) {
    seen.add('/architecture')
    documents.push({
      url: '/architecture',
      title: 'Architecture',
      kind: 'architecture',
      description: 'How the HyperFrontend libraries compose into one system',
      sections: sectionsFrom('docs/architecture.md'),
    })
  }
  if (existsSync(join(OUTPUT_DIR, 'docs', 'contributing.md'))) {
    seen.add('/docs/contributing')
    documents.push({
      url: '/docs/contributing',
      title: 'Contributing',
      kind: 'page',
      sections: sectionsFrom('docs/contributing.md'),
    })
  }

  // why: the fit assessment is linked from the docs landing page rather than the sidebar, so nav traversal never reaches it and site search would miss the one page that answers "which approach do I need"
  seen.add('/docs/is-hyperfrontend-right-for-you')
  documents.push({
    url: '/docs/is-hyperfrontend-right-for-you',
    title: 'Is HyperFrontend right for you?',
    kind: 'page',
    description: 'A short assessment that names the microfrontend approach your constraints allow, or tells you that you need none',
    terms: [
      'microfrontend',
      'decision',
      'assessment',
      'fit',
      'compare',
      'alternatives',
      'module federation',
      'single-spa',
      'iframe',
      'should I use microfrontends',
    ],
  })

  collectNavDocuments(<NavNode[]>docsNavigation, seen, undefined, documents)
  collectNavDocuments(<NavNode[]>mainNavLinks, seen, undefined, documents)

  documents.sort((a, b) => a.url.localeCompare(b.url) || (a.anchor ?? '').localeCompare(b.anchor ?? '') || a.title.localeCompare(b.title))

  const index: SearchIndex = { schemaVersion: 1, documents }
  writeFileSync(PUBLIC_INDEX, stringify(index))
  logger.log(`  ${documents.length} documents indexed → public/search-index.json\n`)
}

if (require.main === module) {
  generateSearchIndex()
}

export { generateSearchIndex }
