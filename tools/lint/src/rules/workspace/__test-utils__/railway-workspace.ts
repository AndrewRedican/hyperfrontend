/**
 * Disposable workspaces for the Railway service pin rule: one whose single Railway project
 * installs `@hyperfrontend/features` from the registry beside projects deployed elsewhere, and one
 * whose Railway projects install it from no registry, lack it, or have no lock at all.
 *
 * @module rules/workspace/__test-utils__/railway-workspace
 */

import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTempDir } from '@hyperfrontend/testing/fs'

/**
 * A project file deploying to a provider.
 *
 * @param name - What the workspace calls the project
 * @param deploy - The deploy metadata
 * @returns The file text
 */
const project = (name: string, deploy: Record<string, string>): string => `${stringify({ name, metadata: { deploy } }, null, 2)}\n`

/**
 * A lock installing `@hyperfrontend/features`.
 *
 * @param version - The installed version
 * @param resolved - Where it was installed from
 * @returns The file text
 */
const lock = (version: string, resolved: string): string =>
  `${stringify({ packages: { '': {}, 'node_modules/@hyperfrontend/features': { version, resolved } } }, null, 2)}\n`

/** The files of both workspaces, by path below the directory that holds them. */
const FILES: Readonly<Record<string, string>> = {
  'clean/apps/alpha/project.json': project('demo-alpha', { provider: 'railway', service: 'alpha' }),
  'clean/apps/alpha/package-lock.json': lock('1.2.3', 'https://registry.npmjs.org/@hyperfrontend/features/-/features-1.2.3.tgz'),
  'clean/apps/site/project.json': project('demo-site', { provider: 'vercel', service: 'site' }),
  'clean/apps/unnamed/project.json': project('demo-unnamed', { provider: 'railway' }),
  'locks/apps/beta/project.json': project('demo-beta', { provider: 'railway', service: 'beta' }),
  'locks/apps/beta/package-lock.json': `${stringify({ packages: { '': {} } })}\n`,
  'locks/apps/gamma/project.json': project('demo-gamma', { provider: 'railway', service: 'gamma' }),
  'locks/apps/gamma/package-lock.json': lock('1.2.3', 'file:../vendor/features-1.2.3.tgz'),
  'locks/apps/delta/project.json': project('demo-delta', { provider: 'railway', service: 'delta' }),
}

/** The paths the specs lint as. */
export interface RailwayWorkspaces {
  /** The directory holding both workspaces. */
  readonly root: string
  /** A file of a workspace, whether or not it exists. */
  readonly file: (workspace: 'clean' | 'locks', path: string) => string
  /** Removes both workspaces. */
  readonly remove: () => void
}

/**
 * Writes both workspaces to a temporary directory.
 *
 * @returns Their paths
 */
export function createRailwayWorkspaces(): RailwayWorkspaces {
  const directory = createTempDir({ prefix: 'lint-railway-', tree: FILES })
  return {
    root: directory.path,
    file: (workspace, path) => directory.resolve(workspace, path),
    remove: directory.remove,
  }
}
