import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import type { CliFlags } from '../args'
import type { MarkerInsertion } from '../insert-marker'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { discoverEntryPoints } from '@hyperfrontend/project-scope/heuristics/entry-points'
import { commitChanges, createTree } from '@hyperfrontend/project-scope/vfs'
import { generateContractTypes } from '../../generators/contract/generate-types'
import { generateFeatureModule } from '../../generators/feature/generate-feature-module'
import { validateContract } from '../../shared/contract'
import { loadModuleFile } from '../config/load-module'
import { EXIT_CANCELLED, EXIT_ERROR, EXIT_OK } from '../exit-codes'
import { insertFeatureImport } from '../insert-marker'
import { promptContractPath, promptEntryFile, promptFeatureName } from '../prompts'

const DEFAULT_VERSION = '0.1.0'
const GLUE_MODULE = 'src/hyperfrontend.feature'
const CONFIG_FILE = 'feature.config.json'
const CONFIG_SCHEMA = 'https://hyperfrontend.dev/schemas/feature.config.json'

/** Injectable boundaries for `runInit`, defaulted for production and overridden in tests. */
export interface InitDeps {
  /** Loads and validates a contract from an absolute path. */
  readonly loadContract?: (absolutePath: string) => Promise<FeatureContract>
  /** Discovers candidate entry files under a directory (cwd-relative paths). */
  readonly discoverEntries?: (directory: string) => readonly string[]
  /** Creates the VFS tree the scaffold is staged into. */
  readonly createTreeFn?: typeof createTree
  /** Commits the staged tree to disk. */
  readonly commit?: typeof commitChanges
  /** Prompts for the feature name. */
  readonly promptName?: () => Promise<string | null>
  /** Prompts for the contract path. */
  readonly promptContract?: () => Promise<string | null>
  /** Prompts for the entry file from discovered candidates. */
  readonly promptEntry?: (candidates: readonly string[]) => Promise<string | null>
}

/** Inputs for a single `init` invocation. */
export interface RunInitOptions extends InitDeps {
  /** Parsed CLI flags. */
  readonly flags: CliFlags
  /** Working directory the scaffold is created in. */
  readonly cwd: string
  /** Sink for the success summary. */
  readonly stdout: NodeJS.WritableStream
  /** Sink for diagnostics and cancellation messages. */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Resolves a possibly-relative path against a base directory.
 *
 * @param base - Absolute base directory.
 * @param path - The path to resolve.
 * @returns The absolute path.
 */
function toAbsolute(base: string, path: string): string {
  return isAbsolute(path) ? path : resolve(base, path)
}

/**
 * Converts an absolute path to a POSIX-style path relative to a base.
 *
 * @param base - Absolute base directory.
 * @param absolutePath - The absolute path to relativize.
 * @returns The base-relative POSIX path.
 */
function toRelativePosix(base: string, absolutePath: string): string {
  return relative(base, absolutePath).split('\\').join('/')
}

/**
 * Default contract loader: tiered-load then runtime-validate.
 *
 * @param absolutePath - Absolute path to the contract file.
 * @returns The validated contract.
 */
async function defaultLoadContract(absolutePath: string): Promise<FeatureContract> {
  return validateContract(await loadModuleFile(absolutePath))
}

/**
 * Default entry discovery: project-scope heuristics minus test entries.
 *
 * @param directory - Directory to search.
 * @returns Candidate entry paths, relative to the directory.
 */
function defaultDiscoverEntries(directory: string): readonly string[] {
  return discoverEntryPoints(directory)
    .filter((entry) => entry.type !== 'test')
    .map((entry) => toRelativePosix(directory, toAbsolute(directory, entry.path)))
}

/**
 * Reports an unresolved required value: a hard error under `--ci`/`--yes`, a
 * graceful cancellation otherwise.
 *
 * @param key - The flag/key that was not resolved.
 * @param headless - Whether the run is non-interactive.
 * @param stderr - Diagnostic sink.
 * @returns The exit code.
 */
function unresolved(key: string, headless: boolean, stderr: NodeJS.WritableStream): number {
  if (headless) {
    stderr.write(`Missing required value: --${key} must be provided in --ci/--yes mode.\n`)
    return EXIT_ERROR
  }
  stderr.write('Cancelled.\n')
  return EXIT_CANCELLED
}

/**
 * Narrows an unknown value read from an existing config to a string.
 *
 * @param value - The value read from an existing config.
 * @returns The string value, or `undefined` for any other shape.
 */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Reads and parses the machine-owned `feature.config.json` when one exists.
 *
 * @param tree - The VFS tree rooted at the scaffold directory.
 * @returns The parsed config object, or `null` when the file does not exist.
 * @throws {Error} When the file exists but does not hold a JSON object.
 */
function readExistingConfig(tree: Tree): Record<string, unknown> | null {
  const raw = tree.read(CONFIG_FILE, 'utf-8')
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = parse(raw)
  } catch {
    throw createError(`${CONFIG_FILE} exists but is not valid JSON — fix or delete it, then re-run init.`)
  }
  if (typeof parsed !== 'object' || parsed === null || isArray(parsed)) {
    throw createError(`${CONFIG_FILE} exists but is not a JSON object — fix or delete it, then re-run init.`)
  }
  return <Record<string, unknown>>parsed
}

