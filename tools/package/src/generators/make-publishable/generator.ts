import type { Tree } from '@nx/devkit'
import type { CompatibilityProfile, MakePublishableGeneratorSchema } from './schema'
import { join } from 'node:path'
import { formatFiles, generateFiles, names, offsetFromRoot, readProjectConfiguration, updateJson, joinPathFragments } from '@nx/devkit'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '../../lib/logger'
import { derivePackageName } from '../../lib/naming-utils'
import { readPackageJsonInfo } from '../../lib/package-json-utils'

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
 * The bundle formats only a browser or a CDN consumer loads. The name is both
 * the build option key and the stem of the E2E spec that loads it.
 */
const BROWSER_BUNDLE_FORMATS = ['iife', 'umd'] as const

/**
 * How each support level is written in the generated README.
 *
 * The README's compatibility table and the project's own metadata are two
 * statements of one fact, and a package whose readme claims browser support it
 * did not declare is the drift this generator exists to prevent. So the table
 * is rendered from the profile rather than shipped as fixed text.
 */
const SUPPORT_GLYPHS: Record<SupportLevel, string> = {
  full: '\u2705',
  none: '\u274c',
}

/**
 * Normalized options for make-publishable generator.
 */
interface NormalizedOptions {
  /** Project name (e.g., 'lib-my-utils') */
  projectName: string
  /** Project root path (e.g., 'libs/utils/my') */
  projectRoot: string
  /** npm package name (e.g., '@hyperfrontend/my-utils') */
  packageName: string
  /** URL-encoded package name for badge URLs */
  packageNameEncoded: string
  /** Global name for IIFE/UMD builds */
  globalName: string
  /** npm keywords */
  keywords: string[]
  /** Runtimes to declare under metadata.compatibility */
  compatibility: CompatibilityEnvironments
  /** Library name without prefix */
  libName: string
  /** Library description */
  description: string
  /** IIFE/UMD bundle entry point */
  bundleEntry: string
  /** E2E project name */
  e2eProjectName: string
  /** E2E project root */
  e2eProjectRoot: string
  /** Skip E2E creation */
  skipE2E: boolean
  /** Skip CI updates */
  skipCI: boolean
  /** Skip formatting */
  skipFormat: boolean
  /** Offset from project root to workspace root */
  offsetFromRoot: string
}

/**
 * Normalize user-provided options.
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

  const projectConfig = readProjectConfiguration(tree, options.project)
  const projectRoot = projectConfig.root
  const projectName = options.project

  const fallbackPackageName = derivePackageName(projectName)
  const pkgInfo = readPackageJsonInfo(tree, projectRoot)
  const packageName = pkgInfo.name || fallbackPackageName
  const description = pkgInfo.description

  const libName = packageName.replace('@hyperfrontend/', '')

  const globalName = options.globalName || `Hyperfrontend${names(libName).className}`

  const defaultKeywords = [libName, 'hyperfrontend', 'typescript', 'isomorphic']
  const keywords = options.keywords || defaultKeywords

  const bundleEntry = options.bundleEntry || '.'

  const e2eProjectName = `e2e-${projectName}`
  const e2eProjectRoot = `apps/package-e2e/${libName}`

  return {
    projectName,
    projectRoot,
    packageName,
    packageNameEncoded: encodeURIComponent(packageName),
    globalName,
    keywords,
    compatibility: COMPATIBILITY_PROFILES[options.compatibility],
    libName,
    description,
    bundleEntry,
    e2eProjectName,
    e2eProjectRoot,
    skipE2E: options.skipE2E ?? false,
    skipCI: options.skipCI ?? false,
    skipFormat: options.skipFormat ?? false,
    offsetFromRoot: offsetFromRoot(projectRoot),
  }
}

/**
 * Update project.json to declare runtime compatibility, add publishable
 * targets, and change the scope tag.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updateProjectJson(tree: Tree, options: NormalizedOptions): void {
  const projectJsonPath = joinPathFragments(options.projectRoot, 'project.json')

  updateJson(tree, projectJsonPath, (json) => {
    const tags = (json.tags || []) as string[]
    const newTags = tags.filter((tag: string) => !tag.startsWith('scope:')).concat('scope:public')
    json.tags = newTags

    const existingTargets = (json.targets ?? {}) as Record<string, unknown>

    // why: metadata sits between tags and targets in every hand-written publishable project.json, and a new key only lands there if targets is removed and re-added after it
    delete json.targets

    json.metadata = {
      ...(json.metadata as Record<string, unknown> | undefined),
      compatibility: { environments: options.compatibility },
    }

    const buildOptions: Record<string, unknown> = {
      esm: { bundleWorkspaceDeps: true },
      cjs: { bundleWorkspaceDeps: true },
    }

    // why: an iife or umd bundle is only ever loaded by a browser or a CDN consumer, so a package that reaches no browser ships neither
    if (options.compatibility.browser !== 'none') {
      for (const format of BROWSER_BUNDLE_FORMATS) {
        buildOptions[format] = {
          entry: options.bundleEntry,
          globalName: options.globalName,
        }
      }
    }

    const targets: Record<string, unknown> = {
      version: {},
      'version-check': {},
      build: {
        executor: '@hyperfrontend/package:build',
        options: buildOptions,
      },
      publish: {},
      typecheck: {},
    }

    // why: assigning the block outright used to delete every target this generator does not write, including the test target the library template had just added
    for (const name of keys(existingTargets)) {
      if (!(name in targets)) {
        targets[name] = existingTargets[name]
      }
    }

    json.targets = targets

    return json
  })
}

/**
 * Update package.json with publishable fields.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updatePackageJson(tree: Tree, options: NormalizedOptions): void {
  const packageJsonPath = joinPathFragments(options.projectRoot, 'package.json')

  updateJson(tree, packageJsonPath, (json) => {
    delete json.private

    json.license = json.license || 'MIT'
    json.sideEffects = false
    json.engines = {
      node: '>=18.0.0',
      npm: '>=8.0.0',
    }

    if (!json.exports) {
      json.exports = {
        '.': './src/index.js',
        './package.json': './package.json',
      }
    } else {
      json.exports['./package.json'] = './package.json'
    }

    json.keywords = options.keywords

    json.funding = {
      type: 'github',
      url: 'https://github.com/sponsors/AndrewRedican',
    }

    return json
  })
}

/**
 * Create E2E project for the publishable library.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function createE2EProject(tree: Tree, options: NormalizedOptions): void {
  if (options.skipE2E) return

  const e2eTemplateOptions = {
    ...options,
    template: '',
    e2eOffsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
  }

  generateFiles(tree, join(__dirname, 'files-e2e'), options.e2eProjectRoot, e2eTemplateOptions)

  if (options.compatibility.browser !== 'none') return

  // why: the templates cover a package that ships browser bundles, and a package that reaches no browser has none for these checks to load
  for (const format of BROWSER_BUNDLE_FORMATS) {
    tree.delete(joinPathFragments(options.e2eProjectRoot, 'src', `${format}.spec.ts`))
  }

  updateJson(tree, joinPathFragments(options.e2eProjectRoot, 'project.json'), (json) => {
    json.targets.e2e.options.formats = ['cjs', 'esm']
    return json
  })
}

/**
 * Generate the publishable README with required structure.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function generatePublishableReadme(tree: Tree, options: NormalizedOptions): void {
  const templateOptions = {
    ...options,
    compatibilityGlyphs: {
      node: SUPPORT_GLYPHS[options.compatibility.node],
      browser: SUPPORT_GLYPHS[options.compatibility.browser],
      webWorker: SUPPORT_GLYPHS[options.compatibility.webWorker],
    },
    template: '',
  }

  generateFiles(tree, join(__dirname, 'files'), options.projectRoot, templateOptions)
}

/**
 * Create CI workflow status file for the library.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function createCIWorkflow(tree: Tree, options: NormalizedOptions): void {
  if (options.skipCI) return

  const workflowPath = `.github/workflows/ci-${options.projectName}.yml`

  const workflowContent = `name: ${options.projectName}

on:
  workflow_run:
    workflows: [libraries]
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
 * Log instruction to add library to root README.md.
 *
 * @param options - Normalized options
 */
