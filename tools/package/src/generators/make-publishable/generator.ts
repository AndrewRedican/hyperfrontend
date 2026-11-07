/**
 * This repository's `make-publishable` generator: the packaged one with this repository's build
 * executor and e2e directory, then the compatibility block, the README with its badges, the CI
 * workflow, and the registrations across the repository.
 *
 * @module generators/make-publishable/generator
 */

import type { Tree } from '@hyperfrontend/workspace/runner'
import type { DocsCategory, EcosystemTierId } from './lib/library-facts'
import type { CompatibilityProfile, MakePublishableGeneratorSchema } from './schema'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import {
  compactVersion,
  formatFiles,
  generateFiles,
  joinPathFragments,
  nodeFloorOf,
  readJson,
  readPackageJsonInfo,
  readProjectConfiguration,
  unscopedName,
  updateJson,
} from '@hyperfrontend/workspace/generators'
import { makePublishableGenerator as publish, planPublishable } from '@hyperfrontend/workspace/generators/make-publishable'
import { E2E_DIRECTORY } from '../../lib/e2e-helpers'
import { logger } from '../../lib/logger'
import { defaultEcosystemTier } from './lib/library-facts'
import { collectLibraryFacts, registerLibrary } from './registrations'

/** The generator's templates, relative to the workspace root. */
const TEMPLATES = 'tools/package/src/generators/make-publishable/files'

/** The build executor of this repository: the packaged build, then the registry README. */
const BUILD_EXECUTOR = '@hyperfrontend/package:build'

/**
 * The level a package's support for one runtime is declared at. Profiles only
 * ever claim the two levels that need no explanation; `partial` is written by
 * hand, next to the note that says what is missing.
 */
type SupportLevel = 'full' | 'none'

/**
 * The runtimes a compatibility block reports on, in the order the docs site
 * draws them.
 */
interface CompatibilityEnvironments {
  /** Support when the package is loaded by Node.js */
  node: SupportLevel
  /** Support when the package is loaded by a browser main thread */
  browser: SupportLevel
  /** Support when the package is loaded inside a Web Worker */
  webWorker: SupportLevel
}

/**
 * The runtimes each named profile declares.
 *
 * A Web Worker is a browser runtime, so no profile claims worker support
 * without browser support: the two move together.
 */
const COMPATIBILITY_PROFILES: Record<CompatibilityProfile, CompatibilityEnvironments> = {
  isomorphic: { node: 'full', browser: 'full', webWorker: 'full' },
  'node-only': { node: 'full', browser: 'none', webWorker: 'none' },
  'browser-only': { node: 'none', browser: 'full', webWorker: 'full' },
}

/**
 * The npm keyword each runtime profile adds to a package that chose no
 * keywords of its own, naming where it runs the way npm searches do.
 */
const PROFILE_KEYWORDS: Record<CompatibilityProfile, string> = {
  isomorphic: 'isomorphic',
  'node-only': 'nodejs',
  'browser-only': 'browser',
}

/**
 * How each support level is written in the generated README.
 *
 * The README's compatibility table and the project's own metadata are two
 * statements of one fact, and a package whose readme claims browser support it
 * did not declare is the drift this generator exists to prevent. So the table
 * is rendered from the profile rather than shipped as fixed text.
 */
const SUPPORT_GLYPHS: Record<SupportLevel, string> = {
  full: '✅',
  none: '❌',
}

/** The parts of a project.json this generator rewrites. */
interface PublishableProjectJson {
  /** The module-boundary tags */
  tags?: string[]
  /** The targets, by name */
  targets?: Record<string, unknown>
  /** Free-form metadata, the compatibility block among it */
  metadata?: Record<string, unknown>
}

/** The parts of an e2e project.json this generator rewrites. */
interface E2eProjectJson extends PublishableProjectJson {
  /** The library the suite tests */
  implicitDependencies?: string[]
}

/** The parts of a package.json this generator reads back. */
interface PublishedPackageJson {
  /** The runtimes the package declares */
  engines?: Record<string, string>
}

/** The options settled for this repository. */
interface NormalizedOptions {
  /** Project name (e.g., 'lib-my-utils') */
  projectName: string
  /** Project root path (e.g., 'libs/utils/my') */
  projectRoot: string
  /** npm package name (e.g., '@hyperfrontend/my-utils') */
  packageName: string
  /** URL-encoded package name for badge URLs */
  packageNameEncoded: string
  /** Library name without prefix */
  libName: string
  /** Library description */
  description: string
  /** The chosen profile */
  profile: CompatibilityProfile
  /** Runtimes to declare under metadata.compatibility */
  compatibility: CompatibilityEnvironments
  /** npm keywords */
  keywords: string[]
  /** E2E project root */
  e2eProjectRoot: string
  /** Whether the project already publishes, so the README and the e2e files it has are kept */
  republishing: boolean
  /** Section of the docs-site index, when chosen rather than derived */
  docsCategory?: DocsCategory
  /** Level of the docs-site ecosystem hierarchy, when chosen rather than derived */
  ecosystemTier?: EcosystemTierId
}