/**
 * Rebuilds the prior resolved config from a parsed `feature.config.json`, used
 * to recognize a pristine (machine-rendered) glue module.
 *
 * @param existing - The parsed existing config, or `null` when absent.
 * @returns The prior resolved config, or `undefined` when it cannot be reconstructed.
 */
function toPreviousConfig(existing: Record<string, unknown> | null): ResolvedFeatureConfig | undefined {
  if (existing === null) return undefined
  const name = asString(existing['name'])
  const version = asString(existing['version'])
  const contract = asString(existing['contract'])
  if (name === undefined || version === undefined || contract === undefined) return undefined
  return { name, version, contract, url: asString(existing['url']) ?? '/' }
}

/**
 * Builds the merged machine-owned `feature.config.json` contents: unmanaged keys
 * from the existing config survive verbatim, managed keys take the resolved values.
 *
 * @param config - The resolved feature config (defaults < existing config < flags).
 * @param existing - The parsed existing config, or `null` when absent.
 * @returns The JSON file contents with a trailing newline.
 */
function buildConfigJson(config: ResolvedFeatureConfig, existing: Record<string, unknown> | null): string {
  const manifest = {
    ...existing,
    $schema: CONFIG_SCHEMA,
    name: config.name,
    version: config.version,
    contract: config.contract,
    url: config.url,
  }
  return `${stringify(manifest, null, 2)}\n`
}

/**
 * Stages the merged config, but only when it differs from what already exists.
 *
 * @param tree - The VFS tree the config is staged into.
 * @param config - The resolved feature config.
 * @param existing - The parsed existing config, or `null` when absent.
 * @returns Whether the config was staged as created, staged as updated, or kept as-is.
 */
function stageConfig(tree: Tree, config: ResolvedFeatureConfig, existing: Record<string, unknown> | null): 'created' | 'kept' | 'updated' {
  const next = buildConfigJson(config, existing)
  const current = tree.read(CONFIG_FILE, 'utf-8')
  if (current === next) return 'kept'
  tree.write(CONFIG_FILE, next)
  return current === null ? 'created' : 'updated'
}

/**
 * Inserts or regenerates the marker-guarded glue import in the resolved entry file.
 *
 * @param tree - The VFS tree holding the entry file.
 * @param cwd - The working directory the entry path is relative to.
 * @param entry - The user-supplied entry path.
 * @returns `'wired'` when the entry changed, `'kept'` when already canonical, `'missing'` when the file does not exist.
 * @throws {Error} When the entry's marker block is damaged beyond unambiguous repair.
 */
function wireEntry(tree: Tree, cwd: string, entry: string): 'kept' | 'missing' | 'wired' {
  const entryRel = toRelativePosix(cwd, toAbsolute(cwd, entry))
  const content = tree.read(entryRel, 'utf-8')
  if (content === null) return 'missing'
  const glueRelative = toRelativePosix(dirname(toAbsolute(cwd, entryRel)), toAbsolute(cwd, GLUE_MODULE))
  const specifier = glueRelative.startsWith('.') ? glueRelative : `./${glueRelative}`
  let result: MarkerInsertion
  try {
    result = insertFeatureImport(content, specifier)
  } catch (error) {
    throw createError(`${entryRel}: ${(<Error>error).message}`)
  }
  if (!result.changed) return 'kept'
  tree.write(entryRel, result.content)
  return 'wired'
}

