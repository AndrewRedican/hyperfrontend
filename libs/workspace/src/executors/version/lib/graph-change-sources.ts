import type { FlowConfig } from '@hyperfrontend/versioning/flow/models'
import type { TaskDecision, WorkspaceGraph } from '../../../graph'
import type { ChangeSources } from './shipped-change-commits'
import { execFileSync } from 'node:child_process'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { changeSet, EdgeKind, selectAffected } from '../../../graph'
import { BUILD_TARGET, createShippedChangeResolver } from './shipped-change-commits'

/** The byte that opens each commit in the log format below, which no path or hash contains. */
const RECORD = '\u0000'

/**
 * Reads which commits changed which files from the output of `git log --format=%x00%H --name-only`.
 *
 * @param output - The log output: for each commit a NUL, its hash, then the paths it changed, one per line
 * @returns The hashes of the commits that changed each path
 */
export function parseCommitFiles(output: string): Map<string, Set<string>> {
  const byFile = createMap<string, Set<string>>()
  for (const record of output.split(RECORD)) {
    const [hash, ...paths] = record.split(/\r?\n/).filter((line) => line !== '')
    for (const path of paths) {
      const hashes = byFile.get(path) ?? createSet<string>()
      hashes.add(hash)
      byFile.set(path, hashes)
    }
  }
  return byFile
}

/**
 * The build tasks a change between two revisions selects, with the reasons a release answers to.
 *
 * The graph is read without its tool edges. With them, a file the build executor happens to
 * import selects every build as a changed tool, and that label also hides whether the library
 * itself reaches the file. Without them a build is selected for its own files, for the projects
 * its inputs declare (the toolchain), for code it reaches through imports, or for global
 * configuration, and each reason says which.
 *
 * @param graph - The workspace graph at the head
 * @param workspaceRoot - The workspace root, absolute
 * @param base - The base revision
 * @param head - The head revision
 * @returns The selected build tasks
 */
export function selectReleaseBuilds(graph: WorkspaceGraph, workspaceRoot: string, base: string, head: string): readonly TaskDecision[] {
  const withoutTools: WorkspaceGraph = { ...graph, records: graph.records.filter((edge) => edge.kind !== EdgeKind.Tool) }
  // why: the graph at the base is left out; it only lets a deleted module name what it reached, and a library that imported one changes its own file in the same commit
  return (
    selectAffected({ graph: withoutTools, changes: changeSet(workspaceRoot, base, head), targets: [BUILD_TARGET] }).get(BUILD_TARGET)
      ?.selected ?? []
  )
}

/**
 * The change sources of a real workspace: the owned graph's selection of build tasks, and git's
 * record of which commit changed which file. Both are remembered by base commit, because one
 * answer serves every library released from the same commit.
 *
 * @param graph - The workspace graph at the head
 * @param workspaceRoot - The workspace root, absolute
 * @returns The sources for the resolver
 */
export function graphChangeSources(graph: WorkspaceGraph, workspaceRoot: string): ChangeSources {
  const builds = createMap<string, readonly TaskDecision[]>()
  const files = createMap<string, ReadonlyMap<string, ReadonlySet<string>>>()
  return {
    affectedBuilds(baseCommit) {
      let selected = builds.get(baseCommit)
      if (selected === undefined) {
        selected = selectReleaseBuilds(graph, workspaceRoot, baseCommit, 'HEAD')
        builds.set(baseCommit, selected)
      }
      return selected
    },
    commitsByFile(baseCommit) {
      let byFile = files.get(baseCommit)
      if (byFile === undefined) {
        // why: without rename detection a moved file is listed under both its paths, as the graph's change set lists it
        byFile = parseCommitFiles(
          execFileSync('git', ['log', '--format=%x00%H', '--name-only', '--no-renames', `${baseCommit}..HEAD`], {
            cwd: workspaceRoot,
            encoding: 'utf8',
            maxBuffer: 1 << 28,
          })
        )
        files.set(baseCommit, byFile)
      }
      return byFile
    },
  }
}

/**
 * The scope filtering a version flow runs with in this workspace: the configured one, plus the
 * resolver that makes a library due a release when the graph selects its build for a change to
 * code it ships or to the toolchain that builds it.
 *
 * @param scopeFiltering - The scope filtering the target configures, if any
 * @param graph - The workspace graph at the head
 * @param workspaceRoot - The workspace root, absolute
 * @returns The scope filtering to hand the flow
 */
export function withShippedChanges(
  scopeFiltering: FlowConfig['scopeFiltering'],
  graph: WorkspaceGraph,
  workspaceRoot: string
): NonNullable<FlowConfig['scopeFiltering']> {
  return { ...scopeFiltering, dependencyCommits: createShippedChangeResolver(graph, graphChangeSources(graph, workspaceRoot)) }
}
