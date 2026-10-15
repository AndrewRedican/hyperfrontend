import { spawnSync } from 'node:child_process'

/**
 * Runs the current Node binary, so a spec can automock `node:child_process` and watch
 * the call arrive on the mock instead of a real process.
 *
 * @returns The child's exit status.
 */
export function nodeStatus(): number | null {
  return spawnSync(process.execPath, ['--version']).status
}