/**
 * Settles the options: the profile, the package and the keywords it gets.
 *
 * @param tree - Virtual file system tree
 * @param options - User provided options
 * @returns Normalized options
 * @throws {Error} When no runtime compatibility profile was given, because a published
 * package that says nothing about where it runs fails the docs build.
 */
function normalizeOptions(tree: Tree, options: MakePublishableGeneratorSchema): NormalizedOptions {
  if (!options.compatibility) {
    throw createError(
      `A publishable package must declare where it runs. Re-run with --compatibility=<profile>, where profile is one of: ${keys(COMPATIBILITY_PROFILES).join(', ')}.`
    )
  }
  const project = readProjectConfiguration(tree, options.project)
  const pkgInfo = readPackageJsonInfo(tree, project.root)
  const packageName = pkgInfo.name ?? planPublishable(tree, { project: options.project }).packageName
  const libName = unscopedName(packageName)
  // why: keywords a package already chose describe it better than a template can, so they are kept unless the run names its own
  const defaultKeywords =
    pkgInfo.keywords.length > 0 ? pkgInfo.keywords : [libName, 'hyperfrontend', 'typescript', PROFILE_KEYWORDS[options.compatibility]]
  return {
    projectName: options.project,
    projectRoot: project.root,
    packageName,
    packageNameEncoded: encodeURIComponent(packageName),
    libName,
    description: pkgInfo.description,
    profile: options.compatibility,
    compatibility: COMPATIBILITY_PROFILES[options.compatibility],
    keywords: options.keywords ?? defaultKeywords,
    e2eProjectRoot: joinPathFragments(E2E_DIRECTORY, libName),
    republishing: project.targets?.['publish'] !== undefined,
    docsCategory: options.docsCategory,
    ecosystemTier: options.ecosystemTier,
  }
}

/**
 * Declares the runtime compatibility and the public scope in project.json.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updateProjectJson(tree: Tree, options: NormalizedOptions): void {
  updateJson<PublishableProjectJson>(tree, joinPathFragments(options.projectRoot, 'project.json'), (json) => {
    json.tags = (json.tags ?? []).filter((tag) => !tag.startsWith('scope:')).concat('scope:public')
    const targets = json.targets
    // why: metadata sits between tags and targets in every hand-written publishable project.json, and a new key only lands there if targets is removed and re-added after it
    delete json.targets
    const metadata = json.metadata ?? {}
    const compatibility = { ...(metadata['compatibility'] as Record<string, unknown> | undefined) }
    // why: a re-run refreshes the environments and keeps what was added by hand beside them, such as the note; a library runs on all three pipeline legs, so a new one declares all three operating systems
    const operatingSystems = compatibility['operatingSystems'] ?? { linux: 'full', macos: 'full', windows: 'full' }
    json.metadata = { ...metadata, compatibility: { ...compatibility, environments: options.compatibility, operatingSystems } }
    json.targets = targets
    return json
  })
}

/**
 * Gives the e2e project this repository's tags and its `audit` target.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updateE2eProjectJson(tree: Tree, options: NormalizedOptions): void {
  const projectJsonPath = joinPathFragments(options.e2eProjectRoot, 'project.json')
  if (!tree.exists(projectJsonPath)) return
  updateJson<E2eProjectJson>(tree, projectJsonPath, (json) => {
    // why: tags sit before targets and implicitDependencies last in every hand-written e2e project.json
    const { targets, implicitDependencies, ...rest } = json
    return {
      ...rest,
      tags: json.tags ?? ['type:e2e', 'scope:internal'],
      targets: { ...targets, audit: targets?.['audit'] ?? {} },
      implicitDependencies,
    }
  })
}

/**
 * Generate the publishable README with required structure, its Node.js badge reading the floor
 * the package declares.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function generatePublishableReadme(tree: Tree, options: NormalizedOptions): void {
  const engines = readJson<PublishedPackageJson>(tree, joinPathFragments(options.projectRoot, 'package.json')).engines ?? {}
  const nodeFloor = nodeFloorOf(engines['node'] ?? '')
  const templateOptions = {
    ...options,
    compatibilityGlyphs: {
      node: SUPPORT_GLYPHS[options.compatibility.node],
      browser: SUPPORT_GLYPHS[options.compatibility.browser],
      webWorker: SUPPORT_GLYPHS[options.compatibility.webWorker],
    },
    nodeFloorEncoded: encodeURIComponent(`>=${nodeFloor}`),
    nodeFloorLabel: compactVersion(nodeFloor),
  }
  generateFiles(tree, join(tree.root, TEMPLATES), options.projectRoot, templateOptions, { keepExisting: options.republishing })
}

/**
 * Create CI workflow status file for the library.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function createCIWorkflow(tree: Tree, options: NormalizedOptions): void {
  const workflowPath = `.github/workflows/ci-${options.projectName}.yml`

  const workflowContent = `name: ${options.projectName}

on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]

permissions:
  actions: read

jobs:
  status:
    uses: ./.github/workflows/_lib-status.yml
    with:
      project-name: ${options.projectName}
      library-path: ${options.projectRoot}
`

  tree.write(workflowPath, workflowContent)
  logger.info(`Created CI workflow: ${workflowPath}`)
}

/**
 * Register the library everywhere the workspace lists its packages: the main
 * CI workflow, the root README's packages table and the docs site.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 * @param skipCI - Whether the main CI workflow is left alone
 */
