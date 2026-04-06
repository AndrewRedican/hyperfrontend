import type { BumpType } from '../../semver/models/version'
import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { gt } from '../../semver/compare'
import { format } from '../../semver/format/to-string'
import { increment } from '../../semver/increment/bump'
import { parseVersion } from '../../semver/parse/version'
import { createStep, createSkippedResult } from '../models/step'

/** Minimal commit data for bump calculation. */
interface CommitForBump {
  /** Commit type (e.g., 'feat', 'fix'). */
  type?: string
  /** Whether this is a breaking change. */
  breaking: boolean
}

export const CALCULATE_BUMP_STEP_ID = 'calculate-bump'

/**
 * Determines the highest bump type from analyzed commits.
 *
 * Priority: major > minor > patch > none
 * Breaking changes always result in major (post-1.0.0) or minor (pre-1.0.0).
 *
 * @param commits - Parsed conventional commits
 * @param minorTypes - Types that trigger minor bumps
 * @param patchTypes - Types that trigger patch bumps
 * @param currentVersion - Current version string (for pre-1.0.0 handling)
 * @returns The highest bump type needed
 */
function calculateBumpFromCommits(
  commits: readonly CommitForBump[],
  minorTypes: readonly string[],
  patchTypes: readonly string[],
  currentVersion: string
): BumpType {
  if (commits.length === 0) {
    return 'none'
  }

  const hasBreaking = commits.some((c) => c.breaking)
  if (hasBreaking) {
    const parsed = parseVersion(currentVersion)
    if (parsed.success && parsed.version && parsed.version.major === 0) {
      return 'minor'
    }
    return 'major'
  }

  const hasMinor = commits.some((c) => c.type && minorTypes.includes(c.type))
  if (hasMinor) {
    return 'minor'
  }

  const hasPatch = commits.some((c) => c.type && patchTypes.includes(c.type))
  if (hasPatch) {
    return 'patch'
  }

  return 'none'
}

/**
 * Creates the calculate-bump step.
 *
 * This step:
 * 1. Analyzes commit types and breaking changes
 * 2. Determines the appropriate bump level
 * 3. Calculates the next version
 *
 * State updates:
 * - bumpType: 'major' | 'minor' | 'patch' | 'none'
 * - nextVersion: Calculated next version string
 *
 * @returns A FlowStep that calculates version bump
 */
export function createCalculateBumpStep(): FlowStep {
  return createStep(
    CALCULATE_BUMP_STEP_ID,
    'Calculate Version Bump',
    async (ctx) => {
      const { config, state, logger } = ctx
      const { commits, currentVersion, isFirstRelease } = state

      if (isFirstRelease) {
        const firstVersion = config.firstReleaseVersion ?? '0.1.0'
        logger.info(`First release: using version ${firstVersion}`)

        return {
          status: 'success',
          stateUpdates: {
            bumpType: <BumpType>'minor',
            nextVersion: firstVersion,
          },
          message: `First release: ${firstVersion}`,
        }
      }

      if (config.releaseAs) {
        const forcedBumpType = <BumpType>config.releaseAs
        const current = parseVersion(currentVersion ?? '0.0.0')
        if (!current.success || !current.version) {
          return {
            status: 'failed',
            error: createError(`Invalid current version: ${currentVersion}`),
            message: `Could not parse current version: ${currentVersion}`,
          }
        }

        const next = increment(current.version, forcedBumpType)
        const nextVersion = format(next)
        logger.info(`Forced ${forcedBumpType} bump via releaseAs: ${currentVersion} → ${nextVersion}`)

        return {
          status: 'success',
          stateUpdates: {
            bumpType: forcedBumpType,
            nextVersion,
          },
          message: `${forcedBumpType} bump (forced): ${currentVersion} → ${nextVersion}`,
        }
      }

      if (!commits || commits.length === 0) {
        return createSkippedResult('No releasable commits found')
      }

      const minorTypes = config.minorTypes ?? ['feat']
      const patchTypes = config.patchTypes ?? ['fix', 'perf', 'revert']

      const bumpType = calculateBumpFromCommits(commits, minorTypes, patchTypes, currentVersion ?? '0.0.0')

      if (bumpType === 'none') {
        return {
          status: 'success',
          stateUpdates: {
            bumpType: 'none',
            nextVersion: undefined,
          },
          message: 'No version bump needed',
        }
      }

      const current = parseVersion(currentVersion ?? '0.0.0')
      if (!current.success || !current.version) {
        return {
          status: 'failed',
          error: createError(`Invalid current version: ${currentVersion}`),
          message: `Could not parse current version: ${currentVersion}`,
        }
      }

      const { publishedVersion } = state
      const published = parseVersion(publishedVersion ?? '0.0.0')

      const isPendingPublication =
        published.success && published.version && publishedVersion != null && gt(current.version, published.version)

      if (isPendingPublication && published.version) {
        const next = increment(published.version, bumpType)
        const nextVersion = format(next)

        logger.info(`Pending publication detected: recalculating from ${publishedVersion} → ${nextVersion}`)

        return {
          status: 'success',
          stateUpdates: {
            bumpType,
            nextVersion,
            isPendingPublication: true,
          },
          message: `${bumpType} bump (pending): ${publishedVersion} → ${nextVersion}`,
        }
      }

      const next = increment(current.version, bumpType)
      const nextVersion = format(next)

      return {
        status: 'success',
        stateUpdates: {
          bumpType,
          nextVersion,
        },
        message: `${bumpType} bump: ${currentVersion} → ${nextVersion}`,
      }
    },
    {
      dependsOn: ['analyze-commits'],
    }
  )
}

/**
 * Creates a step that checks for idempotency.
 *
 * This step prevents redundant releases by checking if the
 * calculated version is already published.
 *
 * @returns A FlowStep that checks idempotency
 */
export function createCheckIdempotencyStep(): FlowStep {
  return createStep(
    'check-idempotency',
    'Check Idempotency',
    async (ctx) => {
      const { registry, packageName, state } = ctx
      const { nextVersion, bumpType } = state

      if (!nextVersion || bumpType === 'none') {
        return {
          status: 'success',
          message: 'No version to check (no bump needed)',
        }
      }

      const isPublished = await registry.isVersionPublished(packageName, nextVersion)

      if (isPublished) {
        return {
          status: 'skipped',
          stateUpdates: {
            bumpType: 'none',
            nextVersion: undefined,
          },
          message: `Version ${nextVersion} is already published`,
        }
      }

      return {
        status: 'success',
        message: `Version ${nextVersion} is not yet published`,
      }
    },
    {
      dependsOn: ['calculate-bump'],
    }
  )
}
