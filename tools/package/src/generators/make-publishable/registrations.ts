import type { Tree } from '../../lib/tree/tree'
import type { DocsCategory, EcosystemTierId, LibraryFacts } from './lib/library-facts'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '../../lib/logger'
import { joinPathFragments } from '../../lib/tree/paths'
import { readProjectConfiguration } from '../../lib/tree/projects'
import { readJson } from '../../lib/tree/tree'
import { registerLibraryCoverageUpload } from './lib/ci-main-workflow'
import { registerLibraryInContent } from './lib/docs-content'
import { placeLibraryInEcosystem } from './lib/docs-ecosystem'
import { registerLibraryInGenerateDocs } from './lib/docs-generate-config'
import { registerLibraryInNavigation } from './lib/docs-navigation'
import { docsPageFiles } from './lib/docs-pages'
import { deriveLibraryFacts } from './lib/library-facts'
import { registerPackageRow } from './lib/root-readme'

/** The workflow that uploads every library's coverage from main. */
export const CI_MAIN_WORKFLOW = '.github/workflows/ci-main.yml'

/** The README whose packages table lists every published package. */
export const ROOT_README = 'README.md'

/** The script that extracts each package's documentation for the site. */
export const DOCS_GENERATE_SCRIPT = 'apps/docs-site/scripts/generate-docs.ts'

/** The site's content model of the packages. */
export const DOCS_CONTENT = 'apps/docs-site/src/lib/content.ts'

/** The site's sidebar navigation. */
export const DOCS_NAVIGATION = 'apps/docs-site/src/lib/navigation.ts'

/** The editorial hierarchy the site's library index draws. */
export const DOCS_ECOSYSTEM = 'apps/docs-site/src/lib/ecosystem.ts'

/**
 * What the registrations need to know about the project beyond its files.
 */
export interface RegistrationProject {
  /** Nx project name */
  projectName: string
  /** Workspace-relative project root */
  projectRoot: string
  /** npm package name */
  packageName: string
  /** Section of the docs-site index, when chosen rather than derived */
  docsCategory?: DocsCategory
}

/**
 * How the registrations are applied.
 */
export interface RegistrationOptions {
  /** Leave the main CI workflow alone */
  skipCI: boolean
  /** The level of the ecosystem hierarchy the package is placed on */
  ecosystemTier: EcosystemTierId
}

/**
 * The slice of a package.json the registrations read.
 */
interface PackageManifest {
  /** One-line description */
  description?: string
  /** Exports map */
  exports?: Record<string, unknown>
}

/**
 * Read a text file from the tree.
 *
 * @param tree - Virtual file system tree
 * @param path - Workspace-relative path
 * @returns The file's text
 * @throws {Error} When the file is not there
 */
function readText(tree: Tree, path: string): string {
  const content = tree.read(path, 'utf-8')
  if (content === null) throw createError(`${path} is missing, so the package cannot be registered in it`)
  return content
}

/**
 * Rewrite a file through a transform, touching it only when the transform changed it.
 *
 * @param tree - Virtual file system tree
 * @param path - Workspace-relative path
 * @param transform - Produces the new text from the current one
 */
function rewrite(tree: Tree, path: string, transform: (content: string) => string): void {
  const before = readText(tree, path)
  const after = transform(before)
  if (after === before) return
  tree.write(path, after)
  logger.info(`Updated ${path}`)
}

/**
 * Gather everything the registrations are written from.
 *
 * @param tree - Virtual file system tree
 * @param project - The project being registered
 * @returns The facts every registration derives from
 */
export function collectLibraryFacts(tree: Tree, project: RegistrationProject): LibraryFacts {
  const manifest = readJson<PackageManifest>(tree, joinPathFragments(project.projectRoot, 'package.json'))
  return deriveLibraryFacts({
    projectName: project.projectName,
    projectRoot: project.projectRoot,
    packageName: project.packageName,
    description: manifest.description ?? '',
    tags: readProjectConfiguration(tree, project.projectName).tags ?? [],
    exports: manifest.exports ?? {},
    docsCategory: project.docsCategory,
    hasArchitecture: tree.exists(joinPathFragments(project.projectRoot, 'ARCHITECTURE.md')),
  })
}

/**
 * Register a publishable library everywhere the workspace lists its packages:
 * the main CI workflow's coverage uploads, the root README's packages table,
 * and the docs site's generator, content model, navigation, hierarchy and pages.
 *
 * Every registration is written only when it is missing, so running this for
 * a library the workspace already knows changes nothing.
 *
 * @param tree - Virtual file system tree
 * @param facts - What was derived from the package's project
 * @param options - How the registrations are applied
 */
export function registerLibrary(tree: Tree, facts: LibraryFacts, options: RegistrationOptions): void {
  if (!options.skipCI) {
    rewrite(tree, CI_MAIN_WORKFLOW, (content) => registerLibraryCoverageUpload(content, facts))
  }

  const placement = placeLibraryInEcosystem(readText(tree, DOCS_ECOSYSTEM), facts.packageName, options.ecosystemTier)
  rewrite(tree, DOCS_ECOSYSTEM, () => placement.content)
  rewrite(tree, ROOT_README, (content) => registerPackageRow(content, facts, placement.precededBy))
  rewrite(tree, DOCS_GENERATE_SCRIPT, (content) => registerLibraryInGenerateDocs(content, facts))
  rewrite(tree, DOCS_CONTENT, (content) => registerLibraryInContent(content, facts))
  rewrite(tree, DOCS_NAVIGATION, (content) => registerLibraryInNavigation(content, facts))

  for (const page of docsPageFiles(facts)) {
    if (tree.exists(page.path)) continue
    tree.write(page.path, page.content)
    logger.info(`Created ${page.path}`)
  }
}
