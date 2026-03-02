import { error, warn, log, info, debug } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { createLogger } from './create-logger'

export const logger = createLogger(error, warn, log, info, debug)
