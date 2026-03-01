import type { BrokerSettings } from './types'

/**
 * Default broker settings
 * Used when settings are partially provided
 */
export const defaultBrokerSettings: Partial<BrokerSettings> = {
  whitelist: [],
  blacklist: [],
  contractExtension: false,
  logLevel: 'error',
}
