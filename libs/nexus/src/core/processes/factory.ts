import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { clearProcesses } from './clear'
import { createProcess } from './create'
import { getChannel } from './get'
import { removeProcess } from './remove'

/**
 * Type representing a channel handle for process tracking
 * This can be any object - the manager doesn't need to know its structure
 */
export type ChannelHandle = object

/**
 * Creates a process manager for tracking process IDs to channel mappings
 *
 * @returns Object with process management methods
 *
 * @example
 * ```typescript
 * const processManager = createProcessManager()
 * const processId = processManager.create(channel)
 * const found = processManager.get(processId)
 * processManager.remove(processId)
 * ```
 */
export const createProcessManager = () => {
  const processes = createMap<string, ChannelHandle>()

  return freeze({
    create: createProcess(processes),
    get: getChannel(processes),
    remove: removeProcess(processes),
    clear: clearProcesses(processes),

    /**
     * Track an existing process ID with a channel.
     * Useful when receiving a process ID from the remote side that needs to be associated
     * with a local channel instance.
     *
     * @param processId - The process ID to track
     * @param channel - The channel handle to associate with the process ID
     */
    track: (processId: string, channel: ChannelHandle): void => {
      processes.set(processId, channel)
    },

    /**
     * Check if a process ID exists in the manager.
     *
     * @param processId - The process ID to check
     * @returns True if the process ID exists, false otherwise
     */
    has: (processId: string): boolean => {
      return processes.has(processId)
    },
  })
}

/**
 * Type of the process manager returned by createProcessManager
 */
export type ProcessManager = ReturnType<typeof createProcessManager>
