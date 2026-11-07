import type { ProjectConfiguration } from '../../../runner/contract'
import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getDependencies, readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { getLogger } from './logger'
import { replaceDependencyVersion } from './replace-dependency-version'

/**
 * Brings every project of the workspace that pins a package to the version it was just bumped to.
 *
 * A project with a lock file of its own installs from the registry, so it is left alone: a pin
 * on a version that is not published yet would break its install until the release lands.
 *
 * @param packageName - The npm package name that was updated
 * @param newVersion - The new version to set
 * @param workspaceRoot - The workspace root directory
 * @param projects - Every project of the workspace by name
 * @param currentProjectName - The project that was versioned, which is skipped
 * @param dryRun - If true, don't actually write
 * @returns The manifests brought to the new version, workspace-relative
 *
 * @example Pinning the dependents of a package after its bump
 * ```typescript
 * updateDependentVersions('@scope/core', '1.1.0', '/repo', context.projects, 'core', false)
 * // ['libs/consumer/package.json']
 * ```
 */
export function updateDependentVersions(
  packageName: string,
  newVersion: string,
  workspaceRoot: string,
  projects: Readonly<Record<string, ProjectConfiguration>>,
  currentProjectName: string,
  dryRun: boolean
): string[] {
  const logger = getLogger().channel('updateDependentVersions')
  try {
    logger.step(`updating "${packageName}" to version "${newVersion}" (dryRun: ${dryRun})`)
    const updatedFiles: string[] = []

    const candidates = values(projects).filter((project) => project.name !== currentProjectName)
    logger.step(`checking the manifests of ${candidates.length} project(s)`)

    for (const project of candidates) {
      const relativePath = project.root === '.' ? 'package.json' : posix.join(project.root, 'package.json')
      const packageJsonPath = join(workspaceRoot, relativePath)

      // why: a project with its own lockfile installs from the registry, so pointing it at a
      // why: version that has not been published yet breaks its install until the release lands.
      if (existsSync(join(workspaceRoot, project.root, 'package-lock.json'))) {
        logger.item(`skipping self-contained project "${project.root}"`)
        continue
      }

      const pkg = readPackageJsonIfExists(packageJsonPath)
      if (!pkg) {
        logger.item(`"${project.root}" carries no package.json, skipping`)
        continue
      }

      logger.item(`"${relativePath}"`)

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
    logger.error(String(error))
    return []
  }
}
