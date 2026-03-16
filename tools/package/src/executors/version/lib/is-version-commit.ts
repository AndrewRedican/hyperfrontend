import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { COMMIT_TYPES } from '@hyperfrontend/versioning/commits/models'
import { extractScope, extractType } from '@hyperfrontend/versioning/git/models'
import { getCommit } from '@hyperfrontend/versioning/git/operations'
import { isValidPackageName } from './is-valid-package-name'
import { getLogger } from './logger'

/**
 * Checks if the last commit is a version/release commit for a specific project.
 *
 * Uses lib-versioning's getCommit for safe, structured commit retrieval.
 *
 * @param cwd - Working directory
 * @param projectName - The Nx project name to check for
 * @returns True if current HEAD is a version commit for this specific project
 */
export function isVersionCommit(cwd: string, projectName: string): boolean {
  const logger = getLogger().channel('isVersionCommit')
  try {
    logger.debug(`checking if HEAD commit is a version commit for project "${projectName}" in "${cwd}"`)
    const commit = getCommit('HEAD', { cwd })

    logger.debug(`checking commit details ${stringify(commit, null, 2)}`)
    if (!commit) {
      logger.info(`no commit found at HEAD in ${cwd}, returning false`)
      return false
    }

    logger.debug(`extracting type from commit subject "${commit.subject}"`)
    const type = extractType(commit.subject)
    if (type !== ('chore' satisfies keyof typeof COMMIT_TYPES)) {
      logger.info(`commit type "${type}" is not chore, returning false`)
      return false
    }

    logger.debug(`extracting scope from commit subject "${commit.subject}"`)
    const scope = extractScope(commit.subject)
    logger.info(`extracted scope "${scope}"`)

    logger.debug(`extracting description from commit subject "${commit.subject}"`)
    const descIdx = commit.subject.indexOf(': ')
    const description = descIdx !== -1 ? commit.subject.slice(descIdx + 2) : ''
    logger.info(`extracted description "${description}"`)

    logger.debug(
      `checking manual versioning pattern for project "${projectName}" - subject should start with "chore(${projectName}): release version "`
    )
    if (scope === projectName && description.startsWith('release version ')) {
      logger.info(`matched manual versioning pattern for project "${projectName}", returning true`)
      return true
    }

    logger.debug(
      `checking CI batch versioning pattern for project "${projectName}" - subject should start with "chore: update versions for " followed by package names`
    )
    if (scope === undefined && description.startsWith('update versions for ')) {
      let packagePart = description.slice('update versions for '.length)
      const skipCiSuffix = ' [skip ci]'
      if (packagePart.endsWith(skipCiSuffix)) {
        logger.debug(`detected and removing "${skipCiSuffix}" suffix from package part`)
        packagePart = packagePart.slice(0, -skipCiSuffix.length)
      }
      const packages = packagePart
        .split(',')
        .join(' ')
        .split(' ')
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length < 100 && isValidPackageName(p))
      logger.debug(`parsed package names from description: ${packages}`)
      if (packages.includes(projectName)) {
        logger.info(`matched CI batch versioning pattern for project "${projectName}", returning true`)
        return true
      }
    }

    logger.debug(
      `checking alternative release scope pattern for project "${projectName}" - subject should start with "chore(release): " followed by project name`
    )
    if (scope === 'release') {
      logger.debug(`detected "release" scope, checking if description starts with project name "${projectName}"`)
      const rest = description.trimStart()
      if (rest === projectName || rest.startsWith(projectName + ' ')) {
        logger.info(`matched alternative release scope pattern for project "${projectName}", returning true`)
        return true
      }
    }

    logger.debug(`no version commit pattern matched for ${projectName}`)
    return false
  } catch (error) {
    logger.error(`error while checking version commit - ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}
