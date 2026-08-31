import type { DocumentDescriptor, DocumentKind } from './document-model'
import type { NavItem } from './navigation'
import { getAllArticles } from './articles'
import { removeBadges, transformLinks } from './content'
import {
  getAcknowledgments,
  getLibraryArchitecture,
  getLibraryReadme,
  getManifest,
  getManifesto,
  getRegardingAi,
  getRootArchitecture,
  getSubmoduleReadme,
} from './docs-loader'
import { documentSubject } from './document-model'
import { getGuide, getGuideIndex } from './guides'
import { libraryRoute } from './library-routes'
import { docsNavigation } from './navigation'

/**
 * One document in its canonical markdown form, paired with everything needed
 * to announce it.
 *
 * The `markdown` field carries exactly the text the HTML page is rendered
 * from, after the same badge stripping and link rewriting the page applies, so
 * the two representations cannot describe different documents.
 */
export interface DocumentSource extends DocumentDescriptor {
  /** The document body, as the page renders it */
  markdown: string
  /** One line describing the document, for the `llms.txt` entry */
  summary: string
}

/**
 * Route prefix under which every library and submodule document lives.
 */
const LIBRARIES_PREFIX = '/docs/libraries/'

/**
 * Build one document source.
 *
 * @param route - Site-relative page route without a trailing slash
 * @param kind - What kind of document it is
 * @param title - The document's title
 * @param subjectName - Package name for packages and submodules, title otherwise
 * @param summary - One-line description for `llms.txt`
 * @param markdown - The document body
 * @returns The assembled source
 */
function source(route: string, kind: DocumentKind, title: string, subjectName: string, summary: string, markdown: string): DocumentSource {
  return { route, kind, title, subject: documentSubject(kind, subjectName), summary, markdown }
}

/** Where a submodule page's README is looked up from. */
interface SubmoduleCoordinates {
  /** Library slug as the page passes it, spanning two segments for utility packages */
  librarySlug: string
  /** Subpath of the secondary entry point beneath that library */
  submodulePath: string
}

/**
 * Split a submodule route into the coordinates its page passes to the loader.
 *
 * Utility packages are namespaced a level deeper than the rest, so their
 * library slug spans two segments (`utils/ui`) while every other library owns
 * one (`features`).
 *
 * @param route - Submodule route, e.g. `/docs/libraries/utils/ui/color`
 * @returns The library slug and the submodule subpath beneath it
 */
function splitSubmoduleRoute(route: string): SubmoduleCoordinates {
  const segments = route.slice(LIBRARIES_PREFIX.length).split('/')
  const depth = segments[0] === 'utils' ? 2 : 1
  return { librarySlug: segments.slice(0, depth).join('/'), submodulePath: segments.slice(depth).join('/') }
}

/**
 * Collect every library README and architecture document.
 *
 * @returns One source per document the manifest reports content for
 */
function collectLibraryDocuments(): DocumentSource[] {
  const documents: DocumentSource[] = []

  for (const library of getManifest()?.libraries ?? []) {
    const route = libraryRoute(library.slug, library.category)
    // why: utility pages address their content by the short slug their route carries, and the link rewriter has to resolve relative links the same way the page does
    const pageSlug = library.category === 'utils' ? library.slug.replace('-utils', '') : library.slug

    const readme = getLibraryReadme(library.slug)
    if (readme) {
      documents.push(
        source(
          route,
          'package',
          library.name,
          library.packageName,
          library.description || `Documentation for ${library.packageName}.`,
          transformLinks(removeBadges(readme), { librarySlug: pageSlug })
        )
      )
    }

    const architecture = getLibraryArchitecture(library.slug)
    if (architecture) {
      documents.push(
        source(
          `${route}/architecture`,
          'architecture',
          `${library.name} architecture`,
          library.packageName,
          `How ${library.packageName} is put together, and why.`,
          architecture
        )
      )
    }
  }

  return documents
}

/**
 * Walk the sidebar tree and collect every submodule page that has a README.
 *
 * The navigation is already the workspace's list of published entrypoints, and
 * a lint rule holds it against the packages, so reading it here means a new
 * entrypoint gets a machine-readable counterpart the moment it gets a page.
 *
 * @param items - Navigation items to walk
 * @param packageName - npm package of the nearest ancestor package node
 * @param documents - Accumulator
 */
