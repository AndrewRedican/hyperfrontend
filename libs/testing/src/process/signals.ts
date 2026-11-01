/** How a child process ended: its exit code, or the signal that ended it. */
export interface ChildExit {
  /** The exit code, or null when a signal ended the child. */
  readonly code: number | null
  /** The signal that ended the child, or null when it exited on its own. */
  readonly signal: NodeJS.Signals | null
}

/** The signals a test sends a child to end it, which it may handle. */
export type StopSignal = 'SIGINT' | 'SIGTERM'

/** A child a signal can be sent to: what `spawn` returns, or a stand-in for it. */
export interface SignalTarget {
  /** The exit code, or null while the child runs or once a signal ended it. */
  readonly exitCode: number | null
  /** The signal that ended the child, or null while it runs or once it exited on its own. */
  readonly signalCode: NodeJS.Signals | null
  /** Sends the child a signal. */
  kill(signal: StopSignal): boolean
  /** Runs a listener once the child ends. */
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown
}

/**
 * Sends a child a signal and resolves with how it ended. A child that has already ended resolves
 * with how it did, and nothing is sent.
 *
 * @param child - The child, as `spawn` returned it or a stand-in for it.
 * @param signal - The signal to send.
 * @returns The exit code and signal the child reports.
 *
 * @example Stopping a server the test started
 * ```typescript
 * const child = spawn(process.execPath, ['server.js'], { stdio: ['ignore', 'pipe', 'inherit'] })
 * await once(child.stdout, 'data')
 * expect(await sendSignal(child, 'SIGINT')).toEqual(cleanSignalExit('SIGINT'))
 * ```
 */
export function sendSignal(child: SignalTarget, signal: StopSignal): Promise<ChildExit> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  return new Promise((resolve) => {
    child.once('exit', (code, exitSignal) => resolve({ code, signal: exitSignal }))
    child.kill(signal)
  })
}

/**
 * What a child that handles a signal and leaves with exit code 0 reports on a platform: that exit
 * code where signals are delivered, and on Windows the signal with no exit code at all.
 *
 * @param signal - The signal sent.
 * @param platform - The platform the child runs on, this one by default.
 * @returns The exit to compare a `sendSignal` result with.
 *
 * @example The exit a clean shutdown reports on the running platform
 * ```typescript
 * cleanSignalExit('SIGINT') // => { code: 0, signal: null } on Linux and macOS, { code: null, signal: 'SIGINT' } on Windows
 * ```
 */
export function cleanSignalExit(signal: StopSignal, platform: NodeJS.Platform = process.platform): ChildExit {
  // why: Windows has no signals to deliver, so `kill` ends the child outright and Node reports the signal in place of an exit code.
  return platform === 'win32' ? { code: null, signal } : { code: 0, signal: null }
}
