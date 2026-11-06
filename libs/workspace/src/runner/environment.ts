/**
 * The search path a task runs with: the `node_modules/.bin` directory of the directory it runs
 * in and of every directory above it, then the directory of the running Node.js, then the path
 * it inherited, the way npm sets it for the scripts it starts.
 *
 * @module runner/environment
 */

import { posix, win32 } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** An environment, as `process.env` holds it. */
export type Environment = Readonly<Record<string, string | undefined>>

/**
 * The name the search path goes by in an environment: `PATH`, or on Windows whichever spelling
 * the environment already uses.
 *
 * @param env - The environment
 * @param platform - `win32` or another platform name
 * @returns The variable's name
 */
export function pathKey(env: Environment, platform: string): string {
  if (platform !== 'win32') return 'PATH'
  return (
    keys(env)
      .reverse()
      .find((key) => key.toUpperCase() === 'PATH') ?? 'Path'
  )
}

/**
 * The search path of a task running in a directory.
 *
 * @param directory - The directory the task runs in, absolute
 * @param inherited - The search path the task would otherwise get, if any
 * @param execPath - The running Node.js executable
 * @param platform - `win32` or another platform name, which decides the separators
 * @returns The `node_modules/.bin` directories from the directory up to the file system root, the Node.js directory, then the inherited path
 */
export function searchPath(directory: string, inherited: string | undefined, execPath: string, platform: string): string {
  const path = platform === 'win32' ? win32 : posix
  const entries: string[] = []
  let previous = ''
  let current = path.resolve(directory)
  while (current !== previous) {
    entries.push(path.join(current, 'node_modules', '.bin'))
    previous = current
    current = path.dirname(current)
  }
  entries.push(path.dirname(execPath))
  if (inherited !== undefined) entries.push(inherited)
  return entries.join(path.delimiter)
}

/**
 * An environment with the search path of a directory in place of the one it holds.
 *
 * @param env - The environment
 * @param directory - The directory the task runs in, absolute
 * @param execPath - The running Node.js executable
 * @param platform - `win32` or another platform name
 * @returns A copy of the environment whose search path starts with the directory's `node_modules/.bin`
 */
export function withSearchPath(
  env: Environment,
  directory: string,
  execPath: string,
  platform: string
): Record<string, string | undefined> {
  const key = pathKey(env, platform)
  return { ...env, [key]: searchPath(directory, env[key], execPath, platform) }
}