function collectSubmoduleDocuments(items: NavItem[], packageName: string | undefined, documents: DocumentSource[]): void {
  for (const item of items) {
    const ownPackage = item.packageName ?? packageName
    const route = item.href

    // why: a package's own page and its architecture document are collected from the manifest, which knows their titles; everything else beneath a package is a secondary entrypoint
    if (route && ownPackage && !item.packageName && route.startsWith(LIBRARIES_PREFIX) && item.slug !== 'architecture') {
      const { librarySlug, submodulePath } = splitSubmoduleRoute(route)
      const readme = getSubmoduleReadme(librarySlug, submodulePath)
      if (readme) {
        const importPath = `${ownPackage}/${submodulePath}`
        documents.push(
          source(
            route,
            'submodule',
            importPath,
            importPath,
            `The ${submodulePath} entry point of ${ownPackage}.`,
            transformLinks(removeBadges(readme), { librarySlug, submodulePath })
          )
        )
      }
    }

    if (item.children) {
      collectSubmoduleDocuments(item.children, ownPackage, documents)
    }
  }
}

/**
 * Collect every compiled guide.
 *
 * @returns One source per guide in the corpus
 */
function collectGuideDocuments(): DocumentSource[] {
  const documents: DocumentSource[] = []

  for (const entry of getGuideIndex()) {
    const guide = getGuide(entry.slug)
    if (guide) {
      documents.push(source(entry.route, 'guide', entry.title, entry.title, entry.problem, guide.content))
    }
  }

  return documents
}

/**
 * Collect every published article.
 *
 * @returns One source per article, newest first
 */
function collectArticleDocuments(): DocumentSource[] {
  return getAllArticles().map((article) =>
    source(`/articles/${article.slug}`, 'article', article.title, article.title, article.description, article.content)
  )
}

/** One workspace-root document the site republishes under its own route. */
interface RootDocument {
  /** Site-relative route it is published at */
  route: string
  /** Document title */
  title: string
  /** One line describing it, for the `llms.txt` entry */
  summary: string
  /** Loads the document, applying the site's link rewriting */
  load: () => string | null
}

/**
 * The workspace-root documents the site republishes, each with the route it is
 * published at and the loader that applies the site's link rewriting.
 *
 * `/docs/contributing` is deliberately absent. The workspace has a
 * CONTRIBUTING.md, but that page is written directly in TSX and says something
 * shorter than the file does. Publishing the file as that page's
 * machine-readable counterpart would hand a reader a different document from
 * the one they were looking at.
 */
const ROOT_DOCUMENTS: RootDocument[] = [
  {
    route: '/architecture',
    title: 'Architecture',
    summary: 'How the HyperFrontend libraries compose into one system.',
    load: getRootArchitecture,
  },
  {
    route: '/docs/manifesto',
    title: 'Manifesto',
    summary: 'Why HyperFrontend exists, where it is going, and what it will not build.',
    load: getManifesto,
  },
  {
    route: '/docs/acknowledgments',
    title: 'Acknowledgments',
    summary: 'The people and projects HyperFrontend is built on.',
    load: getAcknowledgments,
  },
  {
    route: '/docs/regarding-ai',
    title: 'Regarding AI',
    summary: "HyperFrontend's position on AI-assisted development.",
    load: getRegardingAi,
  },
]

/**
 * Collect the workspace-root documents the site republishes.
 *
 * @returns One source per root document present in the workspace
 */
function collectRootDocuments(): DocumentSource[] {
  const documents: DocumentSource[] = []

  for (const { route, title, summary, load } of ROOT_DOCUMENTS) {
    const markdown = load()
    if (markdown) {
      documents.push(source(route, 'page', title, title, summary, markdown))
    }
  }

  return documents
}

/**
 * Every document the site publishes in both HTML and markdown.
 *
 * The list is derived entirely from content that already exists: the docs
 * manifest, the sidebar tree, the compiled guide corpus, the article
 * directory, and the workspace-root documents. Nothing here is a second list
 * to maintain, so a document cannot be published as a page without also being
 * addressable as markdown.
 *
 * Pages authored directly in TSX are deliberately absent. They have no
 * markdown source, and reconstructing one from the rendered output would
 * invent a second version of the same page that nobody edits.
 *
 * @returns Every markdown-backed document, route-sorted
 */
export function collectDocuments(): DocumentSource[] {
  const documents = [...collectLibraryDocuments(), ...collectGuideDocuments(), ...collectArticleDocuments(), ...collectRootDocuments()]

  collectSubmoduleDocuments(docsNavigation, undefined, documents)

  return documents.sort((a, b) => a.route.localeCompare(b.route))
}
