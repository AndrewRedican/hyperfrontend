import type { BuildConfig } from '@hyperfrontend/builder/models'
import type { CliFlags } from '../args'
import { execFileSync } from 'node:child_process'
import { isAbsolute, join, resolve } from 'node:path'
import { build } from '@hyperfrontend/builder'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import {
  createDirectory,
  readFileContent,
  readJsonFileIfExists,
  removeDirectory,
  writeFileContent,
  writeJsonFile,
} from '@hyperfrontend/project-scope/core/fs'
import { commitChanges, createTree } from '@hyperfrontend/project-scope/vfs'
import { generateShell } from '../../generators/shell/generate-shell'
import { resolveBuildConfig } from '../config/resolve'
import { EXIT_ERROR, EXIT_OK } from '../exit-codes'

const DEFAULT_OUT = 'dist'

/** Inputs handed to the builder for a single connector build. */
export interface BuildRunnerInput {
  /** Staging directory (inside the consumer project) holding the generated connector sources. */
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
  /** Bundles the generated connector. */
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
 * Production builder runner: bundles the generated connector to ESM and CJS by
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
  const output = execFileSync('npm', ['pack'], { cwd: packageDir, encoding: 'utf-8' })
  /* istanbul ignore next -- @preserve split always yields at least one element, so pop() is never undefined */
  return output.trim().split('\n').pop() ?? ''
}

/**
 * Builds the connector: resolve config → generate the host connector into a
 * hidden staging dir inside the project → bundle via the builder → pack a
 * tarball into `--out`. A `v1`/`v2` security protocol is required for production
 * output; an explicit `--protocol none` builds only when paired with
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
    const { config, contract, protocol, protocolExplicit } = await resolveConfig({ cwd, flags })
    if (protocol === 'none') {
      if (!protocolExplicit) {
        stderr.write('Build requires a security protocol: pass --protocol v1 or --protocol v2.\n')
        return EXIT_ERROR
      }
      if (flags.allowOpen !== true) {
        stderr.write(
          "Building with an explicit protocol 'none' produces an open connector: the channel is unauthenticated and any page can embed and message the feature. Pass --allow-open to acknowledge the risk, or pick --protocol v1 / --protocol v2.\n"
        )
        return EXIT_ERROR
      }
      stderr.write("Warning: building an open connector (protocol 'none'); the channel carries no security envelope.\n")
    }

    // why: The default output nests per connector so the builder's clean step only ever empties this connector's own directory, never a shared dist/ root.
    const out = toAbsolute(cwd, flags.out ?? join(DEFAULT_OUT, `${config.name}-shell`))
    if (flags.dryRun) {
      stdout.write(`Would build "${config.name}" → ${out} [dry run]\n`)
      return EXIT_OK
    }

    // why: The staging dir lives inside the consumer project (not the OS temp dir) so module resolution can ascend into the consumer's node_modules and bundle the SDK into a self-contained connector.
    tempDir = join(cwd, `.hf-shell-${config.name.replace(/[^a-z0-9-]/gi, '-')}-${process.pid}`)
    createDirectory(tempDir, { recursive: true })
    const tree = createTree(tempDir)
    generateShell(config, contract, tree)
    tree.write('tsconfig.lib.json', buildTsConfig())
    commitChanges(tree)

    // why: The consumer project is the workspace — it holds node_modules (so the SDK bundles in) and the TypeScript binary the declaration pass spawns.
    await runBuilder({ projectRoot: tempDir, workspaceRoot: cwd, outputPath: out })
    publishSidecars(tempDir, out)
    const tarball = packTarball(out)
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
 * Copies the staged consumer-facing sidecars (`README.md`, `metadata.json`)
 * into the built package and lists the metadata file in the manifest's `files`
 * array so `npm pack` ships them with the connector.
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
    writeJsonFile(manifestPath, { ...manifest, files: [...(<unknown[]>manifest['files']), 'metadata.json'] })
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
