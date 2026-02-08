import { createLogger } from './create-logger'

export const logger = createLogger(console.error, console.warn, console.log, console.info, console.debug)
