/**
 * Build executor for hyperfrontend library packages.
 *
 * Auto-detects library type (standard vs isomorphic) and applies
 * the appropriate build strategy using Rollup.
 */
import { type ExecutorContext, joinPathFragments, logger } from '@nx/devkit'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildExecutorOptions } from './lib/types'
import { resolveOutputPath, resolveTsConfigPath } from './lib/paths'
import { detectLibraryType } from './lib/detect'
import { copyAssets, copyDefaultAssets } from './lib/assets'
import { buildStandardLibrary } from './lib/build-standard'
import { buildIsomorphicLibrary } from './lib/build-isomorphic'

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
  const external = options.external ?? []

  logger.info(`Building ${projectName}...`)
  logger.info(`  Project root: ${projectRoot}`)
  logger.info(`  Output path: ${outputPath}`)
  logger.info(`  TS config: ${tsConfigPath}`)

  // Detect library type
  const libraryType = detectLibraryType(projectRoot)
  logger.info(`  Library type: ${libraryType}`)

  // Ensure output directory exists and is clean
  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true })
  }
  mkdirSync(outputPath, { recursive: true })

  try {
    // Build based on library type
    if (libraryType === 'isomorphic') {
      await buildIsomorphicLibrary(projectRoot, outputPath, tsConfigPath, external, workspaceRoot)
    } else {
      await buildStandardLibrary(projectRoot, outputPath, tsConfigPath, external)
    }

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
