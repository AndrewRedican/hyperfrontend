/**
 * The workspace as the graph reads it: the files git knows, less what `.hfignore` leaves out,
 * the projects found by their `project.json` or `package.json`, and the `lint` target the
 * workspace linter gives every project but the root and the ones `hf.json` excludes under `lint.exclude`.
 *
 * @module graph/workspace
 */

import type { PackageManifest, ProjectConfiguration, ProjectRecord, TargetRecord } from './model'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { compileGlob, matchesAny } from '@hyperfrontend/linter/helpers'
import { gitEnvironment } from './git'
import { RUN_COMMANDS } from './model'

/** The project files found in one directory. */
interface ProjectFiles {
  /** The manifest, or null when the directory has none. */
  manifest: PackageManifest | null
  /** The configuration, or null when the directory has none. */
  configuration: ProjectConfiguration | null
}

/** The compiler options of the base tsconfig, as far as the aliases are read. */
interface AliasOptions {
  /** The path aliases, each to its targets. */
  readonly paths?: Readonly<Record<string, readonly string[]>>
}

/** The base tsconfig, as far as the aliases are read. */
interface BaseTsconfig {
  /** The compiler options. */
  readonly compilerOptions?: AliasOptions
}

/** The linter's settings in `hf.json`. */
interface LintSettings {
  /** The command of the inferred `lint` target, run from the project's root; `{workspaceRoot}` in it is the path from there to the workspace root. */
  readonly command?: string
  /** The project files whose projects get no inferred `lint` target. */
  readonly exclude?: readonly string[]
}

/** The workspace configuration, as far as the linter's settings are read. */
interface LintConfiguration {
  /** The linter's settings. */
  readonly lint?: LintSettings
}

/** The largest output git may answer with. */
const LIST_BUFFER = 64 * 1024 * 1024

/** The command of the inferred `lint` target where `hf.json` names none: the linter's own executable, on the project. */
export const LINT_COMMAND = 'hf-lint .'

/** The token of a lint command that stands for the path from the project to the workspace root. */
const WORKSPACE_ROOT_TOKEN = '{workspaceRoot}'

/**
 * The files of a workspace: those git tracks or could track, less the ignored, as
 * workspace-relative POSIX paths.
 *
 * @param root - The workspace root, absolute
 * @returns The paths, in git's order
 */
export function listFiles(root: string): string[] {
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    env: gitEnvironment(root),
    maxBuffer: LIST_BUFFER,
  })
  const ignores = ignoredPatterns(root)
  return listed.split('\0').filter((path) => path !== '' && !matchesAny(ignores, path))
}

/**
 * The patterns `.hfignore` lists, compiled.
 *
 * @param root - The workspace root
 * @returns The globs, none when the file is absent
 */
export function ignoredPatterns(root: string): ReturnType<typeof compileGlob>[] {
  const file = join(root, '.hfignore')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map(compileGlob)
}

/**
 * Reads a JSON file, or nothing when it does not exist or does not parse.
 *
 * @param path - The file's absolute path
 * @returns The value, or null
 */
export function readJson<Value>(path: string): Value | null {
  if (!existsSync(path)) return null
  try {
    return parse(readFileSync(path, 'utf8')) as Value
  } catch {
    return null
  }
}

/**
 * The path aliases of a workspace, from its `tsconfig.base.json`.
 *
 * @param root - The workspace root, absolute
 * @returns Each alias to its targets, none when the file or its paths are absent
 */
export function readAliases(root: string): Map<string, readonly string[]> {
  return createMap(entries(readJson<BaseTsconfig>(join(root, 'tsconfig.base.json'))?.compilerOptions?.paths ?? {}))
}

/**
 * The tags a project carries: its manifest's visibility and keywords as `npm:` tags when a
 * configuration sits beside the manifest, then the configuration's own.
 *
 * @param manifest - The manifest, or null
 * @param configuration - The configuration, or null
 * @returns The tags, in the order Nx lists them
 */
function tagsOf(manifest: PackageManifest | null, configuration: ProjectConfiguration | null): string[] {
  const tags: string[] = []
  // why: Nx reads a manifest's tags only for a package beside a project.json, since the workspace declares no package-manager workspaces.
  if (manifest !== null && configuration !== null) {
    tags.push(manifest.private === true ? 'npm:private' : 'npm:public')
    for (const keyword of manifest.keywords ?? []) tags.push(`npm:${keyword}`)
  }
  tags.push(...(configuration?.tags ?? []))
  return tags
}

