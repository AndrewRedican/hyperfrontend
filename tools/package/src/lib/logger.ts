import { logger as nxLogger } from '@nx/devkit'
import { createLogger } from '@hyperfrontend/logging'

/**
 * Executor logger that wraps \@nx/devkit logger through \@hyperfrontend/logging.
 *
 * This satisfies the no-direct-console ESLint rule while maintaining
 * proper Nx executor logging integration.
 */
export const logger = createLogger(nxLogger.error, nxLogger.warn, nxLogger.log, nxLogger.info, nxLogger.debug)
