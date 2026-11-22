/**
 * Where a release takes the repository its changelog links to. The workspace's root manifest
 * comes first, as it does for the manifest a build publishes, so a library that states no
 * repository of its own links to the same place whatever remote the clone was made from.
 *
 * @module executors/version/lib/changelog-repository
 */

import type { FlowConfig } from '@hyperfrontend/versioning/flow/models'
import type { PackageJsonForRepository } from '@hyperfrontend/versioning/repository/parse'
import { join } from 'node:path'
import { inferRepositoryFromPackageJsonObject } from '@hyperfrontend/versioning/repository/parse'
import { readJson } from '../../../graph/json'

/**
 * The repository the version flow of a workspace links its changelog entries to: the one the
 * root manifest states, in full or as a shorthand. Where the root manifest states none the flow
 * can read, is missing or does not parse, the flow is left to infer it, from the project's own
 * manifest first and the `origin` remote after it.
 *
 * @param workspaceRoot - The workspace root, absolute
 * @returns The repository of the root manifest, or `inferred` for the flow to find one itself
 *
 * @example A workspace whose root manifest states its repository, and one whose root manifest states none
 * ```typescript
 * changelogRepository('/repo') // => { platform: 'github', baseUrl: 'https://github.com/acme/monorepo' }
 * changelogRepository('/scratch') // => 'inferred'
 * ```
 */
export function changelogRepository(workspaceRoot: string): NonNullable<FlowConfig['repository']> {
  return inferRepositoryFromPackageJsonObject(readJson<PackageJsonForRepository>(join(workspaceRoot, 'package.json')) ?? {}) ?? 'inferred'
}
