import type { IMessage } from '../../types/message'
import type { ChannelJSON } from '../../types/channel'

/**
 * Generic message handler that receives all messages
 */
export type MessageHandler<T extends IMessage = IMessage> = (message: T, channel: ChannelJSON) => void

/**
 * Predicate function to test if a message should be handled
 */
export type MessagePredicate<T extends IMessage = IMessage> = (message: T) => boolean

/**
 * Creates a message filter that only calls the handler when predicate returns true
 *
 * @param predicate - Function that tests if message should be handled
 * @returns A higher-order function that wraps a handler
 */
export function create<T extends IMessage = IMessage>(predicate: MessagePredicate<T>): (handler: MessageHandler<T>) => MessageHandler<T> {
  return (handler: MessageHandler<T>): MessageHandler<T> => {
    return (message: T, channel: ChannelJSON) => {
      if (predicate(message)) {
        handler(message, channel)
      }
    }
  }
}
