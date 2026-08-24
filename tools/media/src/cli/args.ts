import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { globalIsNaN, parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Flags that stand alone, so the token after them is never swallowed as a value. */
const BOOLEAN_FLAGS: readonly string[] = ['json', 'verbose', 'skip-build', 'keep-tmp', 'full-page', 'console', 'help']

/** A parsed command line. */
export interface ParsedArgs {
  /** Subcommand, or an empty string when none was given. */
  command: string
  /** Value-carrying flags, keyed without their leading dashes. */
  values: ReadonlyMap<string, string>
  /** Flags that were present without a value. */
  flags: ReadonlySet<string>
}

/**
 * Parse a command line into a subcommand, valued flags and standalone flags.
 *
 * Both `--flag value` and `--flag=value` are accepted. Anything that is not a
 * flag is the subcommand, and a second one is an error rather than a silent
 * overwrite, because a mistyped flag would otherwise look like a subcommand.
 *
 * @param argv - Arguments after the executable and script names.
 * @returns The parsed command line.
 * @throws {Error} On a repeated subcommand or a valued flag with no value.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = createMap<string, string>()
  const flags = createSet<string>()
  let command = ''
  let index = 0
  while (index < argv.length) {
    const token = argv[index] ?? ''
    index += 1
    if (!token.startsWith('--')) {
      if (command !== '') {
        throw createError(`Unexpected argument "${token}". Did you mean --${token}?`)
      }
      command = token
      continue
    }
    const body = token.slice(2)
    const separator = body.indexOf('=')
    if (separator >= 0) {
      values.set(body.slice(0, separator), body.slice(separator + 1))
      continue
    }
    if (BOOLEAN_FLAGS.includes(body)) {
      flags.add(body)
      continue
    }
    const value = argv[index]
    if (value === undefined || value.startsWith('--')) {
      throw createError(`--${body} needs a value`)
    }
    values.set(body, value)
    index += 1
  }
  return { command, values, flags }
}

/**
 * Read a flag's value, falling back when it was not given.
 *
 * @param args - The parsed command line.
 * @param name - Flag name without its leading dashes.
 * @param fallback - Value to use when the flag is absent.
 * @returns The flag's value or the fallback.
 */
export function readString(args: ParsedArgs, name: string, fallback: string): string {
  return args.values.get(name) ?? fallback
}

/**
 * Read a flag's value as a whole number.
 *
 * @param args - The parsed command line.
 * @param name - Flag name without its leading dashes.
 * @param fallback - Value to use when the flag is absent.
 * @returns The flag's value or the fallback.
 * @throws {Error} When the flag was given something that is not a number.
 */
export function readNumber(args: ParsedArgs, name: string, fallback: number): number {
  const raw = args.values.get(name)
  if (raw === undefined) {
    return fallback
  }
  const parsed = parseInteger(raw, 10)
  if (globalIsNaN(parsed)) {
    throw createError(`--${name} needs a number, got "${raw}"`)
  }
  return parsed
}

/**
 * Read a `WIDTHxHEIGHT` pair such as `1440x810`.
 *
 * @param raw - The value as written on the command line.
 * @returns The two numbers, width first.
 * @throws {Error} When the value is not two numbers separated by an `x`.
 */
export function readSize(raw: string): readonly [number, number] {
  const parts = raw.split('x')
  const width = parseInteger(parts[0] ?? '', 10)
  const height = parseInteger(parts[1] ?? '', 10)
  if (parts.length !== 2 || globalIsNaN(width) || globalIsNaN(height)) {
    throw createError(`Expected a size like 1440x810, got "${raw}"`)
  }
  return [width, height]
}
