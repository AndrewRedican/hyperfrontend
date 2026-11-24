/**
 * A target of a project as a task of it runs, for a rule that judges what the target does: read
 * through the runner's own resolution, so the rule and the runner cannot come to differ.
 *
 * @module lint/shared/resolved-target
 */

import type { WorkspaceConfiguration } from '../../runner/contract'
import type { ResolvedTarget, Target } from '../../runner/targets'
import { join, posix, relative, sep } from 'node:path'
import { readJson } from '../../graph/json'
import { resolveTarget } from '../../runner/targets'
import { readProjectFile } from './project-file'

/** The file that holds the workspace configuration, at the workspace root. */
const WORKSPACE_FILE = 'hf.json'

/**
 * Reads one target of a project as a task of it runs: the target `project.json` writes, merged
 * with the defaults `hf.json` gives it, the tokens of its options replaced. A rule that judges
 * what a target does reads it this way, so that it sees what the runner sees.
 *
 * @param root - The workspace root, absolute
 * @param directory - The project's directory, absolute
 * @param name - The name the project gives the target
 * @returns The resolved target, or null when the directory holds no named project, the project writes no such target, or the runner refuses the defaults `hf.json` gives it
 *
 * @example The directory a project's build writes, whatever states it
 * ```typescript
 * import { readResolvedTarget } from '@hyperfrontend/workspace/lint'
 *
 * readResolvedTarget('/repo', '/repo/libs/core', 'build')?.options['outputPath']
 * // => 'dist/libs/core' where hf.json gives the build executor outputPath: 'dist/{projectRoot}'
 * readResolvedTarget('/repo', '/repo/libs/core', 'deploy') // => null, the project writes no such target
 * ```
 */
export function readResolvedTarget(root: string, directory: string, name: string): ResolvedTarget | null {
  const project = readProjectFile(directory)
  const written = project?.targets?.[name]
  if (typeof project?.name !== 'string' || typeof written !== 'object' || written === null) return null
  try {
    // why: the root of the workspace's own project is written as a dot, as the graph writes it
    const projectRoot = relative(root, directory).split(sep).join(posix.sep) || '.'
    // why: the runner reads a missing or malformed hf.json as an empty configuration, and so does this
    const configuration = readJson<WorkspaceConfiguration>(join(root, WORKSPACE_FILE)) ?? {}
    return resolveTarget(configuration, { name: project.name, root: projectRoot }, name, written as Target)
  } catch {
    // why: defaults the runner refuses, such as a pattern for a key, run no task of the project, so there is no target to judge, and the refusal is the runner's to report
    return null
  }
}
