import type { Tree } from '@nx/devkit'
import type { DocsCategory, EcosystemTierId } from './lib/library-facts'
import type { CompatibilityProfile, MakePublishableGeneratorSchema } from './schema'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { formatFiles, generateFiles, names, offsetFromRoot, readProjectConfiguration, updateJson, joinPathFragments } from '@nx/devkit'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '../../lib/logger'
import { derivePackageName } from '../../lib/naming-utils'
import { readPackageJsonInfo } from '../../lib/package-json-utils'
import { defaultEcosystemTier } from './lib/library-facts'
import { DEFAULT_NODE_ENGINE, DEFAULT_NPM_ENGINE, compactVersion, nodeFloorOf } from './lib/node-floor'
import { collectLibraryFacts, registerLibrary } from './registrations'

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
  /** Section of the docs-site index, when chosen rather than derived */
  docsCategory?: DocsCategory
  /** Level of the docs-site ecosystem hierarchy, when chosen rather than derived */
  ecosystemTier?: EcosystemTierId
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

  // why: keywords a package already chose describe it better than a template can, so they are kept unless the run names its own
  const defaultKeywords =
    pkgInfo.keywords.length > 0 ? pkgInfo.keywords : [libName, 'hyperfrontend', 'typescript', PROFILE_KEYWORDS[options.compatibility]]
  const keywords = options.keywords ?? defaultKeywords

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
    docsCategory: options.docsCategory,
    ecosystemTier: options.ecosystemTier,
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

    const metadata = (json.metadata ?? {}) as Record<string, unknown>
    // why: a re-run refreshes the environments and keeps what was added by hand beside them, such as the note
    json.metadata = {
      ...metadata,
      compatibility: { ...(metadata['compatibility'] as Record<string, unknown> | undefined), environments: options.compatibility },
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

    // why: assigning the block outright used to delete every target this generator does not write, including the test target the library template had just added; a target already configured keeps its configuration, so a re-run changes nothing
    for (const name of keys(existingTargets)) {
      targets[name] = existingTargets[name]
    }

    json.targets = targets

    return json
  })
}

/**
 * Update package.json with publishable fields.
 *
 * A package that already declares the engines it runs on keeps them: the
 * floor it states is a fact about its code, and the README badge is rendered
 * from whatever floor this writes. Peer and optional dependencies are the
 * package's own business and are not touched.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 * @returns The lowest Node.js version the package now declares, `18.0.0`
 */
