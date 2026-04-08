/* eslint-disable workspace/lib-require-jsdoc-example */
import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'

/**
 * Logs an action in a structured format.
 *
 * @param logger - Logger instance
 * @param action - Action to log
 * @param direction - Direction of action ('sent' or 'received')
 */
export function logAction(logger: Logger, action: IAction, direction: 'sent' | 'received'): void {
  logger.debug(`Action ${direction}:`, action.type, action)
}