function registerAcrossWorkspace(tree: Tree, options: NormalizedOptions, skipCI: boolean): void {
  const facts = collectLibraryFacts(tree, {
    projectName: options.projectName,
    projectRoot: options.projectRoot,
    packageName: options.packageName,
    docsCategory: options.docsCategory,
  })
  registerLibrary(tree, facts, {
    skipCI,
    ecosystemTier: options.ecosystemTier ?? defaultEcosystemTier(facts.docsCategory),
  })
}

/**
 * Generator that converts an internal library to a publishable library of this repository.
 *
 * This generator:
 * 1. Runs the packaged `make-publishable`: the targets with this repository's build executor, the browser bundles of a profile that reaches a browser, the manifest fields, and the e2e project under `apps/package-e2e`
 * 2. Declares metadata.compatibility from the chosen runtime profile
 * 3. Changes scope:internal tag to scope:public
 * 4. Gives the e2e project its tags and its audit target
 * 5. Generates the publishable README with required structure, its Node.js badge reading the declared floor
 * 6. Creates the CI workflow status file
 * 7. Adds the coverage upload to the main CI workflow
 * 8. Lists the package in the root README's packages table, in the order the docs-site index presents the packages
 * 9. Registers the package with the docs site: generator, content model, navigation, ecosystem hierarchy and page routes
 * 10. Names the one step left for a human: recording the readme media
 *
 * @param tree - The virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 * @throws {Error} When no runtime compatibility profile was given.
 *
 * @example Make a library publishable
 * ```bash
 * npx hf generate make-publishable lib-my-utils --compatibility=isomorphic
 * ```
 *
 * @example With custom global name and bundle entry
 * ```bash
 * npx hf generate make-publishable lib-my-utils --compatibility=browser-only --globalName=MyUtils --bundleEntry=./browser
 * ```
 *
 * @example Placed on a chosen level of the docs-site hierarchy and section of its index
 * ```bash
 * npx hf generate make-publishable lib-my-utils --compatibility=node-only --ecosystemTier=tooling --docsCategory=core
 * ```
 */
export async function makePublishableGenerator(tree: Tree, options: MakePublishableGeneratorSchema): Promise<void> {
  const normalized = normalizeOptions(tree, options)
  await publish(tree, {
    project: options.project,
    // why: an iife or umd bundle is only ever loaded by a browser or a CDN consumer, so a package that reaches no browser ships neither
    formats: normalized.compatibility.browser === 'none' ? ['esm', 'cjs'] : ['esm', 'cjs', 'iife', 'umd'],
    globalName: options.globalName,
    bundleEntry: options.bundleEntry,
    keywords: normalized.keywords,
    buildExecutor: BUILD_EXECUTOR,
    e2eDirectory: E2E_DIRECTORY,
    skipE2E: options.skipE2E,
    skipFormat: true,
  })
  updateProjectJson(tree, normalized)
  if (options.skipE2E !== true) updateE2eProjectJson(tree, normalized)
  generatePublishableReadme(tree, normalized)
  if (options.skipCI !== true) createCIWorkflow(tree, normalized)
  registerAcrossWorkspace(tree, normalized, options.skipCI === true)
  logger.info('')
  logger.info('=== Manual Steps Required ===')
  // why: the banner and the runtime strip the distribution readme embeds are read from the committed media tree, so no generator can write them; lint reports the readme until they are recorded
  logger.info(
    `Note: Record the package banner and runtime strip: npx hf run tool-media:media --scene=banner-${normalized.libName} --scene=runtimes-${normalized.libName}`
  )
  logger.info('')
  if (!options.skipFormat) await formatFiles(tree)
}

export default makePublishableGenerator
