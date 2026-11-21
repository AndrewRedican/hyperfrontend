/**
 * The packages a project takes from a registry rather than from the workspace. A project that
 * installs for itself, from a lock file of its own, resolves a package name from that install
 * wherever nothing puts the workspace's path aliases in front of it: no TypeScript configuration
 * at its root inherits the base configuration, and no target of it runs an executor of the engine
 * that loads files through the aliases. For such a project a name its lock file takes from a
 * registry means that package, whatever the workspace aliases the name to. Everything is read
 * from tracked files, so two checkouts of one commit answer alike whatever they have installed.
 *
 * @module graph/own-install
 */

import type { Node } from '@hyperfrontend/linter'
import type { ProjectRecord } from './model'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { parseCode } from '@hyperfrontend/linter/helpers'
import { targetExecutor } from './inputs'
import { registryInstalls } from './lockfile'

/** The file holding the workspace's path aliases. */
const BASE_TSCONFIG = 'tsconfig.base.json'

/** The lock file of a project that installs for itself. */
const LOCK_FILE = 'package-lock.json'

/** The name of a TypeScript configuration at a project's root. */
const TSCONFIG = /^tsconfig.*\.json$/

/** What `extends` writes for a configuration a package ships: a bare name, as against a relative or an absolute path. */
const PACKAGE_SPECIFIER = /^(?![a-zA-Z]:[\\/])[@\w]/

/** The executors of the engine that load a project's files through the workspace's path aliases: the test executor through all of them, the e2e executor through those of the test runtime. */
const ALIASING_EXECUTORS: readonly string[] = ['@hyperfrontend/workspace:test', '@hyperfrontend/workspace:e2e']

/** The answers given so far, by the file set of the workspace they were read from, then by project. */
const answers = createWeakMap<ReadonlySet<string>, Map<string, ReadonlySet<string>>>()

/**
 * The configurations a TypeScript configuration extends, as it writes them.
 *
 * @param text - The configuration's text, which may carry comments and trailing commas
 * @returns What its `extends` names, none when it has none, or null when the text cannot be read
 */
function extendedBy(text: string): string[] | null {
  // why: a tsconfig may carry comments and trailing commas, which the code parser reads as an expression where a JSON reader gives up
  const program = parseCode(`(${text}\n)`, '.ts').tree
  const root = program === null ? undefined : ((program.body as readonly Node[])[0] as Node).expression
  if (typeof root !== 'object' || root.kind !== 'ObjectExpression') return null
  const written = (root.properties as readonly Node[])
    .filter((property) => property.key?.value === 'extends')
    .flatMap((property) => {
      const value = property.value as Node
      return value.kind === 'ArrayExpression' ? (value.elements as readonly (Node | null)[]) : [value]
    })
    .map((literal) => literal?.value)
  return written.every((path) => typeof path === 'string') ? (written as string[]) : null
}

/**
 * Whether a TypeScript configuration at a project's root inherits the workspace's path aliases:
 * one of them extends the base configuration, directly or through other configurations of the
 * workspace. A configuration a package ships cannot extend the workspace's, so it ends a chain
 * without being read; one that is missing or cannot be read counts as inheriting, which keeps
 * the aliases.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace's files
 * @param project - The project whose configurations are followed
 * @returns True when a chain reaches the base configuration or cannot be followed
 */
function inheritsAliases(root: string, files: ReadonlySet<string>, project: ProjectRecord): boolean {
  const pending = project.files.filter((file) => posix.dirname(file) === project.root && TSCONFIG.test(posix.basename(file)))
  const seen = createSet<string>()
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue
    seen.add(file)
    const path = join(root, file)
    // why: the file list can name a tracked file the working tree has deleted
    const extended = existsSync(path) ? extendedBy(readFileSync(path, 'utf8')) : null
    if (extended === null) return true
    for (const written of extended) {
      if (PACKAGE_SPECIFIER.test(written)) continue
      const named = posix.normalize(posix.join(posix.dirname(file), written))
      const target = [named, `${named}.json`].find((candidate) => files.has(candidate))
      if (target === undefined || target === BASE_TSCONFIG) return true
      pending.push(target)
    }
  }
  return false
}

/**
 * The packages a project takes from a registry rather than from the workspace: those its own lock
 * file installs from a registry, when no TypeScript configuration at its root inherits the
 * workspace's path aliases and none of its targets runs the engine's test or e2e executor. The
 * workspace's root project takes none, since its own files run under the aliases.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace's files
 * @param project - The project asked about
 * @returns The package names, none for a project the workspace's aliases reach
 *
 * @example A site that installs the published library, beside a tool that reads its source
 * ```typescript
 * const { root, files, projects } = workspaceGraph(workspaceRoot)
 * // apps/site has its own package-lock.json and a tsconfig.json that extends nothing of the workspace
 * registryPackages(root, files, projects.get('site')!) // => Set { '@acme/data', 'vite' }
 * // tools/seed has a lock file too, but its tsconfig.json extends ../../tsconfig.base.json
 * registryPackages(root, files, projects.get('tool-seed')!).size // => 0
 * ```
 */
export function registryPackages(root: string, files: ReadonlySet<string>, project: ProjectRecord): ReadonlySet<string> {
  const known = answers.get(files) ?? createMap<string, ReadonlySet<string>>()
  answers.set(files, known)
  let packages = known.get(project.name)
  if (packages === undefined) {
    const lock = posix.join(project.root, LOCK_FILE)
    const own =
      project.root !== '.' &&
      files.has(lock) &&
      !keys(project.configuration?.targets ?? {}).some((target) =>
        ALIASING_EXECUTORS.includes(targetExecutor(root, project, target)?.value as string)
      ) &&
      !inheritsAliases(root, files, project)
    packages = own ? registryInstalls(join(root, lock)) : createSet<string>()
    known.set(project.name, packages)
  }
  return packages
}
