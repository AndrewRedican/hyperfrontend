/**
 * Every publishable library is wired into continuous integration: a path filter and a matrix
 * entry in the libraries workflow, a status workflow of its own, and a coverage entry in the
 * main workflow. Read from the libraries workflow's raw lines.
 *
 * @module rules/workspace/lib-ci-workflows
 */

import type { RuleContext } from '../../engine/rule.ts'
import type { TextDocument } from '../../languages/text.ts'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { defineRule } from '../../engine/rule.ts'
import { positionAt } from '../../text/lines.ts'
import { publishableLibraries } from './shared/libraries.ts'
import { workspaceRootOf } from './shared/locate.ts'
import { readProjectFile } from './shared/project-file.ts'

/** How far below a filter's name its path may sit. */
const FILTER_REACH = 5

/**
 * The coverage flag of a library: its folder name, utilities suffixed `-utils`.
 *
 * @param path - The library's workspace-relative path
 * @returns The name the workflow filters on
 */
function coverageFlag(path: string): string {
  const parts = path.split(posix.sep)
  return parts.length >= 3 && parts[0] === 'libs' && parts[1] === 'utils' ? `${parts[2]}-utils` : parts[parts.length - 1]
}

/**
 * Whether the libraries workflow filters on a library's path under its flag.
 *
 * @param lines - The workflow's lines
 * @param flag - The coverage flag
 * @param path - The workspace-relative path
 * @returns True when the path follows the flag within a few lines
 */
function hasPathFilter(lines: readonly string[], flag: string, path: string): boolean {
  const pattern = `'${posix.join(path, '**')}'`
  return lines.some((line, index) => {
    const trimmed = line.trim()
    return (
      (trimmed === `${flag}:` || trimmed.startsWith(`${flag}: `)) &&
      lines.slice(index, index + FILTER_REACH).some((candidate) => candidate.includes(pattern))
    )
  })
}

/**
 * Whether the libraries workflow adds a library to the matrix.
 *
 * @param lines - The workflow's lines
 * @param name - The project name
 * @param flag - The coverage flag
 * @param path - The workspace-relative path
 * @returns True when an `add_if_changed` line names all four
 */
function hasMatrixEntry(lines: readonly string[], name: string, flag: string, path: string): boolean {
  return lines.some((line) => {
    const trimmed = line.trim()
    return (
      !trimmed.startsWith('#') &&
      trimmed.startsWith('add_if_changed') &&
      trimmed.includes(`filter.outputs.${flag}`) &&
      trimmed.includes(`"${name}"`) &&
      trimmed.includes(`"${path}"`) &&
      trimmed.includes(`"${flag}"`)
    )
  })
}

export default defineRule<undefined, TextDocument>({
  id: 'workspace/lib-ci-workflows',
  language: 'text',
  fixable: false,
  create(context: RuleContext<undefined, TextDocument>) {
    const path = context.file.path
    const workflows = dirname(path)
    const workspaceRoot = workspaceRootOf(workflows)
    if (basename(path) !== 'ci-libraries.yml' || workspaceRoot === null || workflows !== join(workspaceRoot, '.github', 'workflows'))
      return {}
    return {
      document(node) {
        const endPosition = positionAt(context.file.lines, node.end)
        const whole = {
          start: node.start,
          end: node.end,
          at: { line: 1, column: 1, endLine: endPosition.line, endColumn: endPosition.column },
        }
        const report = (message: string): void => context.report({ ...whole, message })
        let main: string
        try {
          main = readFileSync(join(workflows, 'ci-main.yml'), 'utf8')
        } catch {
          report('Cannot find .github/workflows/ci-main.yml in workspace')
          return
        }
        const lines = context.file.text.split(/\r?\n/)
        for (const library of publishableLibraries(workspaceRoot)) {
          const projectName = readProjectFile(library.directory)?.name
          const name = typeof projectName === 'string' ? projectName : `lib-${basename(library.directory)}`
          const flag = coverageFlag(library.path)
          if (!hasPathFilter(lines, flag, library.path)) {
            report(
              `Publishable library '${name}' (${library.path}) is missing path filter in ci-libraries.yml. Add: ${flag}: - '${library.path}/**'`
            )
          }
          if (!hasMatrixEntry(lines, name, flag, library.path)) {
            report(
              `Publishable library '${name}' (${library.path}) is missing matrix entry in ci-libraries.yml. Add: add_if_changed "\${{ steps.filter.outputs.${flag} }}" "${name}" "${library.path}" "${flag}"`
            )
          }
          if (!existsSync(join(workflows, `ci-${name}.yml`))) {
            report(`Publishable library '${name}' (${library.path}) is missing status workflow. Create: .github/workflows/ci-${name}.yml`)
          }
          if (!main.includes(`"${flag}:${library.path}"`)) {
            report(
              `Publishable library '${name}' (${library.path}) is missing coverage entry in ci-main.yml. Add: "${flag}:${library.path}"`
            )
          }
        }
      },
    }
  },
})
