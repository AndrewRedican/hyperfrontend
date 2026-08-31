import { relative, join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getDependencies, readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { findFiles } from '@hyperfrontend/project-scope/project/traversal'
import { getLogger } from './logger'
import { replaceDependencyVersion } from './replace-dependency-version'

/**
 * Helper to convert absolute path to relative path for cleaner logging
 *
 * @param absolutePath - The absolute file path to convert
 * @param workspaceRoot - The workspace root directory to make the path relative to
 * @returns The relative path, or '.' if the path equals the workspace root
 */
const toRelative = (absolutePath: string, workspaceRoot: string): string => relative(workspaceRoot, absolutePath) || '.'

/**
 * Updates dependency version references in workspace packages.
 *
 * @param packageName - The npm package name that was updated
 * @param newVersion - The new version to set
 * @param workspaceRoot - The workspace root directory
 * @param currentPackageJsonPath - Path to skip (the versioned package)
 * @param dryRun - If true, don't actually write
 * @returns Array of updated paths (relative)
 */
export function updateDependentVersions(
  packageName: string,
  newVersion: string,
  workspaceRoot: string,
  currentPackageJsonPath: string,
  dryRun: boolean
): string[] {
  const logger = getLogger().channel('updateDependentVersions')
  const rel = (p: string) => toRelative(p, workspaceRoot)
  try {
    logger.step(`updating "${packageName}" to version "${newVersion}" (dryRun: ${dryRun})`)
    const updatedFiles: string[] = []

    const searchDirs = ['libs', 'plugins', 'tools'].map((dir) => join(workspaceRoot, dir))
    logger.step(`searching for package.json files in "${searchDirs.map(rel).join('", "')}"`)

    const packageJsonFiles = searchDirs.flatMap((dir) =>
      findFiles(dir, '**/package.json', {
        ignorePatterns: ['node_modules', 'dist', '**/__fixtures__/**'],
        absolutePaths: true,
      })
    )
    logger.step(`found ${packageJsonFiles.length} package.json files to check`)
    logger.step('checking files')

    for (const packageJsonPath of packageJsonFiles) {
      if (packageJsonPath === currentPackageJsonPath) {
        logger.item(`skipping current package "${rel(packageJsonPath)}"`)
        continue
      }

      const pkg = readPackageJsonIfExists(packageJsonPath)
      if (!pkg) {
        logger.item(`could not read "${rel(packageJsonPath)}", skipping`)
        continue
      }

      logger.item(`"${rel(packageJsonPath)}"`)
      const relativePath = relative(workspaceRoot, packageJsonPath)

      const sections = getDependencies(pkg)
      const staleSections = entries(sections).filter(([, deps]) => {
        const declared = deps[packageName]
        return declared !== undefined && declared !== newVersion
      })

      for (const [section, deps] of staleSections) {
        logger.item(`  updating ${section} "${packageName}" from "${deps[packageName]}" to "${newVersion}"`)
      }

      if (staleSections.length > 0) {
        if (!dryRun) {
          replaceDependencyVersion(packageJsonPath, packageName, newVersion)
          logger.item(`  updated "${relativePath}"`)
        } else {
          logger.item(`  dry run - would update "${relativePath}"`)
        }
        updatedFiles.push(relativePath)
      }
    }

    logger.info(`updated ${updatedFiles.length} dependent package(s) for "${packageName}"${dryRun ? ' (dry run)' : ''}`)
    return updatedFiles
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}
