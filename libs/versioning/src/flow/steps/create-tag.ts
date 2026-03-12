import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createStep, createSkippedResult } from '../models/step'
import { interpolate } from '../utils/interpolate'

export const CREATE_TAG_STEP_ID = 'create-tag'

/**
 * Creates the create-tag step.
 *
 * This step:
 * 1. Creates an annotated git tag
 * 2. Uses the configured tag format
 *
 * State updates:
 * - tagName: Name of the created tag
 *
 * @returns A FlowStep that creates a git tag
 */
export function createTagStep(): FlowStep {
  return createStep(
    CREATE_TAG_STEP_ID,
    'Create Git Tag',
    async (ctx) => {
      const { git, config, state, projectName, packageName, logger } = ctx
      const { nextVersion, bumpType, changelogEntry } = state

      // Skip if git operations disabled
      if (config.skipGit) {
        return createSkippedResult('Git operations disabled')
      }

      // Skip if tags disabled
      if (config.skipTag) {
        return createSkippedResult('Tag creation disabled')
      }

      // Skip if no bump needed
      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump, no tag needed')
      }

      // Generate tag name
      const tagName = interpolate(config.tagFormat ?? '${projectName}@${version}', {
        projectName,
        packageName,
        version: nextVersion,
      })

      // Skip if dry run
      if (config.dryRun) {
        return {
          status: 'success',
          stateUpdates: { tagName },
          message: `[DRY RUN] Would create tag: ${tagName}`,
        }
      }

      // Create tag message from changelog entry if available
      let tagMessage = `Release ${nextVersion}`
      if (changelogEntry && changelogEntry.sections.length > 0) {
        const highlights: string[] = []
        for (const section of changelogEntry.sections.slice(0, 3)) {
          const itemCount = section.items.length
          highlights.push(`${section.type}: ${itemCount} change${itemCount !== 1 ? 's' : ''}`)
        }
        tagMessage = `Release ${nextVersion}\n\n${highlights.join('\n')}`
      }

      // Create tag
      try {
        const tag = git.createTag(tagName, {
          message: tagMessage,
        })
        logger.info(`Created tag: ${tag.name}`)

        return {
          status: 'success',
          stateUpdates: {
            tagName: tag.name,
          },
          message: `Created tag: ${tagName}`,
        }
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error : createError(String(error)),
          message: `Failed to create tag: ${tagName}`,
        }
      }
    },
    {
      dependsOn: ['create-commit'],
    }
  )
}

/**
 * Creates a step that pushes the created tag to remote.
 *
 * @returns A FlowStep that pushes the git tag
 */
export function createPushTagStep(): FlowStep {
  return createStep(
    'push-tag',
    'Push Git Tag',
    async (ctx) => {
      const { git, config, state, logger } = ctx
      const { tagName } = state

      // Skip if git operations disabled
      if (config.skipGit || config.skipTag) {
        return createSkippedResult('Git/tag operations disabled')
      }

      // Skip if no tag created
      if (!tagName) {
        return createSkippedResult('No tag to push')
      }

      // Skip if dry run
      if (config.dryRun) {
        return {
          status: 'success',
          message: `[DRY RUN] Would push tag: ${tagName}`,
        }
      }

      try {
        git.pushTag(tagName)
        logger.info(`Pushed tag: ${tagName}`)

        return {
          status: 'success',
          message: `Pushed tag: ${tagName}`,
        }
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error : createError(String(error)),
          message: `Failed to push tag: ${tagName}`,
        }
      }
    },
    {
      dependsOn: ['create-tag'],
      continueOnError: true, // Don't fail flow if push fails
    }
  )
}
