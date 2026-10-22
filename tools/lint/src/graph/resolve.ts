/**
 * What an import specifier names, seen from a file: a workspace project through a path alias,
 * a package name or a relative path, an npm package, a Node built-in, or nothing known.
 *
 * @module graph/resolve
 */

import type { Glob } from '../files/glob.ts'
import type { ProjectRecord, Resolution } from './model.ts'
import { existsSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { matchesAny } from '../files/glob.ts'

/** The Node modules a bare name may import. */
const BUILTINS = createSet<string>(builtinModules)

/** The extensions tried for a path written without one, in order. */
const EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json']

/** What the resolver knows of the workspace. */
export interface Resolver {
  /** The workspace root, absolute. */
  readonly root: string
  /** The files, workspace-relative. */
  readonly files: ReadonlySet<string>
  /** The projects by name. */
  readonly projects: ReadonlyMap<string, ProjectRecord>
  /** The path aliases, from `tsconfig.base.json`, each to its targets. */
  readonly aliases: ReadonlyMap<string, readonly string[]>
  /** The projects by package name. */
  readonly packages: ReadonlyMap<string, ProjectRecord>
}

/**
 * The file a path names, with an extension or an index file supplied when the path has none.
 *
 * @param files - The workspace's files
 * @param path - The workspace-relative path, POSIX
 * @returns The file, or null when none matches
 */
export function fileOf(files: ReadonlySet<string>, path: string): string | null {
  if (files.has(path)) return path
  const candidates = [
    ...EXTENSIONS.map((extension) => `${path}${extension}`),
    ...EXTENSIONS.map((extension) => posix.join(path, `index${extension}`)),
  ]
  // why: TypeScript sources import each other by their emitted `.js` names.
  const swapped = /\.(m|c)?js$/.exec(path)
  if (swapped !== null)
    candidates.unshift(path.replace(/\.(m|c)?js$/, swapped[1] === undefined ? '.ts' : `.${swapped[1]}ts`), path.replace(/\.js$/, '.tsx'))
  return candidates.find((candidate) => files.has(candidate)) ?? null
}

/**
 * A path pattern with its wildcard, the first `*`, standing for a value taken literally.
 *
 * @param pattern - The pattern, as a tsconfig path alias or target writes it
 * @param value - What the wildcard stands for
 * @returns The pattern with the value in place of its wildcard, or as is when it has none
 */
export function substituteWildcard(pattern: string, value: string): string {
  const star = pattern.indexOf('*')
  return star === -1 ? pattern : `${pattern.slice(0, star)}${value}${pattern.slice(star + 1)}`
}

/** Each project table's projects by root, built on first use. */
const rootIndexes = createWeakMap<ReadonlyMap<string, ProjectRecord>, Map<string, ProjectRecord>>()

/**
 * The project owning a file: the one with the deepest root above it, the workspace itself last.
 *
 * @param projects - The projects by name
 * @param file - The workspace-relative path
 * @returns The project, or null when the workspace has no root project
 */
export function projectOfFile(projects: ReadonlyMap<string, ProjectRecord>, file: string): ProjectRecord | null {
  let index = rootIndexes.get(projects)
  if (index === undefined) {
    index = createMap([...projects.values()].map((project) => [project.root, project] as const))
    rootIndexes.set(projects, index)
  }
  for (let path = file; path !== '.' && posix.dirname(path) !== path; path = posix.dirname(path)) {
    const project = index.get(path)
    if (project !== undefined) return project
  }
  return index.get('.') ?? null
}

/**
 * The projects importable by their package names: those the root manifest's `workspaces` globs
 * cover, since Nx resolves a package name to a workspace project only for a package-manager
 * workspace.
 *
 * @param workspaces - The globs of the root manifest's `workspaces`, compiled
 * @param projects - The projects by name
 * @returns The map, empty when the root declares no workspaces
 */
export function packagesOf(workspaces: readonly Glob[], projects: ReadonlyMap<string, ProjectRecord>): Map<string, ProjectRecord> {
  const packages = createMap<string, ProjectRecord>()
  for (const project of projects.values()) {
    const name = project.manifest?.name
    if (name !== undefined && !packages.has(name) && matchesAny(workspaces, project.root)) packages.set(name, project)
  }
  return packages
}

/**
 * Resolves a specifier seen from a file as Nx does: a relative path or an alias target names the
 * project whose root holds it, whether or not the file exists; an alias that names no project
 * falls through to the package lookup.
 *
 * @param resolver - What is known of the workspace
 * @param from - The importing file, workspace-relative
 * @param specifier - The specifier as written
 * @returns What it names
 */
export function resolveSpecifier(resolver: Resolver, from: string, specifier: string): Resolution {
  if (specifier.startsWith('./') || specifier.startsWith('../'))
    return locate(resolver, posix.normalize(posix.join(posix.dirname(from), specifier)))
  const aliased = viaAlias(resolver, specifier)
  if (aliased !== null) return aliased
  if (specifier.startsWith('node:') || BUILTINS.has(specifier)) return { kind: 'builtin' }
  const packageName = packageNameOf(specifier)
  const owner = resolver.packages.get(packageName)
  // why: Nx resolves a package the importing file can load from a node_modules directory as npm before it looks for a workspace project of that name.
  if (owner !== undefined && !isInstalled(resolver.root, from, packageName)) return { kind: 'project', project: owner, file: null }
  return { kind: 'npm', name: packageName }
}

/** Each resolver's alias resolutions by specifier, which do not depend on the importing file. */
const aliasResolutions = createWeakMap<Resolver, Map<string, Resolution | null>>()

/**
 * The project the first alias target of a specifier names that some project holds.
 *
 * @param resolver - What is known of the workspace
 * @param specifier - A specifier that is not relative
 * @returns The resolution, or null when no alias target lies in a project
 */
function viaAlias(resolver: Resolver, specifier: string): Resolution | null {
  let memo = aliasResolutions.get(resolver)
  if (memo === undefined) {
    memo = createMap()
    aliasResolutions.set(resolver, memo)
  }
  const known = memo.get(specifier)
  if (known !== undefined) return known
  const targets = aliasTargets(resolver.aliases, specifier).map((target) => locate(resolver, target))
  const found = targets.find((resolution) => resolution.kind === 'project') ?? null
  memo.set(specifier, found)
  return found
}

/**
 * Whether a package is installed in a node_modules directory above a file, up to the workspace root.
 *
 * @param root - The workspace root, absolute
 * @param from - The importing file, workspace-relative
 * @param packageName - The package looked for
 * @returns Whether a directory for it exists
 */
function isInstalled(root: string, from: string, packageName: string): boolean {
  let directory = posix.dirname(from)
  for (;;) {
    if (existsSync(join(root, directory, 'node_modules', packageName, 'package.json'))) return true
    if (directory === '.') return false
    directory = posix.dirname(directory)
  }
}

/**
 * The project holding a path, with the file the path names when one exists.
 *
 * @param resolver - What is known of the workspace
 * @param path - The workspace-relative path
 * @returns The project, or nothing known when no project holds the path
 */
function locate(resolver: Resolver, path: string): Resolution {
  const project = projectOfFile(resolver.projects, path)
  return project === null ? { kind: 'unknown' } : { kind: 'project', project, file: fileOf(resolver.files, path) }
}

/**
 * The targets of the alias a specifier matches, exactly or through a wildcard.
 *
 * @param aliases - The path aliases
 * @param specifier - The specifier matched against the patterns
 * @returns The target paths, none when no alias matches
 */
function aliasTargets(aliases: ReadonlyMap<string, readonly string[]>, specifier: string): readonly string[] {
  const exact = aliases.get(specifier)
  if (exact !== undefined) return exact
  for (const [pattern, targets] of aliases) {
    const star = pattern.indexOf('*')
    if (star === -1) continue
    const prefix = pattern.slice(0, star)
    const suffix = pattern.slice(star + 1)
    if (specifier.length < prefix.length + suffix.length || !specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue
    const captured = specifier.slice(prefix.length, specifier.length - suffix.length)
    return targets.map((target) => substituteWildcard(target, captured))
  }
  return []
}

/**
 * The package a specifier names: its first segment, or its first two for a scoped package.
 *
 * @param specifier - The bare specifier
 * @returns The package name, scope included
 */
export function packageNameOf(specifier: string): string {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : (segments[0] as string)
}
