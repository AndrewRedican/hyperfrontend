import type { ChannelHandle } from './factory'

/**
 * Removes a process ID from the registry
 *
 * @param processes - Map storing process to channel mappings
 * @returns Function that takes processId and removes it
 *
 * @example
 * ```typescript
 * const remove = removeProcess(processMap)
 * remove('some-process-id')
 * ```
 */
export const removeProcess =
  (processes: Map<string, ChannelHandle>) =>
  (processId: string): void => {
    processes.delete(processId)
  }
