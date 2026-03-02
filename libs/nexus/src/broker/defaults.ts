import type { BrokerSettings } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Default broker settings
 * Used when settings are partially provided
 */
export const defaultBrokerSettings: Partial<BrokerSettings> = freeze(<Partial<BrokerSettings>>{
  whitelist: freeze([]),
  blacklist: freeze([]),
  contractExtension: false,
  logLevel: 'error',
})