function updatePackageJson(tree: Tree, options: NormalizedOptions): string {
  const packageJsonPath = joinPathFragments(options.projectRoot, 'package.json')
  let nodeEngine = DEFAULT_NODE_ENGINE

  updateJson(tree, packageJsonPath, (json) => {
    delete json.private

    json.license = json.license || 'MIT'
    json.sideEffects = false
    const engines = (json.engines ?? {}) as Record<string, string>
    nodeEngine = engines['node'] ?? DEFAULT_NODE_ENGINE
    json.engines = {
      ...engines,
      node: nodeEngine,
      npm: engines['npm'] ?? DEFAULT_NPM_ENGINE,
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

  return nodeFloorOf(nodeEngine)
}

/**
 * Writes a template directory's files, keeping every file that already exists when asked to.
 *
 * @param tree - Virtual file system tree
 * @param source - The template directory
 * @param target - The directory the files are written to
 * @param substitutions - The template's values
 * @param keepExisting - Whether a file already at its target is left as it is
 */
function writeTemplates(tree: Tree, source: string, target: string, substitutions: Record<string, unknown>, keepExisting: boolean): void {
  const kept = createMap<string, Buffer>()
  if (keepExisting) {
    for (const entry of readdirSync(source, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const relative = join(entry.parentPath, entry.name)
        .slice(source.length + 1)
        .replace(/\.template$/, '')
      const path = joinPathFragments(target, relative)
      const content = tree.read(path)
      if (content !== null) kept.set(path, content)
    }
  }
  generateFiles(tree, source, target, substitutions)
  for (const [path, content] of kept) tree.write(path, content)
}

/**
 * Create E2E project for the publishable library.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 * @param keepExisting - Whether files the project already has are kept
 */
function createE2EProject(tree: Tree, options: NormalizedOptions, keepExisting: boolean): void {
  if (options.skipE2E) return

  const e2eTemplateOptions = {
    ...options,
    template: '',
    e2eOffsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
  }

  const existingSpecs = BROWSER_BUNDLE_FORMATS.filter((format) =>
    tree.exists(joinPathFragments(options.e2eProjectRoot, 'src', `${format}.spec.ts`))
  )
  writeTemplates(tree, join(__dirname, 'files-e2e'), options.e2eProjectRoot, e2eTemplateOptions, keepExisting)

  if (options.compatibility.browser !== 'none') return

  // why: the templates cover a package that ships browser bundles, and a package that reaches no browser has none for these checks to load
  for (const format of BROWSER_BUNDLE_FORMATS) {
    if (keepExisting && existingSpecs.includes(format)) continue
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
 * @param nodeFloor - The lowest Node.js version the package declares, `18.0.0`
 * @param keepExisting - Whether a README the project already has is kept
 */
function generatePublishableReadme(tree: Tree, options: NormalizedOptions, nodeFloor: string, keepExisting: boolean): void {
  const templateOptions = {
    ...options,
    compatibilityGlyphs: {
      node: SUPPORT_GLYPHS[options.compatibility.node],
      browser: SUPPORT_GLYPHS[options.compatibility.browser],
      webWorker: SUPPORT_GLYPHS[options.compatibility.webWorker],
    },
    nodeFloorEncoded: encodeURIComponent(`>=${nodeFloor}`),
    nodeFloorLabel: compactVersion(nodeFloor),
    template: '',
  }

  writeTemplates(tree, join(__dirname, 'files'), options.projectRoot, templateOptions, keepExisting)
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
 * Register the library everywhere the workspace lists its packages: the CI
 * workflows, the root README's packages table and the docs site.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function registerAcrossWorkspace(tree: Tree, options: NormalizedOptions): void {
  const facts = collectLibraryFacts(tree, {
    projectName: options.projectName,
    projectRoot: options.projectRoot,
    packageName: options.packageName,
    docsCategory: options.docsCategory,
  })
  registerLibrary(tree, facts, {
    skipCI: options.skipCI,
    ecosystemTier: options.ecosystemTier ?? defaultEcosystemTier(facts.docsCategory),
  })
}

/**
 * Log instruction to record the visuals the distribution readme embeds.
 *
 * The banner replaces the readme's title and the runtime strip replaces its
 * compatibility table when the package is built, and both are read from the
 * committed media tree, so neither can be written by a generator; lint
 * reports the readme until they are recorded.
 *
 * @param options - Normalized options
 */
function recordReadmeMedia(options: NormalizedOptions): void {
  logger.info(
    `Note: Record the package banner and runtime strip: npx nx media tool-media --scene=banner-${options.libName} --scene=runtimes-${options.libName}`
  )
}

/**
 * Nx generator that converts an internal library to a publishable library.
 *
 * This generator:
 * 1. Updates project.json with build, version, and publish targets, keeping any target it does not write
 * 2. Declares metadata.compatibility from the chosen runtime profile
 * 3. Changes scope:internal tag to scope:public
 * 4. Adds required package.json fields (exports, engines, sideEffects, keywords), keeping the engines and keywords the package already declares
 * 5. Generates publishable README with required structure, its Node.js badge reading the declared floor
 * 6. Creates E2E project in apps/package-e2e/
 * 7. Creates CI workflow status file
 * 8. Adds the path filter, matrix entry and coverage upload to the shared CI workflows
 * 9. Lists the package in the root README's packages table, in the order the docs-site index presents the packages
 * 10. Registers the package with the docs site: generator, content model, navigation, ecosystem hierarchy and page routes
 * 11. Names the one step left for a human: recording the readme media
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
 *
 * @example Placed on a chosen level of the docs-site hierarchy and section of its index
 * ```bash
 * nx generate @hyperfrontend/package:make-publishable lib-my-utils --compatibility=node-only --ecosystemTier=tooling --docsCategory=core
 * ```
 */
export async function makePublishableGenerator(tree: Tree, options: MakePublishableGeneratorSchema): Promise<void> {
  const normalizedOptions = normalizeOptions(tree, options)
  // why: on a project that already publishes, a re-run must change nothing, so the README and the e2e files it once scaffolded, by now written by hand, are kept
  const republishing = readProjectConfiguration(tree, options.project).targets?.['publish'] !== undefined

  updateProjectJson(tree, normalizedOptions)

  const nodeFloor = updatePackageJson(tree, normalizedOptions)

  generatePublishableReadme(tree, normalizedOptions, nodeFloor, republishing)

  createE2EProject(tree, normalizedOptions, republishing)

  createCIWorkflow(tree, normalizedOptions)

  registerAcrossWorkspace(tree, normalizedOptions)

  logger.info('')
  logger.info('=== Manual Steps Required ===')
  recordReadmeMedia(normalizedOptions)
  logger.info('')

  if (!normalizedOptions.skipFormat) {
    await formatFiles(tree)
  }
}

export default makePublishableGenerator
