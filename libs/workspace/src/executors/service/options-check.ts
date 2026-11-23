/**
 * What the service executor checks before it builds: its options, which the engine hands over
 * unchecked, and the files a service must have.
 *
 * @module executors/service/options-check
 */

import type { ExecutorContext, ProjectConfiguration } from '../../runner/contract'
import type { ServiceExecutorOptions } from './options'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { refusal } from '../../runner/refusal'

/** Where a service build reads and writes, every path absolute. */
export interface ServicePlan {
  /** The project's name. */
  readonly project: string
  /** The task as messages name it, `<project>:<target>`. */
  readonly task: string
  /** The workspace root. */
  readonly workspaceRoot: string
  /** The project's directory. */
  readonly projectRoot: string
  /** The directory of the entry module, `<project root>/src`. */
  readonly sourceRoot: string
  /** The entry module, `<project root>/src/main.ts`. */
  readonly entry: string
  /** The project's `service.config.ts`. */
  readonly configFile: string
  /** The TypeScript configuration the bundle is compiled with. */
  readonly tsConfigPath: string
  /** The directory the build writes. */
  readonly outputPath: string
  /** The globs of the files copied beside the main, relative to the entry module's directory. */
  readonly assets: readonly string[]
}

/** The name and the version a service's manifest states. */
export interface ServiceIdentity {
  /** The package name. */
  readonly name: string
  /** The package version. */
  readonly version: string
}

/** The members the options may hold. */
const OPTION_NAMES: readonly string[] = ['outputPath', 'tsConfig', 'assets', 'verbose']

/** A path that starts with a drive letter. */
const DRIVE = /^[A-Za-z]:/

/**
 * Whether a path lies below a directory, the directory itself not counted.
 *
 * @param directory - The directory, absolute
 * @param path - The path, absolute
 * @returns True when the path is reached from the directory without leaving it
 */
function below(directory: string, path: string): boolean {
  const steps = relative(directory, path)
  return steps !== '' && steps !== '..' && !steps.startsWith(`..${sep}`) && !isAbsolute(steps)
}

/**
 * A path as the file system holds it: links followed and, where the file system ignores case, the case it stores, for as much of the path as exists.
 *
 * @param path - The path, absolute
 * @returns The path the file system would reach
 */
function stored(path: string): string {
  const missing: string[] = []
  let existing = path
  // why: the root of the file system exists, so the climb ends
  while (!existsSync(existing)) {
    missing.unshift(basename(existing))
    existing = dirname(existing)
  }
  return join(realpathSync.native(existing), ...missing)
}

/**
 * Whether a value is a text that names something.
 *
 * @param value - What an option or a manifest holds
 * @returns True for a string that is not empty
 */
