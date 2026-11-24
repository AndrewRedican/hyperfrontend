/**
 * A disposable workspace for the statistics packages rule: three publishable libraries, one of
 * them not yet released, beside a publishable library that states no package name and a library
 * that is not published, and a directory outside any workspace. The service's configuration is
 * never written: each case lints its own text as the file's.
 *
 * @module rules/workspace/__test-utils__/statistics-workspace
 */

import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** A publishable library's project file. */
const PUBLISHABLE = stringify({ projectType: 'library', targets: { build: {}, publish: {} } })

/** The files, by path below the directory that holds the workspace and its neighbour. */
const FILES: Readonly<Record<string, string>> = {
  'tracked/hf.json': '{}',
  'tracked/libs/logging/project.json': PUBLISHABLE,
  'tracked/libs/logging/package.json': stringify({ name: '@hyperfrontend/logging', version: '1.4.0' }),
  'tracked/libs/utils/json/project.json': PUBLISHABLE,
  'tracked/libs/utils/json/package.json': stringify({ name: '@hyperfrontend/json-utils', version: '0.0.0' }),
  'tracked/plugins/nexus/project.json': PUBLISHABLE,
  'tracked/plugins/nexus/package.json': stringify({ name: '@hyperfrontend/nexus', version: '2.0.1' }),
  'tracked/libs/unnamed/project.json': PUBLISHABLE,
  'tracked/libs/unnamed/package.json': '{}',
  'tracked/libs/internal/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
  'tracked/libs/internal/package.json': stringify({ name: '@hyperfrontend/internal', version: '0.1.0' }),
  'outside/notes.txt': 'no workspace here\n',
}

/** The service's configuration, workspace-relative. */
export const CONFIG = 'apps/statistics/service.config.ts'

/** The package names of the workspace's publishable libraries, in ascending order. */
export const PACKAGES: readonly string[] = ['@hyperfrontend/json-utils', '@hyperfrontend/logging', '@hyperfrontend/nexus']

/** The workspace-relative path of each publishable library, by package name. */
export const LIBRARY_PATHS: Readonly<Record<string, string>> = {
  '@hyperfrontend/json-utils': 'libs/utils/json',
  '@hyperfrontend/logging': 'libs/logging',
  '@hyperfrontend/nexus': 'plugins/nexus',
}

/** The paths the spec lints under. */
export interface StatisticsWorkspace {
  /** The workspace's root. */
  readonly root: string
  /** A directory no workspace holds. */
  readonly outside: string
  /** Removes both. */
  readonly remove: () => void
}

/**
 * Writes the workspace and its neighbour to a temporary directory.
 *
 * @returns Their paths
 */
export function createStatisticsWorkspace(): StatisticsWorkspace {
  const directory = createTempDir({ prefix: 'lint-statistics-', tree: FILES })
  return { root: directory.resolve('tracked'), outside: directory.resolve('outside'), remove: directory.remove }
}

/**
 * A list of entries written one per line with a trailing comma, the way the service's
 * configuration writes it.
 *
 * @param entries - The entries as written, quotes included
 * @returns The array's source
 */
export function lines(entries: readonly string[]): string {
  return `[\n${entries.map((entry) => `      ${entry},\n`).join('')}    ]`
}

/**
 * A configuration in the shape of the service's own.
 *
 * @param packages - The source of the `packages` value
 * @returns The file's text
 */
export function configuration(packages: string): string {
  return [
    '/**',
    ' * The configuration the service is built with.',
    ' */',
    'export default {',
    '  immutable: {',
    `    packages: ${packages},`,
    '  },',
    '}',
    '',
  ].join('\n')
}
