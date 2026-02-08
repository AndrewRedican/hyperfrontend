// Factory and types
export { createProcessManager } from './factory'
export type { ProcessManager, ChannelHandle } from './factory'

// Individual process functions (for direct use if needed)
export { createProcess } from './create'
export { getChannel } from './get'
export { removeProcess } from './remove'
export { clearProcesses } from './clear'
