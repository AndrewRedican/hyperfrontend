/**
 * What a task reads, derived from its inputs after the `nx.json` defaults apply: which of its own
 * files are inputs, whether and through which named input it reads its dependencies, which other
 * projects' files it names, and which edge kinds carry a change to it. Two rules go beyond the
 * inputs: a type-only import does not reach a target that strips types, and a build reaches its
 * dependencies from its production files alone, since its artifact derives from nothing else.
 *
 * @module graph/affected/targets
 */

import type { Glob } from '@hyperfrontend/linter/helpers'
import type { InputDefinition } from '../inputs'
import type { EdgeKind, ProjectRecord } from '../model'
import type { Role } from '../roles'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compileGlob } from '@hyperfrontend/linter/helpers'
import { expandInputs, selfInputs, targetInputs } from '../inputs'
import { EdgeKind as Kinds } from '../model'
import { PRODUCTION_EXCLUSIONS, Role as Roles } from '../roles'
import { ALL_KINDS } from './closure'

/** Whether a file of a given role is an input. */
export type FileFilter = (path: string, role: Role) => boolean

/** Whether files of a role count. */
export type RoleFilter = (role: Role) => boolean

/** Whether a file of a project with the given root is an input, for a dependency or a named project. */
export type OwnerFilter = (ownerRoot: string) => FileFilter

/** Another project whose files a task names as inputs. */
export interface ProjectInput {
  /** The project. */
  readonly project: string
  /** Which of its files count, given its root. */
  readonly files: OwnerFilter
}

/** What a task reads. */
export interface TaskInputs {
  /** Whether one of the project's own files is an input. */
  readonly self: FileFilter
  /** Whether one of the project's own files is a start of the task's dependency closure. */
  readonly reach: FileFilter
  /** Which files of the project's dependencies count, given a dependency's root, or null when the task reads no dependency input. */
  readonly dependencies: OwnerFilter | null
  /** The other projects whose files the task names. */
  readonly projects: readonly ProjectInput[]
  /** The edge kinds that carry a change to the task. */
  readonly kinds: ReadonlySet<EdgeKind>
  /** A key identifying the start set, shared by tasks reading the same own files. */
  readonly key: string
}

/** The targets that strip types before running, so a type-only import does not reach them. */
export const TYPE_BLIND_TARGETS = freeze(['test', 'lint'] as const)

/** The targets whose artifact derives from production files alone, so only those reach their dependencies. */
export const PRODUCTION_REACH_TARGETS = freeze(['build'] as const)

/** The roles the `production` named input excludes. */
const PRODUCTION_EXCLUDED: ReadonlySet<Role> = createSet<Role>([Roles.Spec, Roles.TestConfig, Roles.LintConfig])

