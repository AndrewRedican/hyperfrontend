import { escapePackageName } from '@hyperfrontend/versioning/registry/npm'
import { getLogger } from './logger'

/**
 * Validates package name characters using lib-versioning's escapePackageName.
 *
 * @param name - Package name to validate
 * @returns True if valid
 */
export function isValidPackageName(name: string): boolean {
  const logger = getLogger().channel('isValidPackageName')
  try {
    logger.debug(`validating "${name}"`)
    escapePackageName(name)
    logger.info(`"${name}" is a valid package name`)
    return true
  } catch {
    logger.warn(`invalid package name "${name}"`)
    return false
  }
}
