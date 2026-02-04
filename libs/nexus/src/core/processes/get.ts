import type { ChannelHandle } from './factory'

/**
 * Gets a channel by its process ID
 *
 * @param processes - Map storing process to channel mappings
 * @returns Function that takes processId and returns channel or undefined
 */
export const getChannel =
  (processes: Map<string, ChannelHandle>) =>
  (processId: string): ChannelHandle | undefined =>
    processes.get(processId)
