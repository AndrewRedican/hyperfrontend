/**
 * Opt-in memory monitor and the always-on `recover()` event-loop yield.
 *
 * @module @hyperfrontend/builder/memory
 */
export type { MemoryMonitor, MemorySnapshot } from './monitor'
export { createMemoryMonitor } from './monitor'
export { recover } from './recover'