/** The characters of an extended glob the workspace compiler does not read. */
const EXTGLOB = /[?*+@!]\(/

/**
 * The edge kinds that carry a change to a target: every kind, less `type` for a target that runs
 * under type stripping.
 *
 * @param target - The target's name
 * @returns The kinds that carry a change to it
 */
export function relevantKinds(target: string): ReadonlySet<EdgeKind> {
  if (!(TYPE_BLIND_TARGETS as readonly string[]).includes(target)) return ALL_KINDS
  return createSet([...ALL_KINDS].filter((kind) => kind !== Kinds.Type))
}

/**
 * A pattern with the project and workspace placeholders replaced, as a path relative to the
 * workspace.
 *
 * @param pattern - The pattern as `nx.json` writes it
 * @param projectRoot - The root `{projectRoot}` stands for
 * @returns The pattern over workspace-relative paths
 */
function placePattern(pattern: string, projectRoot: string): string {
  const placed = pattern.replace('{projectRoot}', projectRoot).replace('{workspaceRoot}/', '')
  return placed.startsWith('./') ? placed.slice(2) : placed
}

/**
 * Whether the files of a role count under a list of input patterns: every role, unless the
 * patterns carry the `production` exclusions, which leave specs and test and lint configuration out.
 *
 * @param patterns - The expanded patterns
 * @returns Whether files of a role count
 */
export function roleFilterOf(patterns: readonly string[]): RoleFilter {
  const production = patterns.some((pattern) => (PRODUCTION_EXCLUSIONS as readonly string[]).includes(pattern))
  return production ? (role) => !PRODUCTION_EXCLUDED.has(role) : () => true
}

/**
 * Whether a file is an input under a list of patterns: it matches a positive pattern and no
 * negative one, where the `production` exclusions are read by role and any other extended glob is
 * left unapplied, so a file is never excluded by a pattern the compiler cannot read.
 *
 * @param patterns - The expanded patterns, `{projectRoot}` unreplaced
 * @param projectRoot - The root `{projectRoot}` stands for
 * @returns Whether a file of a role is an input
 */
export function fileFilterOf(patterns: readonly string[], projectRoot: string): FileFilter {
  const positives: Glob[] = []
  const negatives: Glob[] = []
  for (const pattern of patterns) {
    const negative = pattern.startsWith('!')
    const text = negative ? pattern.slice(1) : pattern
    if ((PRODUCTION_EXCLUSIONS as readonly string[]).includes(pattern) || EXTGLOB.test(text)) continue
    ;(negative ? negatives : positives).push(compileGlob(placePattern(text, projectRoot)))
  }
  const roles = roleFilterOf(patterns)
  return (path, role) => roles(role) && positives.some((glob) => glob.test(path)) && !negatives.some((glob) => glob.test(path))
}

/**
 * A filter over the files of whichever project owns them, built once per root from the patterns.
 *
 * @param patterns - The expanded patterns, `{projectRoot}` unreplaced
 * @returns The filter by owner root
 */
function ownerFilterOf(patterns: readonly string[]): OwnerFilter {
  const filters = createMap<string, FileFilter>()
  return (ownerRoot) => {
    let filter = filters.get(ownerRoot)
    if (filter === undefined) {
      filter = fileFilterOf(patterns, ownerRoot)
      filters.set(ownerRoot, filter)
    }
    return filter
  }
}

/**
 * The names of the dependency inputs a target reads: `^name`, `{ input, dependencies: true }`, or
 * `default` for a dependency fileset.
 *
 * @param inputs - The target's inputs
 * @returns The names, none when the target reads no dependency input
 */
function dependencyInputs(inputs: readonly InputDefinition[]): string[] {
  const names: string[] = []
  for (const input of inputs) {
    if (typeof input === 'string') {
      if (input.startsWith('^')) names.push(input.slice(1))
    } else if (input.dependencies === true) names.push(input.input ?? 'default')
  }
  return names
}

/**
 * What a task reads.
 *
 * @param root - The workspace root, absolute
 * @param project - The project whose task is read
 * @param target - The target's name
 * @returns The own-file filter, the dependency filter, the named projects and the relevant kinds
 */
export function taskInputs(root: string, project: ProjectRecord, target: string): TaskInputs {
  const own = selfInputs(root, project, target)
  const configured = targetInputs(root, project, target).value
  const names = dependencyInputs(configured)
  const filters = names.map((name) => ownerFilterOf(expandInputs(root, project, [name])))
  const projects: ProjectInput[] = []
  for (const input of configured) {
    if (typeof input === 'string' || input.projects === undefined || input.projects === 'self') continue
    const files = ownerFilterOf(expandInputs(root, project, [input.input ?? 'default']))
    for (const name of typeof input.projects === 'string' ? [input.projects] : input.projects) projects.push({ project: name, files })
  }
  const kinds = relevantKinds(target)
  const self = fileFilterOf(own, project.root)
  const production = (PRODUCTION_REACH_TARGETS as readonly string[]).includes(target)
  return {
    self,
    reach: production ? (path, role) => self(path, role) && !PRODUCTION_EXCLUDED.has(role) : self,
    dependencies: filters.length === 0 ? null : (ownerRoot) => (path, role) => filters.some((filter) => filter(ownerRoot)(path, role)),
    projects,
    kinds,
    key: `${project.name}\u0000${own.join(',')}\u0000${production ? 'production' : 'all'}\u0000${[...kinds].join(',')}`,
  }
}
