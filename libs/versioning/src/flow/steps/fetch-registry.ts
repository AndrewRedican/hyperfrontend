import type { FlowStep } from '../models/step'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createStep } from '../models/step'

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
 */
export function createFetchRegistryStep(): FlowStep {
  return createStep(FETCH_REGISTRY_STEP_ID, 'Fetch Registry Version', async (ctx) => {
    const { registry, tree, projectRoot, packageName, logger } = ctx

    // Read local package.json for current version
    const packageJsonPath = `${projectRoot}/package.json`
    let currentVersion = '0.0.0'

    try {
      const content = tree.read(packageJsonPath, 'utf-8')
      if (content) {
        const pkg = <{ version?: string }>parse(content)
        currentVersion = pkg.version ?? '0.0.0'
      }
    } catch (error) {
      logger.warn(`Could not read package.json: ${error}`)
    }

    // Query registry for published version
    let publishedVersion: string | null = null
    let isFirstRelease = true

    try {
      publishedVersion = await registry.getLatestVersion(packageName)
      isFirstRelease = publishedVersion === null
    } catch (error) {
      // Package might not exist yet, which is fine
      logger.debug(`Registry query failed (package may not exist): ${error}`)
      isFirstRelease = true
    }

    const message = isFirstRelease ? `First release (local: ${currentVersion})` : `Published: ${publishedVersion}, Local: ${currentVersion}`

    return {
      status: 'success',
      stateUpdates: {
        publishedVersion,
        currentVersion,
        isFirstRelease,
      },
      message,
    }
  })
}
