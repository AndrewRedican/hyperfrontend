import type { Tree } from '@nx/devkit'
import type { MakePublishableGeneratorSchema } from './schema'
import { join } from 'node:path'
import { formatFiles, generateFiles, names, offsetFromRoot, readProjectConfiguration, updateJson, joinPathFragments } from '@nx/devkit'
import { logger } from '../../lib/logger'
import { derivePackageName } from '../../lib/naming-utils'
import { readPackageJsonInfo } from '../../lib/package-json-utils'

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
 */
function normalizeOptions(tree: Tree, options: MakePublishableGeneratorSchema): NormalizedOptions {
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
 * Update project.json to add publishable targets and change scope tag.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updateProjectJson(tree: Tree, options: NormalizedOptions): void {
  const projectJsonPath = joinPathFragments(options.projectRoot, 'project.json')

  updateJson(tree, projectJsonPath, (json) => {
    const tags = <string[]>(json.tags || [])
    const newTags = tags.filter((tag: string) => !tag.startsWith('scope:')).concat('scope:public')
    json.tags = newTags

    json.targets = {
      version: {},
      'version-check': {},
      build: {
        executor: '@hyperfrontend/package:build',
        options: {
          esm: { bundleWorkspaceDeps: true },
          cjs: { bundleWorkspaceDeps: true },
          iife: {
            entry: options.bundleEntry,
            globalName: options.globalName,
          },
          umd: {
            entry: options.bundleEntry,
            globalName: options.globalName,
          },
        },
      },
      publish: {},
      typecheck: {},
    }

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
 * 1. Updates project.json with build, version, and publish targets
 * 2. Changes scope:internal tag to scope:public
 * 3. Adds required package.json fields (exports, engines, sideEffects, keywords)
 * 4. Generates publishable README with required structure
 * 5. Creates E2E project in apps/package-e2e/
 * 6. Creates CI workflow status file
 * 7. Provides instructions for additional manual steps
 *
 * @param tree - The Nx virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 *
 * @example Make a library publishable
 * ```bash
 * nx generate @hyperfrontend/package:make-publishable lib-my-utils
 * ```
 *
 * @example With custom global name and bundle entry
 * ```bash
 * nx generate @hyperfrontend/package:make-publishable lib-my-utils --globalName=MyUtils --bundleEntry=./browser
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
