import type { ConventionalCommit } from '../../commits/models/conventional'
import type { FlowStep } from '../models/step'
import { parseConventionalCommit } from '../../commits/parse/message'
import { createStep } from '../models/step'

export const ANALYZE_COMMITS_STEP_ID = 'analyze-commits'

/**
 * Creates the analyze-commits step.
 *
 * This step:
 * 1. Finds the last release tag for this package
 * 2. Gets all commits since that tag (or all commits if first release)
 * 3. Parses each commit using conventional commit format
 * 4. Filters to only release-worthy commits
 *
 * State updates:
 * - lastReleaseTag: Tag name of last release (null if first release)
 * - commits: Array of parsed conventional commits
 *
 * @returns A FlowStep that analyzes commits
 */
export function createAnalyzeCommitsStep(): FlowStep {
  return createStep(
    ANALYZE_COMMITS_STEP_ID,
    'Analyze Commits',
    async (ctx) => {
      const { git, projectName, packageName, config, logger, state } = ctx

      // Find the last release tag for this package
      let lastReleaseTag: string | null = null

      if (!state.isFirstRelease) {
        // Try to find a tag matching the package name pattern
        const tags = git.getTagsForPackage(packageName)
        if (tags.length > 0) {
          // Tags are returned in reverse chronological order
          lastReleaseTag = tags[0].name
          logger.debug(`Found last release tag: ${lastReleaseTag}`)
        } else {
          // Try with project name format
          const projectTags = git.getTagsForPackage(projectName)
          if (projectTags.length > 0) {
            lastReleaseTag = projectTags[0].name
            logger.debug(`Found last release tag (project format): ${lastReleaseTag}`)
          }
        }
      }

      // Get commits
      let rawCommits: readonly { message: string; hash: string }[]

      if (lastReleaseTag) {
        rawCommits = git.getCommitsSince(lastReleaseTag)
        logger.debug(`Found ${rawCommits.length} commits since ${lastReleaseTag}`)
      } else {
        // First release - get all commits (limit to recent for performance)
        rawCommits = git.getCommitLog({ maxCount: 100 })
        logger.debug(`First release - analyzing up to ${rawCommits.length} commits`)
      }

      // Parse commits using conventional commit format
      const commits: ConventionalCommit[] = []
      const releaseTypes = config.releaseTypes ?? ['feat', 'fix', 'perf', 'revert']

      for (const rawCommit of rawCommits) {
        const parsed = parseConventionalCommit(rawCommit.message)
        if (parsed.type && releaseTypes.includes(parsed.type)) {
          commits.push(parsed)
        }
      }

      const message =
        commits.length > 0
          ? `Found ${commits.length} releasable commits (${rawCommits.length} total)`
          : `No releasable commits found (${rawCommits.length} total)`

      return {
        status: 'success',
        stateUpdates: {
          lastReleaseTag,
          commits,
        },
        message,
      }
    },
    {
      dependsOn: ['fetch-registry'],
    }
  )
}
