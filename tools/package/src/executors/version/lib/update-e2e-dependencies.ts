import { join, relative } from 'node:path'
import { getProductionDependencies, readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { findFiles } from '@hyperfrontend/project-scope/project/traversal'
import { getLogger } from './logger'
import { replaceTgzReference } from './replace-dependency-version'

/**
 * Helper to convert absolute path to relative path for cleaner logging
 *
 * @param absolutePath - The absolute file path to convert
 * @param workspaceRoot - The workspace root directory to make the path relative to
 * @returns The relative path, or '.' if the path equals the workspace root
 */
const toRelative = (absolutePath: string, workspaceRoot: string): string => relative(workspaceRoot, absolutePath) || '.'

/**
 * Checks if a dependency value is a file: reference to a tgz with the expected prefix.
 *
 * @param value - The dependency value to check
 * @param tgzPrefix - The expected tgz filename prefix
 * @returns true if the value matches the expected tgz pattern
 */
function isTgzDependency(value: string, tgzPrefix: string): boolean {
  return value.startsWith('file:') && value.includes(tgzPrefix) && value.endsWith('.tgz')
}

/**
 * Replaces a tgz filename in a file: dependency value string.
 *
 * @param value - The full dependency value (e.g., "file:../../packs/hyperfrontend-my-package-1.0.0.tgz")
 * @param tgzPrefix - The tgz filename prefix
 * @param newTgzName - The new tgz filename
 * @returns The updated value with the new tgz filename
 */
function updateTgzInValue(value: string, tgzPrefix: string, newTgzName: string): string {
  const lastSlashIndex = value.lastIndexOf('/')
  const tgzStartIndex = lastSlashIndex >= 0 ? lastSlashIndex + 1 : value.indexOf(':') + 1
  return value.substring(0, tgzStartIndex) + newTgzName
}

/**
 * Updates e2e app dependencies when library version bumps.
 *
 * @param packageName - The npm package name that was updated
 * @param newVersion - The new version to set
 * @param workspaceRoot - The workspace root directory
 * @param dryRun - If true, don't actually write
 * @returns Array of updated paths (relative)
 */
export function updateE2eDependencies(packageName: string, newVersion: string, workspaceRoot: string, dryRun: boolean): string[] {
  const logger = getLogger().channel('updateE2eDependencies')
  const rel = (p: string) => toRelative(p, workspaceRoot)
  try {
    logger.step(`updating e2e dependencies for "${packageName}" to version "${newVersion}" (dryRun: ${dryRun})`)
    const updatedFiles: string[] = []
    const e2eDir = join(workspaceRoot, 'apps', 'package-e2e')

    logger.step(`searching for package.json files in "${rel(e2eDir)}"`)
    const packageJsonFiles = findFiles(e2eDir, '**/package.json', {
      ignorePatterns: ['node_modules', 'dist'],
      absolutePaths: true,
    })
    if (packageJsonFiles.length === 0) {
      logger.step(`no package.json files found in e2e directory, returning empty`)
      return updatedFiles
    }
    logger.step(`found ${packageJsonFiles.length} package.json files to check`)
    const packageSlug = packageName.startsWith('@hyperfrontend/') ? packageName.slice('@hyperfrontend/'.length) : packageName
    const tgzPrefix = `hyperfrontend-${packageSlug}-`
    const newTgzName = `hyperfrontend-${packageSlug}-${newVersion}.tgz`
    logger.step(`looking for tgz references with prefix "${tgzPrefix}" to replace with "${newTgzName}"`)
    logger.step('checking files')

    for (const packageJsonPath of packageJsonFiles) {
      const pkg = readPackageJsonIfExists(packageJsonPath)
      if (!pkg) {
        logger.item(`could not read "${rel(packageJsonPath)}", skipping`)
        continue
      }

      logger.item(`"${rel(packageJsonPath)}"`)
      const currentValue = getProductionDependencies(pkg)[packageName]

      if (typeof currentValue === 'string' && isTgzDependency(currentValue, tgzPrefix)) {
        const newValue = updateTgzInValue(currentValue, tgzPrefix, newTgzName)
        if (newValue !== currentValue) {
          const relativePath = relative(workspaceRoot, packageJsonPath)
          logger.item(`  updating tgz reference from "${currentValue}" to "${newValue}"`)
          if (!dryRun) {
            replaceTgzReference(packageJsonPath, packageName, tgzPrefix, newTgzName)
            logger.item(`  updated "${relativePath}"`)
          } else {
            logger.item(`  dry run - would update "${relativePath}"`)
          }
          updatedFiles.push(relativePath)
        }
      }
    }

    logger.info(`updated ${updatedFiles.length} e2e package(s) for "${packageName}"${dryRun ? ' (dry run)' : ''}`)
    return updatedFiles
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}
