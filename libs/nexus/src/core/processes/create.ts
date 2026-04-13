import type { ChannelHandle } from './factory'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Creates a process ID and registers the channel
 *
 * @param processes - Map storing process to channel mappings
 * @returns Function that takes a channel and returns new process ID
 *
 * @example Registering a channel process
 * ```typescript
 * const create = createProcess(processMap)
 * const processId = create(myChannel)
 * ```
 */
export const createProcess =
  (processes: Map<string, ChannelHandle>) =>
  (channel: ChannelHandle): string => {
    const processId = uuidV4()
    processes.set(processId, channel)
    return processId
  }
