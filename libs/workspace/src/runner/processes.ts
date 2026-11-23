/**
 * Finds the processes a process started, and what each is named, which is how a request to end
 * the runner reaches the commands below the shell that ran them. On Linux the processes are read
 * from `/proc`, which a minimal container has even where it has no `ps`; where `/proc` gives
 * nothing, and on every other platform but Windows, they are read from one `ps` listing. Where
 * neither can be read there are no known processes, and the caller is left with the process it
 * started itself.
 *
 * @module runner/processes
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** One process of a listing. */
export interface ListedProcess {
  /** The process id. */
  readonly pid: number
  /** The id of the process that started it. */
  readonly parent: number
  /** The name of its executable, without the directory it is in; empty where the listing gives none. */
  readonly name: string
}

/** What the status line of a process tells of it. */
export type ProcessStatus = Omit<ListedProcess, 'pid'>

/** Where the running processes are read from. */
export interface ProcessSources {
  /** Lists the names in a directory, throwing when it cannot be listed. */
  readonly listDirectory: (path: string) => readonly string[]
  /** Reads a file as text, throwing when it cannot be read. */
  readonly readFile: (path: string, encoding: 'utf8') => string
  /** Lists every process as lines of a process id, its parent's and its command, as `ps -A -o pid= -o ppid= -o comm=` prints them. */
  readonly listWithPs: () => string
}

/** The name of the shell Node.js runs a command line through on every platform but Windows, which is how a wrapper is told from a command. */
export const SHELL_WRAPPER = 'sh'

/** The directory Linux describes its processes in, one directory a process, named by its id. */
const PROC = posix.join(posix.sep, 'proc')

/** A name made of digits alone, as the directory of a process is. */
const NUMERIC = /^\d+$/

/** A line of a process listing: a process id and its parent's, padded with spaces, then the command, which may be a path holding spaces. */
const LISTED = /^\s*(\d+)\s+(\d+)(?!\S)(.*)$/

/** What follows the command name in the status line of a process: its state, then its parent's id. */
const AFTER_NAME = /^\s+\S+\s+(\d+)(?:\s|$)/

/**
 * Reads a process listing: one process a line, its id, its parent's, then its command, of which
 * the base name is kept. A line that does not start with two numbers, such as a blank one or a
 * heading, is left out.
 *
 * @param listing - The listing, as `ps -A -o pid= -o ppid= -o comm=` prints it
 * @returns The processes listed
 *
 * @example A listing as Linux and as macOS print it
 * ```typescript
 * parseProcessListing('    1     0 init\n  412     1 sh\n 9731   412 node\n')
 * // => [{ pid: 1, parent: 0, name: 'init' }, { pid: 412, parent: 1, name: 'sh' }, { pid: 9731, parent: 412, name: 'node' }]
 * parseProcessListing('  412     1 /bin/sh\n 9731   412 /Applications/My Tools/node\n')
 * // => [{ pid: 412, parent: 1, name: 'sh' }, { pid: 9731, parent: 412, name: 'node' }]
 * ```
 */
export function parseProcessListing(listing: string): ListedProcess[] {
  return listing.split(/\r?\n/).flatMap((line) => {
    const fields = LISTED.exec(line)
    if (fields === null) return []
    const name = posix.basename((fields[3] as string).trim())
    return [{ pid: parseInt(fields[1] as string, 10), parent: parseInt(fields[2] as string, 10), name }]
  })
}

/**
 * Reads the status line of a process under `/proc`: its command name, which stands in
 * parentheses and may itself hold spaces and parentheses, and the id of its parent, the second
 * field after the last closing one.
 *
 * @param stat - The content of `/proc/<pid>/stat`
 * @returns The command name and the parent's id, or null for a line that does not hold them
 *
 * @example A command whose name holds a space and a parenthesis
 * ```typescript
 * readStatus('9731 (node) S 412 9731 412 0 -1 4194304') // => { parent: 412, name: 'node' }
 * readStatus('9732 (tmux: server (1)) S 9731 9732 412 0') // => { parent: 9731, name: 'tmux: server (1)' }
 * readStatus('') // => null
 * ```
 */
export function readStatus(stat: string): ProcessStatus | null {
  const closing = stat.lastIndexOf(')')
  const fields = AFTER_NAME.exec(stat.slice(closing + 1))
  return fields === null ? null : { parent: parseInt(fields[1] as string, 10), name: stat.slice(stat.indexOf('(') + 1, closing) }
}

/**
 * Every process a process started, and every process those started in turn.
 *
 * @param pid - The process the walk starts from, which is not part of the answer
 * @param processes - Every process, each with the one that started it
 * @returns The ids of the descendants, the nearest first
 *
 * @example A shell, the command it started and that command's worker
 * ```typescript
 * const processes = [
 *   { pid: 412, parent: 1, name: 'sh' },
 *   { pid: 9731, parent: 412, name: 'node' },
 *   { pid: 9732, parent: 9731, name: 'node' },
 *   { pid: 500, parent: 1, name: 'cron' },
 * ]
 * descendantsOf(412, processes) // => [9731, 9732]
 * descendantsOf(500, processes) // => []
 * ```
 */
