import type { BuildConfig } from '@hyperfrontend/builder/models'
import type { CliFlags } from '../args'
import { execFileSync } from 'node:child_process'
import { cpSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { build } from '@hyperfrontend/builder'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import {
  createDirectory,
  exists,
  readDirectory,
  readFileContent,
  readJsonFileIfExists,
  removeDirectory,
  writeFileContent,
  writeJsonFile,
} from '@hyperfrontend/project-scope/core/fs'
import { isWithinRoot } from '@hyperfrontend/project-scope/core/path'
import { commitChanges, createTree } from '@hyperfrontend/project-scope/vfs'
import { generateShell } from '../../generators/shell/generate-shell'
import { resolveBuildConfig } from '../config/resolve'
import { reconcileServeIsolation } from '../config/serve-reconciliation'
import { EXIT_ERROR, EXIT_OK } from '../exit-codes'
import { normalizeDeclarationMaps } from './normalize-declaration-maps'

const DEFAULT_OUT = 'dist'
const SHELL_GENERATOR = '@hyperfrontend/features'

/** Inputs handed to the builder for a single shell build. */
export interface BuildRunnerInput {
  /** Staging directory (inside the consumer project) holding the generated shell sources. */
  readonly projectRoot: string
  /** The consumer project root, supplying `node_modules` and the TypeScript toolchain. */
  readonly workspaceRoot: string
  /** Directory the bundled package is emitted into. */
  readonly outputPath: string
}

/** Injectable boundaries for `runBuild`, defaulted for production and overridden in tests. */
export interface BuildDeps {
  /** Resolves the feature config and contract. */
  readonly resolveConfig?: typeof resolveBuildConfig
  /** Bundles the generated shell. */
  readonly runBuilder?: (input: BuildRunnerInput) => Promise<void>
  /** Packs the built package into a tarball and returns its filename. */
  readonly packTarball?: (packageDir: string) => string
}

/** Inputs for a single `build` invocation. */
export interface RunBuildOptions extends BuildDeps {
  /** Parsed CLI flags. */
  readonly flags: CliFlags
  /** Working directory the config and output paths resolve against. */
  readonly cwd: string
  /** Sink for the success summary. */
  readonly stdout: NodeJS.WritableStream
  /** Sink for diagnostics. */
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
 * Production builder runner: bundles the generated shell to ESM and CJS by
 * driving `@hyperfrontend/builder` in-process.
 *
 * @param input - The resolved build inputs.
 */
async function defaultRunBuilder(input: BuildRunnerInput): Promise<void> {
  const config: BuildConfig = {
    projectRoot: input.projectRoot,
    workspaceRoot: input.workspaceRoot,
    outputPath: input.outputPath,
    tsConfig: join(input.projectRoot, 'tsconfig.lib.json'),
    esm: {},
    cjs: {},
  }
  await build(config)
}

/**
 * Production tarball packer: runs `npm pack` in the built package directory.
 *
 * @param packageDir - Directory of the built, publishable package.
 * @returns The created tarball's filename.
 */
function defaultPackTarball(packageDir: string): string {
  // why: npm is a .cmd shim on Windows, which Node only spawns through a shell.
  const output = execFileSync('npm', ['pack'], { cwd: packageDir, encoding: 'utf-8', shell: process.platform === 'win32' })
  // why: split always yields at least one element, so pop() is never undefined
  return output.trim().split('\n').pop() ?? ''
}

/**
 * Builds the shell: resolve config → generate the shell package into a
 * hidden staging dir inside the project → bundle via the builder → pack a
 * tarball → replace `--out` with the result. `--out` (default
 * `dist/<name>-shell`) may sit anywhere, a shared `dist/` beside the project
 * included, but the build must be able to own it: a directory that does not
 * exist, is empty, or holds a shell this CLI built earlier. The project
 * directory, its ancestors, and any directory holding other files are refused
 * before the build starts. A `v3`/`v4` security protocol is required for
 * production output; an explicit `--protocol none` builds only when paired with
 * `--allow-open`, acknowledging the open channel. The staging dir is always
 * removed.
 *
 * @param options - Flags, working directory, output sinks, and injectable deps.
 * @returns The process exit code.
 *
 * @example Building a feature into ./dist
 * ```typescript
 * const code = await runBuild({ flags, cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * ```
 */
export async function runBuild(options: RunBuildOptions): Promise<number> {
  const { flags, stdout, stderr } = options
  const cwd = flags.cwd ? resolve(options.cwd, flags.cwd) : options.cwd
  const resolveConfig = options.resolveConfig ?? resolveBuildConfig
  const runBuilder = options.runBuilder ?? defaultRunBuilder
  const packTarball = options.packTarball ?? defaultPackTarball

  let tempDir: string | null = null
  try {
    const { config, contract, protocol, protocolExplicit, sourcePath } = await resolveConfig({ cwd, flags })
    // why: The feature config and the serve config are separate artifacts deployed separately, and only at build time are they both in reach; a disagreement between them surfaces here or not until a session hangs in a visitor's browser.
    const isolationWarning = reconcileServeIsolation(config, sourcePath ?? null)
    if (isolationWarning !== null) {
      stderr.write(isolationWarning)
    }
    if (protocol === 'none') {
      if (!protocolExplicit) {
        stderr.write('Build requires a security protocol: pass --protocol v3 or --protocol v4.\n')
        return EXIT_ERROR
      }
      if (flags.allowOpen !== true) {
        stderr.write(
          "Building with an explicit protocol 'none' produces an open shell: the channel is unauthenticated and any page can embed and message the feature. Pass --allow-open to acknowledge the risk, or pick --protocol v3 / --protocol v4.\n"
        )
        return EXIT_ERROR
      }
      stderr.write("Warning: building an open shell (protocol 'none'); the channel carries no security envelope.\n")
    }

    const out = toAbsolute(cwd, flags.out ?? join(DEFAULT_OUT, `${config.name}-shell`))
    // why: Replacing --out is the one destructive step of a build, so an unusable target is refused before any work starts, and a dry run reports it the same way.
    assertOwnableOutput(out, cwd)
    if (flags.dryRun) {
      stdout.write(`Would build "${config.name}" → ${out} [dry run]\n`)
      return EXIT_OK
    }

    // why: The staging dir lives inside the consumer project (not the OS temp dir) so module resolution can ascend into the consumer's node_modules and bundle the SDK into a self-contained shell.
    tempDir = join(cwd, `.hf-shell-${config.name.replace(/[^a-z0-9-]/gi, '-')}-${process.pid}`)
    createDirectory(tempDir, { recursive: true })
    const tree = createTree(tempDir)
    generateShell(config, contract, tree)
    tree.write('tsconfig.lib.json', buildTsConfig())
    commitChanges(tree)

    // why: The builder empties its output before emitting and only trusts a path inside the workspace it is given, which for a shell build is the consumer project. Emitting into the staging dir keeps that clean step inside a directory this build created, so --out may name any directory the consumer chooses, a shared dist/ beside the project included.
    const staged = join(tempDir, 'dist')
    createDirectory(staged, { recursive: true })
    // why: The consumer project is the workspace — it holds node_modules (so the SDK bundles in) and the TypeScript binary the declaration pass spawns.
    await runBuilder({ projectRoot: tempDir, workspaceRoot: cwd, outputPath: staged })
    // why: The staging dir name embeds the PID, so the emitted declaration maps are rewritten to stable feature-derived paths — repacking an unchanged feature stays byte-identical.
    normalizeDeclarationMaps(staged, config.name, (message) => stderr.write(message))
    publishSidecars(tempDir, staged)
    const tarball = packTarball(staged)
    deliverShell(staged, out, cwd)
    stdout.write(`Built "${config.name}" → ${out}\n${tarball ? `Packed ${tarball}\n` : ''}`)
    return EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  } finally {
    if (tempDir !== null) removeDirectory(tempDir, { recursive: true, force: true })
  }
}

/**
 * Reports whether a directory holds a shell this CLI built earlier: its
 * `metadata.json` names the SDK as its generator.
 *
 * @param dir - The directory to inspect.
 * @returns True when the directory is a previous shell build.
 */
function isShellOutput(dir: string): boolean {
  const metadata = readJsonFileIfExists<Record<string, unknown>>(join(dir, 'metadata.json'))
  return metadata !== null && metadata['generatedBy'] === SHELL_GENERATOR
}

/**
 * Refuses an output directory the build may not replace. A target qualifies
 * only when the build can own it outright: it does not exist yet, it is
 * empty, or it holds a shell this CLI built earlier. The consumer project and
 * every directory above it are refused regardless of content, and so is any
 * directory holding files the CLI did not write, wherever it sits.
 *
 * @param out - Absolute output directory.
 * @param cwd - Absolute consumer project directory.
 * @throws {Error} When `out` contains the project or holds foreign files.
 */
function assertOwnableOutput(out: string, cwd: string): void {
  if (isWithinRoot(out, cwd)) {
    throw createError(
      `build: --out "${out}" contains the project itself. Point --out at a directory the shell can own, such as dist/<name>-shell.`
    )
  }
  if (!exists(out) || readDirectory(out).length === 0 || isShellOutput(out)) return
  throw createError(
    `build: --out "${out}" holds files hf build did not write. Point --out at a new or empty directory, or remove it first.`
  )
}

/**
 * Replaces `out` with the staged, packed shell. The ownership check runs
 * again so a directory that gained foreign files during the build is still
 * refused rather than removed.
 *
 * @param staged - The built package directory inside the staging dir.
 * @param out - Absolute output directory to replace.
 * @param cwd - Absolute consumer project directory.
 */
function deliverShell(staged: string, out: string, cwd: string): void {
  assertOwnableOutput(out, cwd)
  removeDirectory(out, { recursive: true, force: true })
  createDirectory(dirname(out), { recursive: true })
  cpSync(staged, out, { recursive: true })
}

/**
 * Copies the staged consumer-facing sidecars (`README.md`, `metadata.json`)
 * into the built package and lists the metadata file in the manifest's `files`
 * array so `npm pack` ships them with the shell.
 *
 * @param tempDir - The staging directory holding the generated sidecars.
 * @param out - The built package directory the tarball is packed from.
 */
function publishSidecars(tempDir: string, out: string): void {
  writeFileContent(join(out, 'README.md'), readFileContent(join(tempDir, 'README.md')))
  writeFileContent(join(out, 'metadata.json'), readFileContent(join(tempDir, 'metadata.json')))
  const manifestPath = join(out, 'package.json')
  const manifest = readJsonFileIfExists<Record<string, unknown>>(manifestPath)
  if (manifest !== null && isArray(manifest['files'])) {
    writeJsonFile(manifestPath, { ...manifest, files: [...(manifest['files'] as unknown[]), 'metadata.json'] })
  }
}

/**
 * Builds the minimal `tsconfig.lib.json` the builder reads for declarations.
 *
 * @returns The tsconfig file contents with a trailing newline.
 */
function buildTsConfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      // why: An explicit rootDir anchors the compiler's file matching to the staged sources, keeping the build correct no matter which directory the CLI is invoked from.
      rootDir: 'src',
      declaration: true,
      strict: true,
      skipLibCheck: true,
    },
    include: ['src/**/*.ts'],
  }
  return `${stringify(tsconfig, null, 2)}\n`
}
