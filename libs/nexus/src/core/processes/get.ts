import type { ChannelHandle } from './factory'

/**
 * Gets a channel by its process ID
 *
 * @param processes - Map storing process to channel mappings
 * @returns Function that takes processId and returns channel or undefined
 *
 * @example Looking up channel by process ID
 * ```typescript
 * const processes = new Map([['proc-1', channelHandle]])
 * const findChannel = getChannel(processes)
 * const channel = findChannel('proc-1')
 * // => channelHandle or undefined
 * ```
 */
export const getChannel =
  (processes: Map<string, ChannelHandle>) =>
  (processId: string): ChannelHandle | undefined =>
    processes.get(processId)
