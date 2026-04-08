import type { IMessage } from '../../types/message'
import type { MessageHandler } from './create'

/**
 * Type for a filter function that transforms handlers
 */
export type MessageFilter<T extends IMessage = IMessage> = (handler: MessageHandler<T>) => MessageHandler<T>

/**
 * Composes multiple message filters into a single filter.
 * Filters are applied right-to-left during execution (rightmost filter executes first).
 *
 * @param filters - Variable number of filter functions to compose
 * @returns A single composed filter
 *
 * @example
 * ```typescript
 * const combinedFilter = compose(
 *   byType('notification'),
 *   create((msg) => msg.priority === 'high')
 * )
 * const handler = combinedFilter((msg) => console.log(msg))
 * ```
 */
export function compose<T extends IMessage = IMessage>(...filters: MessageFilter<T>[]): MessageFilter<T> {
  return (handler: MessageHandler<T>): MessageHandler<T> => {
    return filters.reduce((wrappedHandler, filter) => filter(wrappedHandler), handler)
  }
}
