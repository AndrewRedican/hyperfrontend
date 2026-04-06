/** Callback invoked when initializing state changes */
export type InitializingChangeCallback = (initializing: boolean) => void

/** Callback invoked when ready state changes */
export type ReadyChangeCallback = (ready: boolean) => void

/** Callback invoked when starting state changes */
export type StartingChangeCallback = (starting: boolean) => void

/** Callback invoked when stopping state changes */
export type StoppingChangeCallback = (stopping: boolean) => void

/** Callback invoked when active state changes */
export type ActiveChangeCallback = (active: boolean) => void

/**
 * Types from models package.
 * The following types were added due to an unknown issue
 * where the landing-page does not build async-operations because
 * it cannot find models project.
 */
export type Status = 'success' | 'fail' | 'skipped'
/** Async result of a process */
export type Result = Promise<Status>

/** Async process function that returns a status */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Process<T extends any[] = []> = (...args: T) => Result