function updateRootReadme(options: NormalizedOptions): void {
  logger.info(`Note: Please manually add ${options.packageName} to the root README.md packages table.`)
}

/**
 * Log instructions to update CI libraries workflow with path filter and matrix entry.
 *
 * @param options - Normalized options
 */
function updateCILibrariesWorkflow(options: NormalizedOptions): void {
  if (options.skipCI) return

  logger.info(`Note: Please manually update .github/workflows/ci-libraries.yml to add:`)
  logger.info(`  - Path filter for: ${options.libName}`)
  logger.info(`  - Matrix entry for: ${options.projectName}`)
}

/**
 * Log instruction to add library to docs-site LIBRARIES array.
 *
 * @param options - Normalized options
 */
function updateDocsSiteConfig(options: NormalizedOptions): void {
  logger.info(`Note: Please add ${options.packageName} to apps/docs-site/scripts/generate-docs.ts LIBRARIES array.`)
}

/**
 * Nx generator that converts an internal library to a publishable library.
 *
 * This generator:
 * 1. Updates project.json with build, version, and publish targets, keeping any target it does not write
 * 2. Declares metadata.compatibility from the chosen runtime profile
 * 3. Changes scope:internal tag to scope:public
 * 4. Adds required package.json fields (exports, engines, sideEffects, keywords)
 * 5. Generates publishable README with required structure
 * 6. Creates E2E project in apps/package-e2e/
 * 7. Creates CI workflow status file
 * 8. Provides instructions for additional manual steps
 *
 * @param tree - The Nx virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 * @throws {Error} When no runtime compatibility profile was given.
 *
 * @example Make a library publishable
 * ```bash
 * nx generate @hyperfrontend/package:make-publishable lib-my-utils --compatibility=isomorphic
 * ```
 *
 * @example With custom global name and bundle entry
 * ```bash
 * nx generate @hyperfrontend/package:make-publishable lib-my-utils --compatibility=browser-only --globalName=MyUtils --bundleEntry=./browser
 * ```
 */
export async function makePublishableGenerator(tree: Tree, options: MakePublishableGeneratorSchema): Promise<void> {
  const normalizedOptions = normalizeOptions(tree, options)

  updateProjectJson(tree, normalizedOptions)

  updatePackageJson(tree, normalizedOptions)

  generatePublishableReadme(tree, normalizedOptions)

  createE2EProject(tree, normalizedOptions)

  createCIWorkflow(tree, normalizedOptions)

  logger.info('')
  logger.info('=== Manual Steps Required ===')
  updateRootReadme(normalizedOptions)
  updateCILibrariesWorkflow(normalizedOptions)
  updateDocsSiteConfig(normalizedOptions)
  logger.info('')

  if (!normalizedOptions.skipFormat) {
    await formatFiles(tree)
  }
}

export default makePublishableGenerator
