import type { ExecutorContext, PromiseExecutor } from '@nx/devkit'
import type { PackShellExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { logger } from '../../lib/logger'

/** Inputs the SDK's config resolver takes. */
interface ResolveBuildConfigInput {
  /** Directory the feature config and contract paths resolve against. */
  cwd: string
  /** CLI-flag overrides; only the required booleans are supplied here. */
  flags: Record<string, unknown>
}

/** The resolved feature identity the generator consumes. */
interface ResolvedShellConfig {
  /** Published feature name. */
  name: string
  /** Feature version string. */
  version: string
}

/** The resolver's result: the feature identity plus its validated contract. */
interface ResolvedShellBundle {
  /** The resolved feature config. */
  config: ResolvedShellConfig
  /** The validated feature contract. */
  contract: unknown
}

/** The slice of the feature SDK's `/cli` entry this executor drives. */
interface FeaturesCli {
  /** Resolves the app's `feature.config.*` and contract. */
  resolveBuildConfig(input: ResolveBuildConfigInput): Promise<ResolvedShellBundle>
}

/** The write-only VFS surface the SDK generator emits into. */
interface GeneratorTree {
  /** Stages one generated file. */
  write(path: string, content: string): void
}

/** The slice of the feature SDK's `/generators` entry this executor drives. */
interface FeaturesGenerators {
  /** Emits the shell package sources for a feature. */
  generateShell(config: unknown, contract: unknown, tree: GeneratorTree): void
}

/** Shape of the manifest fields this executor reads. */
interface PackageManifest {
  /** Package version string. */
  version: string
}

/**
 * Pack-shell executor for hyperfrontend feature application projects.
 *
 * Generates the app's shell package from its feature config and
 * contract, compiles it, and packs the publishable tarball into the workspace
 * dist tree. The SDK machinery is resolved from the target app's own
 * node_modules, so the artifact is built from the same published bits the app
 * consumes.
 *
 * The compile step is a plain `tsc` run instead of the SDK's `hf build`
 * bundling, which cannot parse its own generated TypeScript entry. The
 * result is a thin shell that declares
 * `@hyperfrontend/features` as a dependency rather than bundling it.
 *
 * @param options - Executor options including the tarball output directory
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the pack
 */
export default async function packShellExecutor(options: PackShellExecutorOptions, context: ExecutorContext): ReturnType<PromiseExecutor> {
  const projectName = context.projectName
  if (!projectName) {
    logger.error('No project name provided')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRoot = projectConfig.root
  const appRoot = join(context.root, projectRoot)
  const outputPath = join(context.root, options.outputPath ?? join('dist', projectRoot, 'shell'))

  if (!existsSync(join(appRoot, 'package.json'))) {
    logger.error(`No package.json found in ${appRoot}`)
    return { success: false }
  }

  // why: The SDK is loaded via absolute paths into the app's node_modules — a bare
  // why: '@hyperfrontend/features' specifier would be rewritten to the workspace lib
  // why: source by nx's tsconfig-path hooks, breaking both provenance and TS-config loading.
  const appRequire = createRequire(join(appRoot, 'package.json'))
  const sdkRoot = join(appRoot, 'node_modules', '@hyperfrontend', 'features')
  let cli: FeaturesCli
  let generators: FeaturesGenerators
  let sdkVersion: string
  try {
    cli = <FeaturesCli>appRequire(join(sdkRoot, 'cli', 'index.cjs.js'))
    generators = <FeaturesGenerators>appRequire(join(sdkRoot, 'generators', 'index.cjs.js'))
    sdkVersion = (<PackageManifest>parse(readFileSync(join(sdkRoot, 'package.json'), 'utf-8'))).version
  } catch (error) {
    logger.error(`Could not resolve @hyperfrontend/features from ${appRoot} — run the install target first`)
    logger.error(String(error))
    return { success: false }
  }

  logger.info(`Packing shell for ${projectName}...`)

  try {
    const { config, contract } = await cli.resolveBuildConfig({
      cwd: appRoot,
      flags: { ci: true, yes: false, dryRun: false, help: false },
    })

    // how: generateShell writes into a VFS tree; the files are collected and staged
    // how: under the app's node_modules so tsc resolves the SDK from the app itself.
    const files = createMap<string, string>()
    generators.generateShell(config, contract, { write: (path, content) => files.set(path, content) })

    const staging = join(appRoot, 'node_modules', '.tmp', 'hf-shell')
    rmSync(staging, { recursive: true, force: true })
    for (const [path, content] of files) {
      const target = join(staging, path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, path === 'package.json' ? thinConnectorManifest(content, sdkVersion) : content)
    }
    writeFileSync(join(staging, 'tsconfig.json'), connectorTsConfig())

    const typescriptBin = join(dirname(appRequire.resolve('typescript/package.json')), 'bin', 'tsc')
    execFileSync(process.execPath, [typescriptBin, '-p', '.'], { cwd: staging, stdio: 'inherit' })

    mkdirSync(outputPath, { recursive: true })
    const packOutput = execFileSync('npm', ['pack', '--pack-destination', outputPath], { cwd: staging, encoding: 'utf-8' })
    const tarball = packOutput.trim().split('\n').pop() ?? ''

    logger.info(`Packed ${join(outputPath, tarball)}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to pack shell for ${projectName}`)
    logger.error(error instanceof Error ? error.message : String(error))
    return { success: false }
  }
}

/**
 * Rewrites the generated connector manifest into the thin-connector shape:
 * runtime dependency on the app's installed SDK version plus an explicit
 * publish file list.
 *
 * @param manifest - The generated package.json contents
 * @param sdkVersion - The `@hyperfrontend/features` version installed in the app
 * @returns The finalized package.json contents
 */
function thinConnectorManifest(manifest: string, sdkVersion: string): string {
  const parsed = <Record<string, unknown>>parse(manifest)
  parsed['dependencies'] = { '@hyperfrontend/features': `^${sdkVersion}` }
  parsed['files'] = ['dist', 'README.md', 'metadata.json']
  return `${stringify(parsed, null, 2)}\n`
}

/**
 * Builds the tsconfig the connector compiles with.
 *
 * @returns The tsconfig.json contents
 */
function connectorTsConfig(): string {
  const tsconfig = {
    compilerOptions: {
      rootDir: 'src',
      outDir: 'dist',
      declaration: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: true,
    },
    include: ['src'],
  }
  return `${stringify(tsconfig, null, 2)}\n`
}
