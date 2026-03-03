import { createConditionalExecutionFunction } from '@hyperfrontend/function-utils'
import { logger } from '@hyperfrontend/logging'

const isDev = () => process.env.NODE_ENV === 'development'

/**
 * Configure logger for development mode.
 * Sets log level to 'warn' in development (default is 'error').
 * Import this module once (e.g., in root layout) to apply settings globally.
 */
createConditionalExecutionFunction(() => logger.setLogLevel('warn'), isDev)()
