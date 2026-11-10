/**
 * What a task resolves to under one `hf.json`: its executor, its options, its dependencies and
 * every input expanded, as one comparable text, so a change to the file selects a task only where
 * the task resolves differently afterwards.
 *
 * @module graph/affected/resolution
 */

import type { InputDefinition, WorkspaceFile } from '../inputs'
import type { ProjectRecord } from '../model'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { expandWith, IMPLICIT_INPUTS, isCompatibleTarget } from '../inputs'

/** One input of a task, expanded: the patterns of its own files, of its dependencies' files, or of the files of the projects it names. */
interface ExpandedInput {
  /** The patterns, `{projectRoot}` still unreplaced. */
  readonly patterns: readonly string[]
  /** Whose files the patterns select: the task's own project, its dependencies, or the projects named. */
  readonly of: 'self' | 'dependencies' | readonly string[]
}

/**
 * What a target resolves to for a project under a workspace file: the defaults that apply, the
 * defaults keyed by the executor the project's target names, the project's own target, and every
 * input expanded through the file's named inputs, including the dependency inputs written as
 * `^name` and the inputs naming other projects.
 *
 * @param file - The `hf.json` the resolution runs under
 * @param project - The project whose target is resolved
 * @param target - The target's name
 * @returns The resolution as text: equal texts mean the file's change leaves the task as it was
 *
 * @example Comparing a task under the file at the base and at the head
 * ```typescript
 * targetResolution(previousWorkspace, project, 'build') === targetResolution(readWorkspaceFile(root), project, 'build')
 * // => true when the change to hf.json touched nothing the build of this project reads
 * ```
 */
export function targetResolution(file: WorkspaceFile, project: ProjectRecord, target: string): string {
  const own = project.configuration?.targets?.[target]
  const defaults = file.targetDefaults?.[target]
  const applicable = defaults !== undefined && isCompatibleTarget(own, defaults) ? defaults : null
  // why: the runner reads the entry keyed by the executor the project names before the entry keyed by the target's name, so a change to either is a change to the task
  const byExecutor = own?.executor === undefined ? null : (file.targetDefaults?.[own.executor] ?? null)
  const inputs = (own?.inputs as readonly InputDefinition[] | undefined) ?? applicable?.inputs ?? IMPLICIT_INPUTS
  const expanded: ExpandedInput[] = inputs.map((input) => {
    if (typeof input === 'string')
      return input.startsWith('^')
        ? { patterns: expandWith(file, project, [input.slice(1)]), of: 'dependencies' }
        : { patterns: expandWith(file, project, [input]), of: 'self' }
    if (input.dependencies === true) return { patterns: expandWith(file, project, [input.input ?? 'default']), of: 'dependencies' }
    if (input.projects !== undefined && input.projects !== 'self')
      return {
        patterns: expandWith(file, project, [input.input ?? 'default']),
        of: typeof input.projects === 'string' ? [input.projects] : input.projects,
      }
    return { patterns: expandWith(file, project, [input]), of: 'self' }
  })
  return stringify({ defaults: applicable, byExecutor, own: own ?? null, inputs: expanded })
}
