import type { BumpType } from '../../semver/models/version'
import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { eq, gt } from '../../semver/compare'
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
 *
 * @example Running the calculate-bump step
 * ```typescript
 * import { createCalculateBumpStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createCalculateBumpStep()
 * const result = await executeStep(step, context)
 *
 * // Get the calculated bump
 * console.log(result.stateUpdates?.bumpType)
 * // => 'minor'
 * console.log(result.stateUpdates?.nextVersion)
 * // => '1.2.0'
 * ```
 */
export function createCalculateBumpStep(): FlowStep {
  return createStep(
    CALCULATE_BUMP_STEP_ID,
    'Calculate Version Bump',
    async (ctx) => {
      const { config, state, logger } = ctx
      const { commits, currentVersion, isFirstRelease } = state

      if (isFirstRelease) {
        const configuredFirst = config.firstReleaseVersion ?? '0.1.0'
        const localForFirst = parseVersion(currentVersion ?? '0.0.0')
        const configured = parseVersion(configuredFirst)

        const keepsLocal =
          localForFirst.success &&
          localForFirst.version !== undefined &&
          configured.success &&
          configured.version !== undefined &&
          gt(localForFirst.version, configured.version)

        const firstVersion = keepsLocal && currentVersion !== undefined ? currentVersion : configuredFirst

        if (keepsLocal) {
          logger.info(`First release: keeping local version ${firstVersion}, which is ahead of ${configuredFirst}`)
        } else {
          logger.info(`First release: using version ${firstVersion}`)
        }

        const isPendingPublication = currentVersion === firstVersion

        return {
          status: 'success',
          stateUpdates: {
            bumpType: 'minor' as BumpType,
            nextVersion: firstVersion,
            isPendingPublication,
          },
          message: `First release: ${firstVersion}`,
        }
      }

      if (config.releaseAs) {
        const forcedBumpType = config.releaseAs as BumpType
        const current = parseVersion(currentVersion ?? '0.0.0')
        if (!current.success || !current.version) {
          return {
            status: 'failed',
            error: createError(`Invalid current version: ${currentVersion}`),
            message: `Could not parse current version: ${currentVersion}`,
          }
        }

        const forcedFrom = state.publishedVersion ?? null

        if (forcedFrom !== null) {
          const published = parseVersion(forcedFrom)

          if (!published.success || !published.version) {
            return {
              status: 'failed',
              error: createError(`Invalid published version: ${forcedFrom}`),
              message: `Could not parse published version: ${forcedFrom}`,
            }
          }

          if (!eq(current.version, published.version)) {
            return {
              status: 'failed',
              error: createError(
                `Local version ${currentVersion} does not match published version ${forcedFrom}. ` +
                  `A forced ${forcedBumpType} bump is calculated from the published version, so it would not produce the version this working tree implies. ` +
                  `Bring the branch in step with the published release first, then run the forced bump again.`
              ),
              message: `Refused forced bump: local ${currentVersion} disagrees with published ${forcedFrom}`,
            }
          }
        }

        const bumpFrom = forcedFrom === null ? current.version : parseVersion(forcedFrom).version
        const next = increment(bumpFrom ?? current.version, forcedBumpType)
        const nextVersion = format(next)
        logger.info(`Forced ${forcedBumpType} bump via releaseAs: ${forcedFrom ?? currentVersion} → ${nextVersion}`)

        return {
          status: 'success',
          stateUpdates: {
            bumpType: forcedBumpType,
            nextVersion,
          },
          message: `${forcedBumpType} bump (forced): ${forcedFrom ?? currentVersion} → ${nextVersion}`,
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

      const hasPublishedVersion = published.success && published.version !== undefined && publishedVersion != null
      const isOutOfStep = hasPublishedVersion && published.version && !eq(current.version, published.version)
      const isPendingPublication = hasPublishedVersion && published.version && gt(current.version, published.version)

      if (isOutOfStep && published.version) {
        const next = increment(published.version, bumpType)
        const nextVersion = format(next)

        const drift = isPendingPublication ? 'Pending publication detected' : 'Local version is behind the registry'
        logger.info(`${drift}: recalculating from ${publishedVersion} → ${nextVersion}`)

        return {
          status: 'success',
          stateUpdates: {
            bumpType,
            nextVersion,
            isPendingPublication: isPendingPublication === true,
          },
          message: `${bumpType} bump (${isPendingPublication ? 'pending' : 'realigned'}): ${publishedVersion} → ${nextVersion}`,
        }
      }

      const next = increment(current.version, bumpType)
      const nextVersion = format(next)

      return {
        status: 'success',
        stateUpdates: {
          bumpType,
          nextVersion,
          isPendingPublication: false,
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
 *
 * @example Preventing duplicate releases
 * ```typescript
 * import { createCheckIdempotencyStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createCheckIdempotencyStep()
 * const result = await executeStep(step, context)
 *
 * // If version already published, step skips with bumpType: 'none'
 * if (result.status === 'skipped') {
 *   console.log('Version already published')
 * }
 * ```
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

      const { publishedVersion } = state

      if (publishedVersion != null) {
        const next = parseVersion(nextVersion)
        const published = parseVersion(publishedVersion)

        if (next.success && next.version && published.success && published.version && !gt(next.version, published.version)) {
          return {
            status: 'failed',
            error: createError(
              `Version ${nextVersion} does not advance past the published version ${publishedVersion} for ${packageName}. ` +
                `Publishing it would place a release below the current one.`
            ),
            message: `Refused release: ${nextVersion} does not advance past ${publishedVersion}`,
          }
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
