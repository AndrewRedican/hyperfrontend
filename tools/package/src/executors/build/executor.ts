/**
 * Build executor for hyperfrontend library packages.
 *
 * WHAT THIS EXECUTOR DOES:
 * ------------------------
 * 1. Auto-detects library entry points (./browser, ./node, ./feature, etc.)
 * 2. Builds each entry point to ESM + CJS formats using Rollup
 * 3. Generates TypeScript declaration files (.d.ts)
 * 4. Creates a package.json with proper "exports" field for each entry
 * 5. Copies assets (README, LICENSE, etc.) to the dist folder
 *
 * WHY A CUSTOM EXECUTOR:
 * ----------------------
 * Nx's built-in `\@nx/js:tsc` executor doesn't support:
 * - Multiple entry points with subpath exports
 * - Dual ESM/CJS output from a single build
 * - Auto-detection of library structure
 *
 * This executor handles all hyperfrontend library patterns:
 * - Simple: Single entry at src/index.ts
 * - Platform: browser/ and node/ entries
 * - Feature: Multiple domain-specific entries
 * - Complex: Nested combinations of the above
 */
import { type ExecutorContext, joinPathFragments, logger } from '@nx/devkit'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildExecutorOptions } from './lib/types'
import { resolveOutputPath, resolveTsConfigPath } from './lib/paths'
import { discoverEntryPoints } from './lib/detect'
import { copyAssets, copyDefaultAssets } from './lib/assets'
import { buildUnifiedLibrary } from './lib/build-unified'

/**
 * Reads dependencies from package.json and returns all packages that should be external.
 *
 * WHY ALL DEPENDENCIES ARE EXTERNAL:
 * ----------------------------------
 * This is a library build, not an application build. The key difference:
 *
 * Application build: Bundle everything into a self-contained deployable.
 * Library build: Produce code that consumers will bundle themselves.
 *
 * If we bundled dependencies into library output:
 * - lodash used by our lib + lodash used by consumer = 2 copies of lodash
 * - Version mismatches cause subtle bugs (different lodash instances)
 * - Tree-shaking becomes impossible for the bundled portions
 * - Bundle sizes explode across the ecosystem
 *
 * By marking all deps as external, our output contains:
 *   import { debounce } from 'lodash'
 *
 * The consumer's bundler resolves this from their node_modules,
 * deduplicating and tree-shaking as appropriate.
 *
 * We include both dependencies and peerDependencies:
 * - dependencies: Required packages we use directly
 * - peerDependencies: Packages consumer must provide (e.g., React)
 *
 * @param projectRoot - Absolute path to the project root
 * @returns List of all dependencies to mark as external
 */
function getExternalDependencies(projectRoot: string): string[] {
  const pkgPath = join(projectRoot, 'package.json')
  if (!existsSync(pkgPath)) {
    return []
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  }
  return Object.keys(allDeps)
}

/**
 * Main executor function.
 *
 * @param options - Build executor options
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function runExecutor(
  options: BuildExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRoot } = context

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRoot = join(workspaceRoot, projectConfig.root)
  const projectRelativePath = projectConfig.root

  // Resolve options with defaults using joinPathFragments for config paths
  const outputPath = resolveOutputPath(
    options.outputPath ?? joinPathFragments('dist', projectRelativePath),
    projectRelativePath,
    workspaceRoot
  )
  const tsConfigPath = resolveTsConfigPath(
    options.tsConfig ?? joinPathFragments(projectRelativePath, 'tsconfig.lib.json'),
    projectRelativePath,
    workspaceRoot
  )
  const assets = options.assets ?? []

  // All dependencies from package.json should be external for library builds
  const packageDeps = getExternalDependencies(projectRoot)
  const external = [...(options.external ?? []), ...packageDeps]

  logger.info(`Building ${projectName}...`)
  logger.info(`  Project root: ${projectRoot}`)
  logger.info(`  Output path: ${outputPath}`)
  logger.info(`  TS config: ${tsConfigPath}`)
  if (packageDeps.length > 0) {
    logger.info(`  External deps: ${packageDeps.join(', ')}`)
  }

  // Discover entry points
  const discovery = discoverEntryPoints(projectRoot)
  logger.info(`  Entry point category: ${discovery.category}`)
  logger.info(`  Entry points: ${discovery.entryPoints.map((e) => e.exportPath).join(', ')}`)

  // Ensure output directory exists and is clean
  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true })
  }
  mkdirSync(outputPath, { recursive: true })

  try {
    // Build using unified approach
    await buildUnifiedLibrary(
      projectRoot,
      outputPath,
      tsConfigPath,
      external,
      workspaceRoot,
      discovery
    )

    // Copy default assets
    copyDefaultAssets(projectRoot, outputPath, workspaceRoot)

    // Copy additional assets
    if (assets.length > 0) {
      await copyAssets(assets, projectRoot, outputPath, workspaceRoot)
    }

    logger.info(`Successfully built ${projectName}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to build ${projectName}`)
    logger.error(error instanceof Error ? error.message : String(error))
    return { success: false }
  }
}
