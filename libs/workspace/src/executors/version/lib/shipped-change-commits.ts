/* lint-disable workspace/lib-require-jsdoc-example */
import type { DependencyCommitResolver } from '@hyperfrontend/versioning/flow/models'
import type { Reason, TaskDecision, WorkspaceGraph } from '../../../graph'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { ReasonRule } from '../../../graph'

/** The target whose selection says a library must be rebuilt. */
export const BUILD_TARGET = 'build'

/**
 * The project a reason reaches a library through, when the reason can make the library due a
 * release without touching its own files.
 *
 * A reason counts when it starts from a file another project owns: code the build reaches through
 * imports, or a declared input such as the builder. A global configuration file, or any other
 * file the workspace root owns, rebuilds every library and releases none.
 *
 * @param graph - The workspace graph, asked which project owns a file
 * @param projectName - The library whose build was selected
 * @param reason - One reason its build was selected
 * @returns The name of the owning project, or null when the reason does not count
 */
export function reachedThrough(graph: Pick<WorkspaceGraph, 'projectOf'>, projectName: string, reason: Reason): string | null {
  if (reason.file === null || reason.rule === ReasonRule.GlobalConfig) return null
  const owner = graph.projectOf(reason.file)
  return owner === null || owner.name === projectName || owner.root === '.' ? null : owner.name
}

/** What the resolver reads about the history after a base commit. */
export interface ChangeSources {
  /** The build tasks selected for the changes since the base commit, each with its reasons, read with the engine input left out. */
  readonly affectedBuilds: (baseCommit: string) => readonly TaskDecision[]
  /** The hashes of the commits since the base commit that changed each file, by workspace-relative path. */
  readonly commitsByFile: (baseCommit: string) => ReadonlyMap<string, ReadonlySet<string>>
}

/**
 * Names the commits that make a library due a release without touching its own files: the ones
 * that changed code its build reaches through imports, or the toolchain that builds it.
 *
 * @param graph - The workspace graph, asked which project owns a file
 * @param sources - The affected builds and the commits by file after a base commit
 * @returns The resolver the version flow calls for each library
 */
export function createShippedChangeResolver(graph: Pick<WorkspaceGraph, 'projectOf'>, sources: ChangeSources): DependencyCommitResolver {
  return ({ projectName, baseCommit }) => {
    const reaching = createMap<string, Set<string>>()
    if (baseCommit === null) return reaching
    const decision = sources.affectedBuilds(baseCommit).find((item) => item.task === `${projectName}:${BUILD_TARGET}`)
    if (decision === undefined) return reaching
    const commits = sources.commitsByFile(baseCommit)
    for (const reason of decision.reasons) {
      const owner = reachedThrough(graph, projectName, reason)
      if (owner === null) continue
      const hashes = reaching.get(owner) ?? createSet<string>()
      for (const hash of commits.get(reason.file as string) ?? []) hashes.add(hash)
      reaching.set(owner, hashes)
    }
    return reaching
  }
}