function isName(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/**
 * Whether a value is a glob the asset copier can resolve below the entry module's directory.
 *
 * @param value - One member of the `assets` option
 * @returns True for a non-empty string with `/` separators, no `..` segment and no absolute start
 */
function isAssetGlob(value: unknown): boolean {
  return isName(value) && !value.includes('\\') && !value.startsWith('/') && !DRIVE.test(value) && !value.split('/').includes('..')
}

/**
 * Where a service build writes: the directory its options state, else `dist/<project root>`.
 *
 * @param outputPath - The `outputPath` option, when it is set
 * @param workspaceRoot - The workspace root, absolute
 * @param projectRoot - The project's directory, absolute
 * @returns The output directory, absolute
 */
function outputOf(outputPath: unknown, workspaceRoot: string, projectRoot: string): string {
  return typeof outputPath === 'string'
    ? resolve(workspaceRoot, outputPath)
    : join(workspaceRoot, 'dist', relative(workspaceRoot, projectRoot))
}

/**
 * A path as messages name it: from the workspace root, with `/` separators.
 *
 * @param workspaceRoot - The workspace root, absolute
 * @param path - The path, absolute
 * @returns The path from the workspace root
 *
 * @example The entry module of a service, as a message names it
 * ```typescript
 * workspacePath('/repo', '/repo/apps/hello/src/main.ts') // => 'apps/hello/src/main.ts'
 * ```
 */
export function workspacePath(workspaceRoot: string, path: string): string {
  return relative(workspaceRoot, path).split(sep).join(posix.sep)
}

/**
 * Lists what is wrong with the options of a service build, one line per problem and never a value.
 *
 * @param options - The options as the engine hands them over
 * @param workspaceRoot - The workspace root, absolute
 * @param projectRoot - The project's directory, absolute
 * @returns The problems, in the order of the options and then the unknown members in code-unit order; none for options the build can run with
 *
 * @example Options with a misplaced output directory and a member the executor does not take
 * ```typescript
 * optionProblems({ outputPath: 'apps/hello/out', sourcemap: true }, '/repo', '/repo/apps/hello')
 * // => [
 * //   '"outputPath" must name a directory inside the workspace and outside the project.',
 * //   'the options have an unknown member "sourcemap": the service executor takes outputPath, tsConfig, assets and verbose.',
 * // ]
 * ```
 */
export function optionProblems(options: Readonly<Record<string, unknown>>, workspaceRoot: string, projectRoot: string): readonly string[] {
  const problems: string[] = []
  const { outputPath, tsConfig, assets, verbose } = options
  if (outputPath !== undefined && !isName(outputPath)) {
    problems.push('"outputPath" must be a non-empty string.')
  } else {
    const output = outputOf(outputPath, workspaceRoot, projectRoot)
    // why: a link, or another case on a file system that ignores it, would otherwise carry the output into the sources unseen
    const [workspace, project, reached] = [workspaceRoot, projectRoot, output].map(stored) as [string, string, string]
    if (!below(workspace, reached) || reached === project || below(project, reached)) {
      problems.push(
        outputPath === undefined
          ? `"outputPath" must be stated: the default, ${workspacePath(workspaceRoot, output)}, is not a directory outside the project.`
          : '"outputPath" must name a directory inside the workspace and outside the project.'
      )
    }
  }
  if (tsConfig !== undefined && !isName(tsConfig)) problems.push('"tsConfig" must be a non-empty string.')
  if (isArray(assets)) {
    assets.forEach((glob: unknown, index) => {
      if (!isAssetGlob(glob)) {
        problems.push(`"assets[${index}]" must be a glob relative to the entry module's directory: "/" separators, no "..", not absolute.`)
      }
    })
  } else if (assets !== undefined) {
    problems.push('"assets" must be an array.')
  }
  if (verbose !== undefined && typeof verbose !== 'boolean') problems.push('"verbose" must be a boolean.')
  for (const member of keys(options).sort()) {
    if (!OPTION_NAMES.includes(member)) {
      problems.push(`the options have an unknown member "${member}": the service executor takes outputPath, tsConfig, assets and verbose.`)
    }
  }
  return problems
}

/**
 * Plans a service build from its options: where it reads and where it writes.
 *
 * @param options - The options as the engine hands them over
 * @param context - The workspace, the target the task runs on and its project, which the workspace knows
 * @returns The plan, every path absolute
 * @throws {Error} A refusal listing every problem of the options, one line each
 *
 * @example The plan of a service with no option set
 * ```typescript
 * servicePlan({}, context)
 * // => { project: 'hello', task: 'hello:build', projectRoot: '/repo/apps/hello', entry: '/repo/apps/hello/src/main.ts', outputPath: '/repo/dist/apps/hello', assets: [], ... }
 * ```
 */
export function servicePlan(options: Readonly<Record<string, unknown>>, context: ExecutorContext): ServicePlan {
  const project = context.projectName
  const projectRoot = join(context.root, (context.projects[project] as ProjectConfiguration).root)
  const task = `${project}:${context.targetName}`
  const problems = optionProblems(options, context.root, projectRoot)
  if (problems.length > 0) throw refusal([`Invalid options of ${task}:`, ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  const { outputPath, tsConfig, assets } = options as ServiceExecutorOptions
  return {
    project,
    task,
    workspaceRoot: context.root,
    projectRoot,
    sourceRoot: join(projectRoot, 'src'),
    entry: join(projectRoot, 'src', 'main.ts'),
    configFile: join(projectRoot, 'service.config.ts'),
    tsConfigPath: tsConfig === undefined ? join(projectRoot, 'tsconfig.lib.json') : resolve(context.root, tsConfig),
    outputPath: outputOf(outputPath, context.root, projectRoot),
    assets: assets ?? [],
  }
}

/**
 * Reads the name and the version a manifest states.
 *
 * @param file - The project's `package.json`, absolute
 * @param label - The file as messages name it
 * @param problems - The list a problem of the manifest is added to
 * @returns The name and the version, each empty where the manifest states none
 */
function identityOf(file: string, label: string, problems: string[]): ServiceIdentity {
  let manifest: unknown
  try {
    manifest = parse(readFileSync(file, 'utf8'))
  } catch {
    manifest = null
  }
  const { name, version } = (typeof manifest === 'object' && manifest !== null ? manifest : {}) as Record<string, unknown>
  if (!isName(name)) problems.push(`${label} must state a "name" as a non-empty string.`)
  if (!isName(version)) problems.push(`${label} must state a "version" as a non-empty string.`)
  return { name: isName(name) ? name : '', version: isName(version) ? version : '' }
}

/**
 * Checks that the files a service is built from are there, and reads the identity its manifest states.
 *
 * @param plan - Where the build reads
 * @returns The package name and version of the service
 * @throws {Error} A refusal listing every missing file and every member the manifest lacks, one line each
 *
 * @example A project that was not written by the generator
 * ```typescript
 * requiredFiles(plan)
 * // throws:
 * // hello cannot be built:
 * //   - apps/hello/service.config.ts is missing: npx hf generate service writes one.
 * //   - apps/hello/package.json must state a "version" as a non-empty string.
 * ```
 */
export function requiredFiles(plan: ServicePlan): ServiceIdentity {
  const problems: string[] = []
  const label = (path: string): string => workspacePath(plan.workspaceRoot, path)
  if (!existsSync(plan.entry)) problems.push(`${label(plan.entry)} is missing.`)
  if (!existsSync(plan.configFile)) problems.push(`${label(plan.configFile)} is missing: npx hf generate service writes one.`)
  if (!existsSync(plan.tsConfigPath)) problems.push(`${label(plan.tsConfigPath)} is missing.`)
  const manifest = join(plan.projectRoot, 'package.json')
  let identity: ServiceIdentity = { name: '', version: '' }
  if (existsSync(manifest)) identity = identityOf(manifest, label(manifest), problems)
  else problems.push(`${label(manifest)} is missing.`)
  if (problems.length > 0) throw refusal([`${plan.project} cannot be built:`, ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  return identity
}