export function descendantsOf(pid: number, processes: readonly ListedProcess[]): number[] {
  const seen = createSet([pid])
  const found: number[] = []
  let parents: readonly number[] = [pid]
  while (parents.length > 0) {
    const above = parents
    // why: a listing may hold a process that is its own parent, which is walked once
    parents = processes.filter((entry) => above.includes(entry.parent) && !seen.has(entry.pid)).map((entry) => entry.pid)
    for (const child of parents) seen.add(child)
    found.push(...parents)
  }
  return found
}

/**
 * The processes a signal meant for a command goes to. A shell that is only the wrapper of the
 * command line is left to end by itself, so that the command's exit code comes back through it:
 * the signal goes to everything it started, and to the wrapper alone once it has started nothing.
 * Any other process is the command itself, the shell having replaced itself with it, and gets the
 * signal along with everything it started. A process the listing does not hold gets it alone.
 *
 * @param pid - The process the command line was started as
 * @param processes - Every process, each with its name and the one that started it
 * @returns The ids to signal, the nearest to the process first
 *
 * @example A wrapper, a command that replaced its shell, and a process that has ended
 * ```typescript
 * const processes = [
 *   { pid: 412, parent: 1, name: 'sh' },
 *   { pid: 9731, parent: 412, name: 'node' },
 *   { pid: 9732, parent: 9731, name: 'node' },
 * ]
 * stopTargets(412, processes) // => [9731, 9732], the wrapper is left to end by itself
 * stopTargets(9731, processes) // => [9731, 9732], the command and its worker
 * stopTargets(9732, processes) // => [9732]
 * stopTargets(31337, processes) // => [31337]
 * stopTargets(412, [{ pid: 412, parent: 1, name: 'sh' }]) // => [412], a wrapper between two commands
 * ```
 */
export function stopTargets(pid: number, processes: readonly ListedProcess[]): number[] {
  const started = descendantsOf(pid, processes)
  if (!processes.some((entry) => entry.pid === pid && entry.name === SHELL_WRAPPER)) return [pid, ...started]
  return started.length > 0 ? started : [pid]
}

/**
 * Lists every process with `ps`, without a shell.
 *
 * @returns The listing: a process id, its parent's and its command on each line, without a heading
 */
function psListing(): string {
  // why: on some `ps` a heading given with `=` runs to the end of its argument, so each column gets an option of its own
  return execFileSync('ps', ['-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'comm='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/**
 * The sources the running processes are read from, each the real one unless given.
 *
 * @param given - The sources a caller supplies in place of the file system and `ps`
 * @returns The sources, complete
 *
 * @example Reading `/proc` for real and `ps` through a stand-in
 * ```typescript
 * const sources = processSources({ listWithPs: () => '  412     1 /bin/sh\n 9731   412 node\n' })
 * runningProcesses('darwin', sources) // => [{ pid: 412, parent: 1, name: 'sh' }, { pid: 9731, parent: 412, name: 'node' }]
 * ```
 */
export function processSources(given: Partial<ProcessSources> = {}): ProcessSources {
  return {
    listDirectory: given.listDirectory ?? readdirSync,
    readFile: given.readFile ?? readFileSync,
    listWithPs: given.listWithPs ?? psListing,
  }
}

/**
 * The status of the process a directory of `/proc` describes.
 *
 * @param name - The directory's name, a process id
 * @param sources - Reads the status line
 * @returns The command name and the parent's id, or null when the process ended before its status line could be read
 */
function statusUnderProc(name: string, sources: ProcessSources): ProcessStatus | null {
  try {
    return readStatus(sources.readFile(posix.join(PROC, name, 'stat'), 'utf8'))
  } catch {
    return null
  }
}

/**
 * The processes `/proc` describes.
 *
 * @param sources - Lists `/proc` and reads the status line of each process
 * @returns The processes, or none where `/proc` cannot be listed
 */
function processesUnderProc(sources: ProcessSources): ListedProcess[] {
  try {
    return sources.listDirectory(PROC).flatMap((name) => {
      const status = NUMERIC.test(name) ? statusUnderProc(name, sources) : null
      return status === null ? [] : [{ pid: parseInt(name, 10), ...status }]
    })
  } catch {
    return []
  }
}

/**
 * The processes running: from `/proc` on Linux, from `ps` where that gives none and on the other
 * platforms, and none on Windows, which has neither.
 *
 * @param platform - The platform, as `process.platform` names it
 * @param sources - Where the processes are read from
 * @returns Every process with its name and the one that started it, or none when they cannot be read
 *
 * @example The same answer from either source
 * ```typescript
 * runningProcesses('linux', processSources()) // => [{ pid: 1, parent: 0, name: 'systemd' }, { pid: 412, parent: 1, name: 'sh' }, ...] read from /proc
 * runningProcesses('darwin', processSources()) // => the same shape, read from one `ps -A -o pid= -o ppid= -o comm=`
 * runningProcesses('win32', processSources()) // => []
 * ```
 */
export function runningProcesses(platform: string, sources: ProcessSources): ListedProcess[] {
  if (platform === 'win32') return []
  const described = platform === 'linux' ? processesUnderProc(sources) : []
  if (described.length > 0) return described
  try {
    return parseProcessListing(sources.listWithPs())
  } catch {
    return []
  }
}
