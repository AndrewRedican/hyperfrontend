import { error, warn, log, info, debug } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { createLogger } from '@hyperfrontend/logging'

/**
 * Recorder logger bound to the pre-captured console functions.
 *
 * Binding the safe copies rather than the live globals satisfies the
 * no-direct-console rule and keeps the recorder's output stable even when a
 * scene under test replaces `console` on the host process.
 */
export const logger = createLogger(error, warn, log, info, debug)
