/**
 * The workspace as the graph reads it: the files git knows, less what `.nxignore` leaves out,
 * the projects found by their `project.json` or `package.json`, and the `lint` target the
 * workspace linter gives every project but the root and the ones its plugin entry excludes.
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

/** A plugin entry of `nx.json`, as far as the exclusions are read. */
interface PluginEntry {
  /** The plugin module. */
  readonly plugin?: string
  /** The project files the plugin leaves alone. */
  readonly exclude?: readonly string[]
}

/** The workspace configuration, as far as the plugins are read. */
interface PluginsConfiguration {
  /** The plugins. */
  readonly plugins?: readonly (string | PluginEntry)[]
}

/** The options of the inferred `lint` target. */
export interface LintTargetOptions {
  /** The directory the command runs in, workspace-relative. */
  readonly cwd: string
}

/** What the inferred `lint` target tells Nx about itself. */
export interface LintTargetMetadata {
  /** The technologies the target belongs to. */
  readonly technologies: readonly string[]
  /** What the target does. */
  readonly description: string
}

/** The options of the inferred `lint` target. */
export interface LintTargetOptions {
  /** The directory the command runs in, workspace-relative. */
  readonly cwd: string
}

/** What the inferred `lint` target tells Nx about itself. */
export interface LintTargetMetadata {
  /** The technologies the target belongs to. */
  readonly technologies: readonly string[]
  /** What the target does. */
  readonly description: string
}

/** The inferred `lint` target of a project, in the shape the linter's Nx plugin answers with. */
export interface LintTarget {
  /** The command run. */
  readonly command: string
  /** Its options. */
  readonly options: LintTargetOptions
  /** Its metadata. */
  readonly metadata: LintTargetMetadata
}

/** The largest output git may answer with. */
const LIST_BUFFER = 64 * 1024 * 1024

/** The linter's entry, workspace-relative. */
export const LINT_ENTRY = 'tools/lint/bin/lint.ts'

/** The plugin entry of `nx.json` whose exclusions the inference honours. */
export const LINT_PLUGIN = './tools/lint/src/nx/plugin.ts'

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
    maxBuffer: LIST_BUFFER,
  })
  const ignores = nxIgnores(root)
  return listed.split('\0').filter((path) => path !== '' && !matchesAny(ignores, path))
}

/**
 * The patterns `.nxignore` lists, compiled.
 *
 * @param root - The workspace root
 * @returns The globs, none when the file is absent
 */
export function nxIgnores(root: string): ReturnType<typeof compileGlob>[] {
  const file = join(root, '.nxignore')
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
    const projectType = configuration?.projectType ?? (manifest?.nx?.['projectType'] as string | undefined)
    // why: Nx reads a manifest-only project under the applications directory, and the workspace itself, as an application.
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
 * The `lint` target of a project, as the linter's Nx plugin infers it.
 *
 * @param root - The project root, workspace-relative and POSIX
 * @returns The target, running the linter on the project from its root
 */
export function lintTarget(root: string): LintTarget {
  return {
    command: `node ${posix.relative(root, LINT_ENTRY)} .`,
    options: { cwd: root },
    metadata: { technologies: ['lint'], description: 'Runs the workspace linter on the project.' },
  }
}

/**
 * The project files the linter's plugin entry excludes, compiled.
 *
 * @param root - The workspace root, absolute
 * @returns The globs, none without the entry
 */
function lintExclusions(root: string): ReturnType<typeof compileGlob>[] {
  const plugins = readJson<PluginsConfiguration>(join(root, 'nx.json'))?.plugins ?? []
  const entry = plugins.find((plugin): plugin is PluginEntry => typeof plugin !== 'string' && plugin.plugin === LINT_PLUGIN)
  return (entry?.exclude ?? []).map(compileGlob)
}

/**
 * Gives every project but the workspace root a `lint` target where it declares none, as the
 * linter's Nx plugin does, leaving out the projects whose files the plugin entry excludes.
 *
 * @param root - The workspace root, absolute
 * @param projects - The projects, by name
 * @returns The same projects, the inferred target added to their configuration
 */
export function inferLintTargets(root: string, projects: ReadonlyMap<string, ProjectRecord>): Map<string, ProjectRecord> {
  const exclusions = lintExclusions(root)
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
    const target: TargetRecord = { executor: 'nx:run-commands', options: { command: lintTarget(project.root).command, cwd: project.root } }
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
