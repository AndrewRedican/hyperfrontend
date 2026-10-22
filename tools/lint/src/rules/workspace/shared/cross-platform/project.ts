/**
 * Which files the cross-platform rule checks, and whether a project runs on Node: whether any of
 * its runtime sources under `src` imports a `node:` module. Specs, declaration files, the test
 * setup, fixtures and vendored modules are not runtime sources. Each project is read once.
 *
 * @module rules/workspace/shared/cross-platform/project
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { projectRootOf, workspaceRootOf } from '../locate.ts'
import { isPublishableLibrary } from '../project-file.ts'

/** One way a file is selected. */
export interface Selector {
  /** Selects every file of a publishable library. */
  readonly publishableLibraries?: boolean
  /** Selects every file matching one of these workspace-relative globs. */
  readonly files?: readonly string[]
}

/** The directories whose files never count as runtime sources. */
const SKIPPED_DIRECTORIES = createSet(['__fixtures__', 'node_modules'])

/** The TypeScript file names that are not runtime sources: specs, declarations and the test setup. */
const NOT_RUNTIME = /\.(spec|d)\.ts$|^test\.setup\.ts$/

/** Whether each project root runs on Node, as read so far. */
const nodeProjects = createMap<string, boolean>()

/**
 * Whether a directory holds a runtime source importing a `node:` module, at any depth.
 *
 * @param directory - The absolute directory
 * @returns Whether it does
 */
function importsNode(directory: string): boolean {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return false
  }
  return entries.some((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return !SKIPPED_DIRECTORIES.has(entry.name) && importsNode(path)
    return entry.name.endsWith('.ts') && !NOT_RUNTIME.test(entry.name) && readFileSync(path, 'utf8').includes("from 'node:")
  })
}

/**
 * The project root of a file the rule checks.
 *
 * @param path - The file's absolute path
 * @param include - The selectors of the files checked
 * @returns The root of the project owning the file, or null when the file is not checked
 */
export function checkedProject(path: string, include: readonly Selector[]): string | null {
  const root = projectRootOf(dirname(path))
  if (root === null) return null
  const workspace = workspaceRootOf(dirname(path))
  const file = workspace === null ? null : relative(workspace, path).split(sep).join(posix.sep)
  const selected = include.some(
    (selector) =>
      (selector.publishableLibraries === true && isPublishableLibrary(root)) ||
      (file !== null && (selector.files ?? []).some((glob) => posix.matchesGlob(file, glob)))
  )
  return selected ? root : null
}

/**
 * Whether a project runs on Node.
 *
 * @param root - The absolute directory of the project
 * @returns Whether a runtime source of it imports a `node:` module
 */
export function isNodeProject(root: string): boolean {
  let known = nodeProjects.get(root)
  if (known === undefined) {
    known = importsNode(join(root, 'src'))
    nodeProjects.set(root, known)
  }
  return known
}
