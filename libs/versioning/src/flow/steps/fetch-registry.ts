import type { FlowStep } from '../models/step'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createStep } from '../models/step'

/** Minimal package.json structure with version field. */
interface PackageJsonWithVersion {
  /** Package version string. */
  version?: string
}

export const FETCH_REGISTRY_STEP_ID = 'fetch-registry'

/**
 * Creates the fetch-registry step.
 *
 * This step:
 * 1. Queries the registry for the latest published version
 * 2. Reads the current version from package.json
 * 3. Determines if this is a first release
 *
 * State updates:
 * - publishedVersion: Latest version on registry (null if not published)
 * - currentVersion: Version from local package.json
 * - isFirstRelease: True if never published
 *
 * @returns A FlowStep that fetches registry information
 *
 * @example
 * ```typescript
 * import { createFetchRegistryStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createFetchRegistryStep()
 * const result = await executeStep(step, context)
 *
 * // Check if first release
 * if (result.stateUpdates?.isFirstRelease) {
 *   console.log('First release detected')
 * }
 * ```
 */
export function createFetchRegistryStep(): FlowStep {
  return createStep(FETCH_REGISTRY_STEP_ID, 'Fetch Registry Version', async (ctx) => {
    const { registry, tree, projectRoot, packageName, logger } = ctx

    const packageJsonPath = `${projectRoot}/package.json`
    let currentVersion = '0.0.0'

    try {
      const content = tree.read(packageJsonPath, 'utf-8')
      if (content) {
        const pkg = <PackageJsonWithVersion>parse(content)
        currentVersion = pkg.version ?? '0.0.0'
      }
    } catch (error) {
      logger.warn(`Could not read package.json: ${error}`)
    }

    let publishedVersion: string | null = null
    let publishedCommit: string | null = null
    let isFirstRelease: boolean

    try {
      publishedVersion = await registry.getLatestVersion(packageName)
      isFirstRelease = publishedVersion === null

      if (publishedVersion) {
        try {
          const versionInfo = await registry.getVersionInfo(packageName, publishedVersion)
          publishedCommit = versionInfo?.gitHead ?? null
          if (publishedCommit) {
            logger.debug(`Published ${publishedVersion} at commit ${publishedCommit.slice(0, 7)}`)
          } else {
            logger.debug(`Published ${publishedVersion} has no gitHead (older package or published without git)`)
          }
        } catch (error) {
          logger.debug(`Could not fetch version info for ${publishedVersion}: ${error}`)
        }
      }
    } catch (error) {
      logger.debug(`Registry query failed (package may not exist): ${error}`)
      isFirstRelease = true
    }

    const message = isFirstRelease
      ? `First release (local: ${currentVersion})`
      : `Published: ${publishedVersion}${publishedCommit ? ` @ ${publishedCommit.slice(0, 7)}` : ''}, Local: ${currentVersion}`

    return {
      status: 'success',
      stateUpdates: {
        publishedVersion,
        publishedCommit,
        currentVersion,
        isFirstRelease,
      },
      message,
    }
  })
}
