import { join, relative } from 'node:path'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { writeJsonFile } from '@hyperfrontend/project-scope/core/fs'
import { getProductionDependencies, readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { findFiles } from '@hyperfrontend/project-scope/project/traversal'
import { getLogger } from './logger'

/**
 * Helper to convert absolute path to relative path for cleaner logging
 *
 * @param absolutePath - The absolute file path to convert
 * @param workspaceRoot - The workspace root directory to make the path relative to
 * @returns The relative path, or '.' if the path equals the workspace root
 */
const toRelative = (absolutePath: string, workspaceRoot: string): string => relative(workspaceRoot, absolutePath) || '.'

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
    const packageSlug = packageName.replace(/^@hyperfrontend\//, '')
    // eslint-disable-next-line workspace/no-unsafe-regex -- packageSlug is derived from controlled package names
    const tgzPattern = createRegExp(`hyperfrontend-${packageSlug}-\\d+\\.\\d+\\.\\d+\\.tgz`)
    const newTgzName = `hyperfrontend-${packageSlug}-${newVersion}.tgz`
    logger.step(`looking for tgz references matching pattern "${tgzPattern.source}" to replace with "${newTgzName}"`)
    logger.step('checking files')

    for (const packageJsonPath of packageJsonFiles) {
      const pkg = readPackageJsonIfExists(packageJsonPath)
      if (!pkg) {
        logger.item(`could not read "${rel(packageJsonPath)}", skipping`)
        continue
      }

      logger.item(`"${rel(packageJsonPath)}"`)
      let modified = false
      const currentValue = getProductionDependencies(pkg)[packageName]

      if (typeof currentValue === 'string' && currentValue.startsWith('file:') && tgzPattern.test(currentValue)) {
        const newValue = currentValue.replace(tgzPattern, newTgzName)
        if (newValue !== currentValue) {
          logger.item(`  updating tgz reference from "${currentValue}" to "${newValue}"`)
          pkg.dependencies = { ...pkg.dependencies, [packageName]: newValue }
          modified = true
        }
      }

      if (modified) {
        const relativePath = relative(workspaceRoot, packageJsonPath)
        if (!dryRun) {
          logger.item(`  writing updated package.json to "${rel(packageJsonPath)}"`)
          writeJsonFile(packageJsonPath, pkg)
        } else {
          logger.item(`  dry run - would update "${relativePath}"`)
        }
        updatedFiles.push(relativePath)
      }
    }

    logger.info(`updated ${updatedFiles.length} e2e package(s) for "${packageName}"${dryRun ? ' (dry run)' : ''}`)
    return updatedFiles
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}
