import type { ChannelHandle } from './factory'

/**
 * Clears all processes from the registry
 *
 * @param processes - Map storing process to channel mappings
 * @returns Function that clears all processes
 *
 * @example Clearing all processes
 * ```typescript
 * const clear = clearProcesses(processMap)
 * clear() // All processes removed
 * ```
 */
export const clearProcesses = (processes: Map<string, ChannelHandle>) => (): void => {
  processes.clear()
}
