/**
 * Runs an `nx:run-commands` target: its `command`, or its `commands` side by side (unless
 * `parallel` is false, when they run one after another and stop at the first failure), each
 * through the platform shell, `sh` or `cmd.exe`. The commands run from the workspace root, or
 * from the target's `cwd` taken relative to it, with the `node_modules/.bin` directories of that
 * directory and every directory above it first on the search path and the target's `env` on top
 * of the environment. The arguments after the task are appended to every command, or fill its
 * `{args}` and `{args.<name>}` placeholders instead.
 *
 * @module runner/commands
 */

import type { ChildProcess, SpawnOptions } from 'node:child_process'
import type { Environment } from './environment'
import type { ExecutorSchema } from './executors'
import { isAbsolute, join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { pathKey, withSearchPath } from './environment'
import { camelCase, readFlag, typedOverrides } from './overrides'
import { refusal } from './refusal'

/** One command of a `commands` list written as an object. */
export interface CommandEntry {
  /** The command. */
  readonly command: string
  /** Whether the arguments after the task reach this command when it holds no placeholder. */
  readonly forwardAllArgs?: boolean
  /** What the command is for; not read. */
  readonly description?: string
}

/** Starts a command through the platform shell; `spawn` unless a test supplies another. */
export type ShellSpawn = (command: string, options: SpawnOptions) => ChildProcess

/** Where and how the commands run. */
export interface CommandsHost {
  /** The workspace root, absolute. */
  readonly root: string
  /** The environment the commands start from. */
  readonly env: Environment
  /** The platform, which decides how the search path is written. */
  readonly platform: string
  /** The running Node.js executable, whose directory joins the search path. */
  readonly execPath: string
  /** Starts a command. */
  readonly spawn: ShellSpawn
  /** Writes a line of the runner's own: the command about to run, or why one failed. */
  readonly write: (line: string) => void
}

/** The commands of a target and how they run. */
interface CommandPlan {
  /** The commands. */
  readonly entries: readonly CommandEntry[]
  /** Whether they run side by side. */
  readonly parallel: boolean
}

/** The arguments after the task, sorted. */
interface Arguments {
  /** The options with the ones the arguments set. */
  readonly settings: Readonly<Record<string, unknown>>
  /** The arguments that reach the commands, quoted for the shell. */
  readonly forwarded: readonly string[]
  /** The values of the arguments that reach the commands, by name, for the `{args.<name>}` placeholders. */
  readonly values: Readonly<Record<string, string>>
}

/** A command started. */
interface Started {
  /** The process. */
  readonly child: ChildProcess
  /** Settles true when the command exits with code 0, false when it fails or cannot start. */
  readonly ended: Promise<boolean>
}

/** The options a target may set. */
const OPTIONS = ['command', 'commands', 'cwd', 'parallel', 'env', 'forwardAllArgs']

/** The options an argument after the task may set; every other argument reaches the commands. */
const SETTABLE = ['cwd', 'parallel', 'forwardAllArgs']

/** The types of the options a command line may set, as the run-commands schema declares them. */
const SETTABLE_SCHEMA: ExecutorSchema = {
  properties: { cwd: { type: 'string' }, parallel: { type: 'boolean' }, forwardAllArgs: { type: 'boolean' } },
}

/** The options of the run-commands schema an argument after the task may not set. */
const RESERVED = [
  'command',
  'commands',
  'args',
  'env',
  'envFile',
  'readyWhen',
  'color',
  'noColor',
  'noParallel',
  'tty',
  'usePty',
  'streamOutput',
  'verbose',
  '__unparsed__',
]

/** The fields a command written as an object may hold. */
const ENTRY_FIELDS = ['command', 'forwardAllArgs', 'description']

/** The characters a shell reads specially, for which a forwarded value is quoted. */
const SHELL_SPECIAL = /[|&;<>()$`\\!"'*?[\]{}~#\s]/

/**
 * Whether a value is already wrapped in matching quotes.
 *
 * @param value - The text an argument carries after its `=`, or the whole argument
 * @returns True for a value of two characters or more starting and ending with the same quote
 */
function isQuoted(value: string): boolean {
  return value.length >= 2 && ['"', "'"].some((quote) => value.startsWith(quote) && value.endsWith(quote))
}

/**
 * An argument as it reaches a command line: the value of `--name=value`, or the whole argument
 * without an `=`, double-quoted when a shell would read it specially.
 *
 * @param arg - The argument as written
 * @returns The argument, quoted where needed
 */
export function quoteArgument(arg: string): string {
  const equals = arg.indexOf('=')
  const value = arg.slice(equals + 1)
  if (!SHELL_SPECIAL.test(value) || isQuoted(value)) return arg
  return `${arg.slice(0, equals + 1)}"${value.replaceAll('"', '\\"')}"`
}

/**
 * A command with the arguments after the task in place: in its `{args.<name>}` placeholders,
 * else in its `{args}` placeholder, else appended when the command takes them.
 *
 * @param command - The command as written
 * @param forwarded - The arguments that reach the commands, quoted
 * @param values - Their values by name
 * @param forwardAll - Whether a command without a placeholder takes them
 * @returns The command line
 * @throws {Error} When the command holds both kinds of placeholder
 */
export function withArguments(
  command: string,
  forwarded: readonly string[],
  values: Readonly<Record<string, string>>,
  forwardAll: boolean
): string {
  const named = command.includes('{args.')
  const whole = command.includes('{args}')
  if (named && whole) throw refusal(`${command} holds both {args} and {args.<name>} placeholders; use one kind`)
  if (named) return command.replace(/\{args\.([^}]+)\}/g, (_, name: string) => values[name] ?? '')
  if (whole) return command.replaceAll('{args}', forwarded.join(' '))
  return forwardAll && forwarded.length > 0 ? `${command} ${forwarded.join(' ')}` : command
}

/**
 * Sorts the arguments after the task: those naming an option the command line may set set it,
 * the rest reach the commands.
 *
 * @param options - The target's options
 * @param args - The arguments after the task
 * @returns The options with the arguments' settings, and the arguments that reach the commands
 * @throws {Error} When an argument is not an option, or names one it may not set
 */
function sortArguments(options: Readonly<Record<string, unknown>>, args: readonly string[]): Arguments {
  const settings: Record<string, unknown> = { ...options }
  const forwarded: string[] = []
  const values: Record<string, string> = {}
  for (const arg of args) {
    const flag = readFlag(arg)
    const key = camelCase(flag.name)
    if (RESERVED.includes(key)) throw refusal(`--${flag.name} cannot be set after the task of a run-commands target`)
    if (SETTABLE.includes(key)) {
      settings[key] = typedOverrides({ [key]: flag.value }, SETTABLE_SCHEMA)[key]
      continue
    }
    forwarded.push(quoteArgument(arg))
    values[flag.name] = flag.value === true ? 'true' : flag.value
  }
  return { settings, forwarded, values }
}

/**
 * The commands of a target and whether they run side by side: a `command` runs alone, and a
 * `commands` list runs side by side unless `parallel` is false.
 *
 * @param settings - The target's options
 * @returns The commands and how they run
 * @throws {Error} When the target names no command, or writes a command with a field not supported
 */
function planCommands(settings: Readonly<Record<string, unknown>>): CommandPlan {
  const { command, commands } = settings
  if (command !== undefined) return { entries: [{ command: isArray(command) ? command.join(' ') : (command as string) }], parallel: false }
  if (!isArray(commands)) throw refusal('a run-commands target needs a command or a commands list')
  const entries = commands.map((entry) => (typeof entry === 'string' ? { command: entry } : (entry as CommandEntry)))
  const unsupported = entries.flatMap((entry) => keys(entry).filter((field) => !ENTRY_FIELDS.includes(field)))
  if (unsupported.length > 0) throw refusal(`run-commands command fields not supported: ${unsupported.join(', ')}`)
  return { entries, parallel: settings['parallel'] !== false }
}

/**
 * The directory the commands run in.
 *
 * @param cwd - The target's `cwd`, if any
 * @param root - The workspace root, absolute
 * @returns The root without a `cwd`, an absolute `cwd` as it is, else the `cwd` under the root
 */
function workingDirectory(cwd: string | undefined, root: string): string {
  if (!cwd) return root
  return isAbsolute(cwd) ? cwd : join(root, cwd)
}

/**
 * The environment the commands run with: the host's, the target's `env` on top, and the search
 * path of the directory they run in, which `env` cannot replace.
 *
 * @param host - The environment, platform and Node.js the commands start from
 * @param cwd - The directory the commands run in
 * @param env - The target's `env`, if any
 * @returns The variables the commands run with
 */
function commandEnvironment(host: CommandsHost, cwd: string, env: unknown): Record<string, string | undefined> {
  const searched = withSearchPath(host.env, cwd, host.execPath, host.platform)
  const key = pathKey(host.env, host.platform)
  return { ...searched, ...(env as Readonly<Record<string, string>> | undefined), [key]: searched[key] }
}

/**
 * Starts one command, reporting it first.
 *
 * @param line - The command line
 * @param cwd - The directory it runs in
 * @param env - The environment it runs with
 * @param host - Starts the command and takes the runner's own lines
 * @returns The process and whether it succeeded, once it ends
 */
function start(line: string, cwd: string, env: Record<string, string | undefined>, host: CommandsHost): Started {
  host.write(`> ${line}`)
  const child = host.spawn(line, { cwd, env, shell: true, stdio: 'inherit', windowsHide: true })
  const ended = createPromise<boolean>((resolve) => {
    let unstarted = false
    child.once('error', (error: Error) => {
      unstarted = true
      host.write(`could not start ${line}: ${error.message}`)
      resolve(false)
    })
    child.once('close', (code: number | null, signal: string | null) => {
      // why: a command that could not start still closes, with a negative error number for its code, which the start failure already reported
      if (code !== 0 && !unstarted) host.write(`exited with ${code ?? signal}: ${line}`)
      resolve(code === 0)
    })
  })
  return { child, ended }
}

/**
 * Runs commands one after another, stopping at the first that fails.
 *
 * @param lines - The command lines
 * @param cwd - The directory they run in
 * @param env - The environment they run with
 * @param host - Starts the commands and takes the runner's own lines
 * @returns True when every command succeeded
 */
async function runInSequence(
  lines: readonly string[],
  cwd: string,
  env: Record<string, string | undefined>,
  host: CommandsHost
): Promise<boolean> {
  for (const line of lines) if (!(await start(line, cwd, env, host).ended)) return false
  return true
}

/**
 * Runs commands side by side; the first to fail ends the others.
 *
 * @param lines - The command lines
 * @param cwd - The directory they run in
 * @param env - The environment they run with
 * @param host - Starts the commands and takes the runner's own lines
 * @returns True when every command succeeded
 */
async function runSideBySide(
  lines: readonly string[],
  cwd: string,
  env: Record<string, string | undefined>,
  host: CommandsHost
): Promise<boolean> {
  const started = lines.map((line) => start(line, cwd, env, host))
  let failed = false
  await promiseAll(
    started.map(async (own) => {
      if ((await own.ended) || failed) return
      failed = true
      for (const other of started) if (other !== own) other.child.kill('SIGTERM')
    })
  )
  return !failed
}

/**
 * Runs an `nx:run-commands` target.
 *
 * @param options - The target's options, resolved
 * @param args - The arguments after the task, as written
 * @param host - Where and how the commands run
 * @returns True when the commands succeeded
 * @throws {Error} When the target or the arguments use an option not supported
 */
export async function runCommands(
  options: Readonly<Record<string, unknown>>,
  args: readonly string[],
  host: CommandsHost
): Promise<boolean> {
  const unsupported = keys(options).filter((key) => !OPTIONS.includes(key))
  if (unsupported.length > 0) throw refusal(`run-commands options not supported: ${unsupported.join(', ')}`)
  const { settings, forwarded, values } = sortArguments(options, args)
  const { entries, parallel } = planCommands(settings)
  const cwd = workingDirectory(settings['cwd'] as string | undefined, host.root)
  const env = commandEnvironment(host, cwd, settings['env'])
  const forwardAll = settings['forwardAllArgs'] !== false
  const lines = entries.map((entry) => withArguments(entry.command, forwarded, values, entry.forwardAllArgs ?? forwardAll))
  return parallel ? runSideBySide(lines, cwd, env, host) : runInSequence(lines, cwd, env, host)
}
