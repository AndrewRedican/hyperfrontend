import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * The full CLI flag surface. Every scalar config key has a matching string flag
 * and every object key is passed as a path string; `--ci`/`--yes`
 * and `--dry-run` are the headless and preview toggles.
 */
export interface CliFlags {
  /** Feature name (`--name`). */
  readonly name?: string
  /** Feature version (`--version`). */
  readonly version?: string
  /** Security envelope to enforce at build time (`--protocol`): `none`, `v1`, or `v2`. */
  readonly protocol?: string
  /** Output directory for the built shell (`--out`). */
  readonly out?: string
  /** URL the generated shell loads the feature from (`--url`). */
  readonly url?: string
  /** Path to the contract file (`--contract`); an object key passed as a path. */
  readonly contract?: string
  /** Path to the dev-server apps array (`--apps`); the object key passed as a path. */
  readonly apps?: string
  /** Port the dev server's debug UI (`dev`) or the static server (`serve`) listens on (`--port`). */
  readonly port?: string
  /** Directory the static server serves as the site root (`--root`). */
  readonly root?: string
  /** Interface the static server binds (`--host`); every interface when omitted. */
  readonly host?: string
  /** Path to the whole config object (`--config`); the path-flag for the config itself. */
  readonly config?: string
  /** Working-directory override (`--cwd`). */
  readonly cwd?: string
  /** Target entry file `init` wires the glue import into (`--entry`). */
  readonly entry?: string
  /** Acknowledge an explicit `--protocol none` build and produce an open shell (`--allow-open`). */
  readonly allowOpen?: boolean
  /** Suppress prompts and fail on any unresolved required key (`--ci`). */
  readonly ci: boolean
  /** Suppress prompts, accepting defaults (`--yes`). */
  readonly yes: boolean
  /** Preview changes without writing them (`--dry-run`). */
  readonly dryRun: boolean
  /** Print usage and exit (`--help`/`-h`). */
  readonly help: boolean
}

/** The command name plus its parsed flags. */
export interface ParsedArgs {
  /** First positional token, e.g. `init`, `build`, or `dev`. */
  readonly command?: string
  /** Parsed flag values. */
  readonly flags: CliFlags
}

/** Value-taking flags mapped to their {@link CliFlags} key. */
const STRING_FLAGS: Record<string, keyof CliFlags> = {
  '--name': 'name',
  '--version': 'version',
  '--protocol': 'protocol',
  '--out': 'out',
  '--url': 'url',
  '--contract': 'contract',
  '--apps': 'apps',
  '--port': 'port',
  '--root': 'root',
  '--host': 'host',
  '--config': 'config',
  '--cwd': 'cwd',
  '--entry': 'entry',
}

/** Boolean flags mapped to their {@link CliFlags} key. */
const BOOLEAN_FLAGS: Record<string, keyof CliFlags> = {
  '--allow-open': 'allowOpen',
  '--ci': 'ci',
  '--yes': 'yes',
  '--dry-run': 'dryRun',
  '--help': 'help',
  '-h': 'help',
}

/**
 * Parses the CLI argv tail into a command and its flags. Unknown flags, missing
 * flag values, and stray positionals throw so typos fail at the boundary rather
 * than being silently dropped.
 *
 * @param argv - Argument list following the bin name (usually `process.argv.slice(2)`).
 * @returns The parsed command and flags.
 * @throws {Error} On an unknown flag, a value-flag without a value, or a second positional.
 *
 * @example Parsing a build invocation
 * ```typescript
 * parseCliArgs(['build', '--protocol', 'v2', '--out', './dist'])
 * // => { command: 'build', flags: { protocol: 'v2', out: './dist', ci: false, ... } }
 * ```
 */
export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const queue: string[] = [...argv]
  let command: string | undefined
  const strings: Record<string, string> = {}
  const booleans: Record<string, boolean> = {}

  while (queue.length > 0) {
    const token = queue.shift() as string
    if (!token.startsWith('-')) {
      if (command !== undefined) throw createError(`Unexpected argument: ${token}`)
      command = token
      continue
    }
    const booleanKey = BOOLEAN_FLAGS[token]
    if (booleanKey !== undefined) {
      booleans[booleanKey] = true
      continue
    }
    const stringKey = STRING_FLAGS[token]
    if (stringKey === undefined) throw createError(`Unknown flag: ${token}`)
    const value = queue.shift()
    if (value === undefined) throw createError(`${token} requires a value`)
    strings[stringKey] = value
  }

  const flags: CliFlags = {
    ...(strings as Partial<CliFlags>),
    allowOpen: booleans['allowOpen'] ?? false,
    ci: booleans['ci'] ?? false,
    yes: booleans['yes'] ?? false,
    dryRun: booleans['dryRun'] ?? false,
    help: booleans['help'] ?? false,
  }
  return { ...(command !== undefined && { command }), flags }
}
