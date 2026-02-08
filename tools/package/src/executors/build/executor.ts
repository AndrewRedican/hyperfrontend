/**
 * Build executor for hyperfrontend library packages.
 */
import { type ExecutorContext, joinPathFragments, logger } from '@nx/devkit'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildExecutorOptions } from './lib/types'
import { resolveOutputPath, resolveTsConfigPath } from './lib/paths'
import { discoverEntryPoints } from './lib/detect'
import { copyAssets, copyDefaultAssets } from './lib/assets'
import { buildUnifiedLibrary, buildBundledOutput } from './lib/build-unified'

/**
 * Reads dependencies from package.json and returns all packages that should be external.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns List of all dependencies to mark as external
 */
function getExternalDependencies(projectRoot: string): string[] {
  const pkgPath = join(projectRoot, 'package.json')
  if (!existsSync(pkgPath)) return []

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
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

  const packageDeps = getExternalDependencies(projectRoot)
  const external = [...(options.external ?? []), ...packageDeps]

  const shouldBundle = options.bundle ?? false
  const globalName = options.globalName

  if (shouldBundle && !globalName) {
    logger.error('globalName is required when bundle is true')
    return { success: false }
  }

  logger.info(`Building ${projectName}...`)
  logger.info(`  Project root: ${projectRoot}`)
  logger.info(`  Output path: ${outputPath}`)
  logger.info(`  TS config: ${tsConfigPath}`)
  if (packageDeps.length > 0) {
    logger.info(`  External deps: ${packageDeps.join(', ')}`)
  }
  if (shouldBundle) {
    logger.info(`  Bundle: enabled (global: ${globalName})`)
  }

  const discovery = discoverEntryPoints(projectRoot)
  logger.info(`  Entry point category: ${discovery.category}`)
  logger.info(`  Entry points: ${discovery.entryPoints.map((e) => e.exportPath).join(', ')}`)

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true })
  }
  mkdirSync(outputPath, { recursive: true })

  try {
    await buildUnifiedLibrary(
      projectRoot,
      outputPath,
      tsConfigPath,
      external,
      workspaceRoot,
      discovery,
      shouldBundle
    )

    if (shouldBundle && globalName) {
      await buildBundledOutput(
        projectRoot,
        outputPath,
        tsConfigPath,
        globalName,
        workspaceRoot,
        discovery
      )
    }

    copyDefaultAssets(projectRoot, outputPath, workspaceRoot)

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
