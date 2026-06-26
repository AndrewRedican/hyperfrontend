import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import type { CliFlags } from '../args'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { discoverEntryPoints } from '@hyperfrontend/project-scope/heuristics/entry-points'
import { commitChanges, createTree, Mode } from '@hyperfrontend/project-scope/vfs'
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
 * Builds the `feature.config.json` contents from a resolved config.
 *
 * @param config - The resolved feature config.
 * @returns The JSON file contents with a trailing newline.
 */
function buildConfigJson(config: ResolvedFeatureConfig): string {
  const manifest = { $schema: CONFIG_SCHEMA, name: config.name, version: config.version, contract: config.contract }
  return `${stringify(manifest, null, 2)}\n`
}

/**
 * Inserts the marker-guarded glue import into the resolved entry file.
 *
 * @param tree - The VFS tree holding the entry file.
 * @param cwd - The working directory the entry path is relative to.
 * @param entry - The user-supplied entry path.
 * @returns `true` when the entry exists and was wired (or already wired); `false` when missing.
 */
function wireEntry(tree: Tree, cwd: string, entry: string): boolean {
  const entryRel = toRelativePosix(cwd, toAbsolute(cwd, entry))
  const content = tree.read(entryRel, 'utf-8')
  if (content === null) return false
  const glueRelative = toRelativePosix(dirname(toAbsolute(cwd, entryRel)), toAbsolute(cwd, GLUE_MODULE))
  const specifier = glueRelative.startsWith('.') ? glueRelative : `./${glueRelative}`
  const result = insertFeatureImport(content, specifier)
  if (result.changed) tree.write(entryRel, result.content)
  return true
}

/**
 * Scaffolds the hostee glue module, writes `feature.config.json`, and wires a
 * marker-guarded import into the resolved entry file. Discovery, prompting, and
 * insertion live here; the glue source comes from the pure feature-module generator.
 * Honors `--dry-run`, and `--ci`/`--yes` require every value to come from flags.
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
    const resolved: ResolvedFeatureConfig = {
      name,
      version: flags.version ?? DEFAULT_VERSION,
      contract: contractPath,
      url: flags.url ?? '/',
    }

    const tree = makeTree(cwd)
    generateFeatureModule(resolved, contract, tree)
    tree.write(CONFIG_FILE, buildConfigJson(resolved), { mode: Mode.SkipIfExists })
    if (!wireEntry(tree, cwd, entry)) throw createError(`Entry file not found: ${entry}`)

    const result = commit(tree, { dryRun: flags.dryRun })
    const verb = flags.dryRun ? 'Would scaffold' : 'Scaffolded'
    stdout.write(`${verb} feature "${name}" (created ${result.created}, updated ${result.updated})${flags.dryRun ? ' [dry run]' : ''}\n`)
    return EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
}
