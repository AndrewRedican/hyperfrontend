/**
 * Reads `show projects [--with-target=<target>] [--json]` and lists the workspace's projects.
 *
 * @module runner/show
 */

import type { ProjectRecord } from '../graph/model'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { hasTarget } from '../graph/workspace'
import { refusal } from './refusal'

/** What the command line expects. */
export const SHOW_USAGE = 'usage: hf show projects [--with-target=<target>] [--json]'

/**
 * The output of `show projects`: the project names, sorted, one per line or as a JSON array.
 *
 * @param argv - The arguments after `show`
 * @param projects - Every project of the workspace
 * @returns The text to print, without its final newline
 * @throws {Error} When the subject is not `projects` or an argument is unknown
 */
export function showProjects(argv: readonly string[], projects: Iterable<ProjectRecord>): string {
  const [subject, ...rest] = argv
  if (subject !== 'projects') throw refusal(`hf show lists projects alone, got ${subject ?? 'nothing'}`)
  let target: string | null = null
  let json = false
  for (const arg of rest) {
    if (arg === '--json') json = true
    else if (arg.startsWith('--with-target=')) target = arg.slice('--with-target='.length)
    else throw refusal(`unknown argument ${arg}`)
  }
  const names = [...projects]
    .filter((project) => target === null || hasTarget(project, target))
    .map((project) => project.name)
    .sort()
  return json ? stringify(names) : names.join('\n')
}
