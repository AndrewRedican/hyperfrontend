import type { Tree } from '@nx/devkit'
import type { LibraryGeneratorSchema } from './schema'
import { join } from 'node:path'
import { formatFiles, generateFiles, joinPathFragments, names, offsetFromRoot } from '@nx/devkit'
import { derivePackageName, deriveProjectNameFromPath } from '../../lib/naming-utils'
import { addTsConfigPath } from '../../lib/tsconfig-utils'

/**
 * Computed options derived from user input.
 */
interface NormalizedOptions {
  /** Library name (e.g., 'my-utils') */
  name: string
  /** Project name with lib- prefix (e.g., 'lib-my-utils') */
  projectName: string
  /** npm package name (e.g., '@hyperfrontend/my-utils') */
  packageName: string
  /** Library directory (e.g., 'libs' or 'libs/utils') */
  directory: string
  /** Full project root path (e.g., 'libs/utils/my') */
  projectRoot: string
  /** Library description */
  description: string
  /** Type tag for module boundary enforcement */
  type: 'core' | 'util' | 'feature' | 'protocol'
  /** Whether the library should be publishable */
  publishable: boolean
  /** Skip formatting */
  skipFormat: boolean
  /** Offset to root (e.g., '../../' or '../../../') */
  offsetFromRoot: string
  /** Pascal case name for globalName (e.g., 'HyperfrontendMyUtils') */
  globalName: string
  /** Jest coverage path (e.g., 'libs/utils/my') */
  coveragePath: string
  /** Display name for jest (e.g., 'my-utils') */
  displayName: string
}

/**
 * Normalize user-provided options into complete configuration.
 *
 * @param options - User provided generator options
 * @returns Normalized options with computed values
 */
function normalizeOptions(options: LibraryGeneratorSchema): NormalizedOptions {
  const name = names(options.name).fileName
  const directory = options.directory ?? 'libs'

  const projectRoot = joinPathFragments(directory, name)

  const projectName = deriveProjectNameFromPath(projectRoot)
  const packageName = derivePackageName(projectName)

  const offset = offsetFromRoot(projectRoot)
  const displayName = name
  const globalName = `Hyperfrontend${names(name).className}`

  return {
    name,
    projectName,
    packageName,
    directory,
    projectRoot,
    description: options.description ?? `${names(name).className} library.`,
    type: options.type ?? 'util',
    publishable: options.publishable ?? false,
    skipFormat: options.skipFormat ?? false,
    offsetFromRoot: offset,
    globalName,
    coveragePath: projectRoot.replace(/^libs\/?/, 'libs/'),
    displayName,
  }
}

/**
 * Add TypeScript path mappings to tsconfig.base.json.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized generator options
 */
function updateTsConfigPaths(tree: Tree, options: NormalizedOptions): void {
  addTsConfigPath(tree, {
    packageName: options.packageName,
    projectRoot: options.projectRoot,
  })
}

/**
 * Generate library files from templates.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized generator options
 */
function addFiles(tree: Tree, options: NormalizedOptions): void {
  const templateOptions = {
    ...options,
    template: '',
    dot: '.',
  }

  generateFiles(tree, join(__dirname, 'files'), options.projectRoot, templateOptions)
}

/**
 * Nx generator that creates a new hyperfrontend library.
 *
 * Creates a standardized library structure with:
 * - project.json with proper Nx configuration
 * - package.json with required fields
 * - TypeScript configuration files
 * - ESLint configuration
 * - Jest configuration
 * - Source entry point with `@module` JSDoc header
 * - README.md template
 *
 * If publishable option is true, also runs the make-publishable generator
 * to add build targets, CI configuration, and E2E project.
 *
 * @param tree - The Nx virtual file system tree
 * @param options - Configuration options for the library
 * @returns A promise that resolves when the generator completes
 *
 * @example Create an internal utility library
 * ```bash
 * nx generate @hyperfrontend/package:library my-lib --type=util
 * ```
 *
 * @example Create a publishable library
 * ```bash
 * nx generate @hyperfrontend/package:library my-lib --type=util --publishable
 * ```
 *
 * @example Create a nested library under utils
 * ```bash
 * nx generate @hyperfrontend/package:library my-utils --directory=libs/utils
 * ```
 */
export async function libraryGenerator(tree: Tree, options: LibraryGeneratorSchema): Promise<void> {
  const normalizedOptions = normalizeOptions(options)

  addFiles(tree, normalizedOptions)

  updateTsConfigPaths(tree, normalizedOptions)

  if (normalizedOptions.publishable) {
    const { makePublishableGenerator } = await import('../make-publishable/generator')
    await makePublishableGenerator(tree, {
      project: normalizedOptions.projectName,
      keywords: options.keywords,
      skipFormat: true,
    })
  }

  if (!normalizedOptions.skipFormat) {
    await formatFiles(tree)
  }
}

export default libraryGenerator
