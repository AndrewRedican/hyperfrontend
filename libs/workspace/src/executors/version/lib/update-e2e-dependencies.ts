import type { ProjectConfiguration } from '../../../runner/contract'
import { join, posix } from 'node:path'
import { getProductionDependencies, readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { getLogger } from './logger'
import { replaceTgzReference } from './replace-dependency-version'

/**
 * The stem of the tarball `npm pack` writes for a package: the scope and name joined by a dash,
 * without the `@`.
 *
 * @param packageName - The package name, scoped or not
 * @returns The stem the tarball name starts with
 *
 * @example The tarball of a scoped package
 * ```typescript
 * tarballStem('@scope/core') // 'scope-core'
 * ```
 */
export function tarballStem(packageName: string): string {
  return (packageName.startsWith('@') ? packageName.slice(1) : packageName).split('/').join('-')
}

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
 * @param value - The full dependency value (e.g., "file:../../packs/scope-core-1.0.0.tgz")
 * @param newTgzName - The new tgz filename
 * @returns The updated value with the new tgz filename
 */
function updateTgzInValue(value: string, newTgzName: string): string {
  const lastSlashIndex = value.lastIndexOf('/')
  const tgzStartIndex = lastSlashIndex >= 0 ? lastSlashIndex + 1 : value.indexOf(':') + 1
  return value.substring(0, tgzStartIndex) + newTgzName
}

/**
 * Brings the tarball pins of the projects that test a package to its new version: an e2e project
 * installs the package as `file:<path>/<stem>-<version>.tgz`, and the pin names the version.
 *
 * @param packageName - The npm package name that was updated
 * @param newVersion - The new version to set
 * @param workspaceRoot - The workspace root directory
 * @param dependents - The projects that depend on the package without importing it
 * @param dryRun - If true, don't actually write
 * @returns The manifests whose pin was brought to the new version, workspace-relative
 *
 * @example Repinning the e2e project of a package after its bump
 * ```typescript
 * updateE2eDependencies('@scope/core', '1.1.0', '/repo', [{ root: 'e2e/core' }], false)
 * // ['e2e/core/package.json']
 * ```
 */
export function updateE2eDependencies(
  packageName: string,
  newVersion: string,
  workspaceRoot: string,
  dependents: readonly ProjectConfiguration[],
  dryRun: boolean
): string[] {
  const logger = getLogger().channel('updateE2eDependencies')
  try {
    logger.step(`updating e2e dependencies for "${packageName}" to version "${newVersion}" (dryRun: ${dryRun})`)
    const updatedFiles: string[] = []

    if (dependents.length === 0) {
      logger.step(`no project depends on "${packageName}" implicitly, returning empty`)
      return updatedFiles
    }
    logger.step(`found ${dependents.length} dependent project(s) to check`)
    const tgzPrefix = `${tarballStem(packageName)}-`
    const newTgzName = `${tgzPrefix}${newVersion}.tgz`
    logger.step(`looking for tgz references with prefix "${tgzPrefix}" to replace with "${newTgzName}"`)
    logger.step('checking files')

    for (const dependent of dependents) {
      const relativePath = posix.join(dependent.root, 'package.json')
      const packageJsonPath = join(workspaceRoot, relativePath)
      const pkg = readPackageJsonIfExists(packageJsonPath)
      if (!pkg) {
        logger.item(`"${dependent.root}" carries no package.json, skipping`)
        continue
      }

      logger.item(`"${relativePath}"`)
      const currentValue = getProductionDependencies(pkg)[packageName]

      if (typeof currentValue === 'string' && isTgzDependency(currentValue, tgzPrefix)) {
        const newValue = updateTgzInValue(currentValue, newTgzName)
        if (newValue !== currentValue) {
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
    logger.error(String(error))
    return []
  }
}
