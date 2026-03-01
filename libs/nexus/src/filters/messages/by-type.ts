import type { IMessage } from '../../types/message'
import type { MessageHandler } from './create'
import { create } from './create'

/**
 * Creates a filter that only passes messages of a specific type
 *
 * @param messageType - The message type to filter for
 * @returns A higher-order function that wraps a handler
 */
export function byType<T extends IMessage = IMessage>(messageType: string): (handler: MessageHandler<T>) => MessageHandler<T> {
  return create<T>((message) => message.type === messageType)
}