/**
 * The projects of a workspace: one per directory holding a `project.json`, and one per
 * directory holding a `package.json` alone, named by the configuration or the manifest.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace's files
 * @returns The projects by name, with their files assigned to the deepest owning root
 */
export function discoverProjects(root: string, files: readonly string[]): Map<string, ProjectRecord> {
  const roots = createMap<string, ProjectFiles>()
  for (const file of files) {
    const base = posix.basename(file)
    if (base !== 'project.json' && base !== 'package.json') continue
    const directory = posix.dirname(file)
    const entry = roots.get(directory) ?? { manifest: null, configuration: null }
    if (base === 'project.json') entry.configuration = readJson<ProjectConfiguration>(join(root, file))
    else entry.manifest = readJson<PackageManifest>(join(root, file))
    roots.set(directory, entry)
  }
  const owned = createMap<string, string[]>([...roots.keys()].map((directory) => [directory, []]))
  for (const file of files) {
    let directory = posix.dirname(file)
    while (!owned.has(directory) && directory !== '.') directory = posix.dirname(directory)
    owned.get(directory)?.push(file)
  }
  const projects = createMap<string, ProjectRecord>()
  for (const [directory, { manifest, configuration }] of roots) {
    const name = configuration?.name ?? manifest?.name
    if (name === undefined) continue
    const projectType = configuration?.projectType
    // why: a project that names no type is an application when it is the workspace itself or sits under the applications directory, and a library elsewhere.
    const type =
      projectType === undefined
        ? directory === '.' || directory.startsWith(`apps${posix.sep}`)
          ? 'app'
          : 'lib'
        : projectType === 'application'
          ? 'app'
          : 'lib'
    projects.set(name, {
      name,
      root: directory,
      type,
      tags: tagsOf(manifest, configuration),
      implicitDependencies: configuration?.implicitDependencies ?? [],
      files: owned.get(directory) as string[],
      manifest,
      configuration,
    })
  }
  return inferLintTargets(root, projects)
}

/**
 * The command of the `lint` target inferred for a project.
 *
 * @param root - The project root, workspace-relative and POSIX
 * @param command - The command as `hf.json` writes it
 * @returns The command as it runs from the project's root
 */
export function lintCommand(root: string, command: string): string {
  return command.replaceAll(WORKSPACE_ROOT_TOKEN, posix.relative(root, '.'))
}

/**
 * What `hf.json` says about the inferred `lint` target, under `lint`.
 *
 * @param root - The workspace root, absolute
 * @returns The settings, empty without the block
 */
function lintSettings(root: string): LintSettings {
  return readJson<LintConfiguration>(join(root, 'hf.json'))?.lint ?? {}
}

/**
 * Gives every project but the workspace root a `lint` target where it declares none, leaving
 * out the projects whose project files `hf.json` lists under `lint.exclude`. The target runs the
 * command `hf.json` names under `lint.command`, or the linter's own executable. A project with
 * an `install` target lints after it.
 *
 * @param root - The workspace root, absolute
 * @param projects - The projects, by name
 * @returns The same projects, the inferred target added to their configuration
 */
export function inferLintTargets(root: string, projects: ReadonlyMap<string, ProjectRecord>): Map<string, ProjectRecord> {
  const settings = lintSettings(root)
  const exclusions = (settings.exclude ?? []).map(compileGlob)
  const inferred = createMap<string, ProjectRecord>()
  for (const [name, project] of projects) {
    const files = project.files.filter(
      (file) => posix.dirname(file) === project.root && (posix.basename(file) === 'project.json' || posix.basename(file) === 'package.json')
    )
    const skip = project.root === '.' || hasTarget(project, 'lint') || files.every((file) => matchesAny(exclusions, file))
    if (skip) {
      inferred.set(name, project)
      continue
    }
    const target: TargetRecord = {
      executor: RUN_COMMANDS,
      options: { command: lintCommand(project.root, settings.command ?? LINT_COMMAND), cwd: project.root },
      // why: the dependency rules read the versions a project installs for itself, so its lint waits for that install
      ...(hasTarget(project, 'install') ? { dependsOn: ['install'] } : {}),
    }
    const configuration: ProjectConfiguration = {
      ...(project.configuration ?? {}),
      targets: { ...(project.configuration?.targets ?? {}), lint: target },
    }
    inferred.set(name, { ...project, configuration })
  }
  return inferred
}

/**
 * Whether a project declares a target.
 *
 * @param project - The project whose targets are read
 * @param target - The target's name
 * @returns True when the project's configuration declares it
 */
export function hasTarget(project: ProjectRecord, target: string): boolean {
  return project.configuration?.targets?.[target] !== undefined
}
