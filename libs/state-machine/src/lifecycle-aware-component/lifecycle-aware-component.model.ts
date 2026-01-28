export type InitializingChangeCallback = (initializing: boolean) => void

export type ReadyChangeCallback = (ready: boolean) => void

export type StartingChangeCallback = (starting: boolean) => void

export type StoppingChangeCallback = (stopping: boolean) => void

export type ActiveChangeCallback = (active: boolean) => void

/**
 * Types from models package.
 * The following types were added due to an unknown issue
 * where the landing-page does not build async-operations because
 * it cannot find models project.
 */
export type Status = 'success' | 'fail' | 'skipped'
export type Result = Promise<Status>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Process<T extends any[] = []> = (...args: T) => Result