/**
 * Scaffolds the hostee glue module, writes `feature.config.json` (plus a `.d.ts`
 * bridge beside a JSON contract), and wires a marker-guarded import into the
 * resolved entry file. Re-runs are idempotent and partial-apply-safe: machine-owned
 * content (config, declaration bridge, marker block) is regenerated from merged
 * inputs (defaults < existing config < flags), pristine glue is regenerated when
 * the merged config changes while the contract content is unchanged, author-edited
 * content is never clobbered, missing pieces are recreated, and the summary reports created,
 * updated, and kept counts truthfully. Everything stages into one tree committed
 * once, so failures before commit leave the workspace untouched. Honors
 * `--dry-run`, and `--ci`/`--yes` require every value to come from flags.
 *
 * @param options - Flags, working directory, output sinks, and injectable deps.
 * @returns The process exit code.
 *
 * @example Scaffolding a feature non-interactively
 * ```typescript
 * const code = await runInit({
 *   flags: { name: 'clock', contract: './clock.contract.json', entry: './src/main.ts', ci: true, yes: false, dryRun: false, help: false },
 *   cwd: process.cwd(),
 *   stdout: process.stdout,
 *   stderr: process.stderr,
 * })
 * ```
 */
export async function runInit(options: RunInitOptions): Promise<number> {
  const { flags, stdout, stderr } = options
  const cwd = flags.cwd ? resolve(options.cwd, flags.cwd) : options.cwd
  const headless = flags.ci || flags.yes
  const loadContract = options.loadContract ?? defaultLoadContract
  const discover = options.discoverEntries ?? defaultDiscoverEntries
  const makeTree = options.createTreeFn ?? createTree
  const commit = options.commit ?? commitChanges
  const askName = options.promptName ?? promptFeatureName
  const askContract = options.promptContract ?? promptContractPath
  const askEntry = options.promptEntry ?? promptEntryFile

  try {
    const name = flags.name ?? (headless ? null : await askName())
    if (!name) return unresolved('name', headless, stderr)
    const contractPath = flags.contract ?? (headless ? null : await askContract())
    if (!contractPath) return unresolved('contract', headless, stderr)
    const entry = flags.entry ?? (headless ? null : await askEntry(discover(cwd)))
    if (!entry) return unresolved('entry', headless, stderr)

    const contract = await loadContract(toAbsolute(cwd, contractPath))
    const tree = makeTree(cwd)
    const existingConfig = readExistingConfig(tree)
    const resolved: ResolvedFeatureConfig = {
      name,
      version: flags.version ?? asString(existingConfig?.['version']) ?? DEFAULT_VERSION,
      contract: contractPath,
      url: flags.url ?? asString(existingConfig?.['url']) ?? '/',
    }

    const glueOutcome = generateFeatureModule(resolved, contract, tree, toPreviousConfig(existingConfig))
    const typesOutcome = generateContractTypes(resolved, contract, tree)
    const configOutcome = stageConfig(tree, resolved, existingConfig)
    const entryOutcome = wireEntry(tree, cwd, entry)
    if (entryOutcome === 'missing') throw createError(`Entry file not found: ${entry}`)

    const kept = [glueOutcome, typesOutcome, configOutcome, entryOutcome].filter((outcome) => outcome === 'kept').length
    const result = commit(tree, { dryRun: flags.dryRun })
    const counts = `(created ${result.created}, updated ${result.updated}, kept ${kept})`
    const suffix = flags.dryRun ? ' [dry run]' : ''
    const summary =
      result.created + result.updated > 0
        ? `${flags.dryRun ? 'Would scaffold' : 'Scaffolded'} feature "${name}" ${counts}${suffix}`
        : `Feature "${name}" is up to date ${counts}${suffix}`
    stdout.write(`${summary}\n`)
    return EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
}
