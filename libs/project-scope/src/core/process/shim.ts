import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * How to start a command that is a `.cmd` shim on Windows: the values to spread into
 * `execFileSync`, `execFile`, `spawn` or `spawnSync` from `node:child_process`.
 */
export interface ShimCommand {
  /** The program, or on Windows the whole command line with its arguments quoted for `cmd.exe`. */
  readonly file: string
  /** The arguments, or none on Windows, where they are already part of the line. */
  readonly args: readonly string[]
  /** Whether the command starts through the platform shell: only on Windows. */
  readonly shell: boolean
}

/** An argument that reaches the program unchanged without quotes. */
const PLAIN = /^[\w\-./:=@+\\]+$/

/** The characters no quoting makes safe once a batch file re-reads its arguments. */
const REFUSED = /["%!\r\n\0]/

/** The characters `cmd.exe` interprets, escaped with `^` so it passes them on literally. */
const CMD_SPECIAL = /[()[\]^"<>&|;, *?`]/g

/**
 * Quotes one argument for a command line that `cmd.exe` reads before handing it to a `.cmd` shim:
 * an argument holding anything but word characters and `- . / : = @ + \` is wrapped in double
 * quotes, a trailing run of backslashes is doubled so it does not escape the closing quote, and
 * every character `cmd.exe` interprets, the quotes included, is escaped with `^`. The program
 * receives the argument as written.
 *
 * @param argument - One argument of the command
 * @returns The argument as it is written into the command line
 * @throws {Error} When the argument holds `"`, `%`, `!`, a line break or a NUL, which a batch file expands or splits whatever the quoting
 *
 * @example Quoting a path with a space and an ampersand
 * ```typescript
 * quoteForCmd('--save-dev') // => '--save-dev'
 * quoteForCmd('C:\\Tom & Jerry\\lib.tgz') // => '^"C:\\Tom^ ^&^ Jerry\\lib.tgz^"'
 * ```
 */
export function quoteForCmd(argument: string): string {
  if (REFUSED.test(argument)) {
    throw createError(
      `Cannot pass ${stringify(argument)} to a Windows shim, whose batch file expands or splits '"', '%', '!' and line breaks`
    )
  }
  if (PLAIN.test(argument)) return argument
  return `"${argument.replace(/(\\+)$/, '$1$1')}"`.replace(CMD_SPECIAL, '^$&')
}

/**
 * How to start `npm`, `npx`, `pnpm`, `yarn` or any other command that is a `.cmd` shim on
 * Windows. Node refuses to start a `.cmd` file without a shell, and with one it joins an argument
 * array unescaped and prints `DEP0190`, so on Windows the arguments are quoted for `cmd.exe` and
 * joined into one command line passed with no array. Everywhere else the command starts directly
 * with its arguments as given.
 *
 * @param command - The shim's name, such as `npm`
 * @param args - Its arguments
 * @param platform - The platform it starts on, this one by default
 * @returns The program, arguments and `shell` option to spawn it with
 * @throws {Error} On Windows, when an argument holds `"`, `%`, `!`, a line break or a NUL
 *
 * @example Packing a package on every platform
 * ```typescript
 * import { execFileSync } from 'node:child_process'
 *
 * const npm = shimCommand('npm', ['pack', '--json'])
 * execFileSync(npm.file, npm.args, { cwd: packageDir, shell: npm.shell })
 * // on Windows npm.file is 'npm pack --json', npm.args is [] and npm.shell is true
 * ```
 */
export function shimCommand(command: string, args: readonly string[], platform: NodeJS.Platform = process.platform): ShimCommand {
  if (platform !== 'win32') return { file: command, args: [...args], shell: false }
  return { file: [command, ...args.map(quoteForCmd)].join(' '), args: [], shell: true }
}
