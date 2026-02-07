/**
 * Build executor for hyperfrontend library packages.
 *
 * Auto-detects library entry points and applies
 * the appropriate build strategy using Rollup.
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
 * Reads dependencies from package.json and returns all \@hyperfrontend/* packages.
 * These must be external to avoid TS6059 rootDir errors.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns List of internal \@hyperfrontend/* dependencies to mark as external
 */
function getInternalDependencies(projectRoot: string): string[] {
  const pkgPath = join(projectRoot, 'package.json')
  if (!existsSync(pkgPath)) {
    return []
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  }
  return Object.keys(allDeps).filter((dep) => dep.startsWith('@hyperfrontend/'))
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

  // Auto-detect internal @hyperfrontend/* dependencies and mark them as external
  // This prevents TS6059 rootDir errors when TypeScript follows tsconfig paths
  const internalDeps = getInternalDependencies(projectRoot)
  const external = [...(options.external ?? []), ...internalDeps]

  logger.info(`Building ${projectName}...`)
  logger.info(`  Project root: ${projectRoot}`)
  logger.info(`  Output path: ${outputPath}`)
  logger.info(`  TS config: ${tsConfigPath}`)
  if (internalDeps.length > 0) {
    logger.info(`  External deps: ${internalDeps.join(', ')}`)
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
