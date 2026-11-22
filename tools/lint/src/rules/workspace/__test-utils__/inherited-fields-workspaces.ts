/**
 * Disposable workspaces for the inherited fields rule, side by side in one temporary directory:
 * one whose root manifest states all four fields with its repository in full, one that states
 * only a repository as one string, one that states only a null repository, and one that has no
 * root manifest. Each holds a publishable library; the first is itself a publishable project and
 * also holds a tool, an application and an end-to-end project.
 *
 * @module rules/workspace/__test-utils__/inherited-fields-workspaces
 */

import { join, parse } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The fields the first workspace's root manifest states, which the build writes into each package. */
export const ROOT_FIELDS = {
  repository: { type: 'git', url: 'git+https://example.invalid/acme/widgets.git' },
  bugs: { url: 'https://example.invalid/acme/widgets/issues' },
  homepage: 'https://example.invalid/acme/widgets#readme',
  author: { name: 'Acme', url: 'https://example.invalid' },
} as const

/** A workspace by the directory it is written to. */
export type WorkspaceName = 'full' | 'shorthand' | 'nulled' | 'bare'

/** What each workspace's root manifest states beyond its name, or null for a workspace without a root manifest. */
const ROOT_MANIFESTS: Readonly<Record<WorkspaceName, Readonly<Record<string, unknown>> | null>> = {
  full: ROOT_FIELDS,
  shorthand: { repository: 'github:acme/widgets' },
  nulled: { repository: null },
  bare: null,
}

/** The project file of a publishable library. */
const PUBLISHABLE = stringify({ name: 'lib-fixture', projectType: 'library', targets: { build: {}, publish: {} } })

/** The project files only the first workspace holds: itself as a publishable project, a tool, an application and an end-to-end project. */
const OTHER_PROJECTS: Readonly<Record<string, string>> = {
  'full/project.json': PUBLISHABLE,
  'full/tools/gamma/project.json': stringify({ name: 'tool-gamma', projectType: 'library', targets: { build: {}, test: {} } }),
  'full/apps/site/project.json': stringify({ name: 'site', projectType: 'application', targets: { build: {}, publish: {} } }),
  'full/apps/alpha-e2e/project.json': stringify({ name: 'alpha-e2e', projectType: 'application', targets: { e2e: {} } }),
}

/**
 * The files every workspace holds.
 *
 * @param name - The workspace's directory
 * @param manifest - What its root manifest states, or null for none
 * @returns The files by path below the temporary directory
 */
function workspaceFiles(name: string, manifest: Readonly<Record<string, unknown>> | null): [string, string][] {
  return [
    [`${name}/hf.json`, '{}'],
    [`${name}/libs/alpha/project.json`, PUBLISHABLE],
    ...(manifest === null
      ? []
      : [[`${name}/package.json`, stringify({ name: 'workspace', private: true, ...manifest })] as [string, string]]),
  ]
}

/** The paths the specs lint as. */
export interface InheritedFieldsWorkspaces {
  /** The directory that holds the workspaces. */
  readonly root: string
  /** A file of a workspace, whether or not it exists. */
  readonly file: (workspace: WorkspaceName, path: string) => string
  /** A manifest at the root of the file system, where no directory above it can hold a workspace, whatever sits above the temporary directory. */
  readonly outside: string
  /** Removes the workspaces. */
  readonly remove: () => void
}

/**
 * Writes the workspaces to a temporary directory.
 *
 * @returns Their paths
 *
 * @example Linting a text as a library's manifest
 * ```typescript
 * const workspaces = createInheritedFieldsWorkspaces()
 * workspaces.file('full', join('libs', 'alpha', 'package.json')) // => '<temporary directory>/full/libs/alpha/package.json'
 * workspaces.remove()
 * ```
 */
export function createInheritedFieldsWorkspaces(): InheritedFieldsWorkspaces {
  const directory = createTempDir({
    prefix: 'lint-inherited-fields-',
    tree: { ...OTHER_PROJECTS, ...fromEntries(entries(ROOT_MANIFESTS).flatMap(([name, manifest]) => workspaceFiles(name, manifest))) },
  })
  return {
    root: directory.path,
    file: (workspace, path) => directory.resolve(workspace, path),
    outside: join(parse(directory.path).root, 'package.json'),
    remove: directory.remove,
  }
}
