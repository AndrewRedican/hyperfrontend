/**
 * Every publishable library is wired into continuous integration: a status workflow of its own
 * and a coverage entry in the main workflow. Read from the main workflow's raw text.
 *
 * @module rules/workspace/lib-ci-workflows
 */

import type { RuleContext, TextDocument } from '@hyperfrontend/linter'
import { existsSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { positionAt } from '@hyperfrontend/linter/helpers'
import { publishableLibraries } from './shared/libraries.ts'
import { workspaceRootOf } from './shared/locate.ts'
import { readProjectFile } from './shared/project-file.ts'

/**
 * The coverage flag of a library: its folder name, utilities suffixed `-utils`.
 *
 * @param path - The library's workspace-relative path
 * @returns The name the workflow uploads coverage under
 */
function coverageFlag(path: string): string {
  const parts = path.split(posix.sep)
  return parts.length >= 3 && parts[0] === 'libs' && parts[1] === 'utils' ? `${parts[2]}-utils` : parts[parts.length - 1]
}

export default defineRule<undefined, TextDocument>({
  id: 'workspace/lib-ci-workflows',
  language: 'text',
  fixable: false,
  create(context: RuleContext<undefined, TextDocument>) {
    const path = context.file.path
    const workflows = dirname(path)
    const workspaceRoot = workspaceRootOf(workflows)
    if (basename(path) !== 'ci-main.yml' || workspaceRoot === null || workflows !== join(workspaceRoot, '.github', 'workflows')) return {}
    return {
      document(node) {
        const endPosition = positionAt(context.file.lines, node.end)
        const whole = {
          start: node.start,
          end: node.end,
          at: { line: 1, column: 1, endLine: endPosition.line, endColumn: endPosition.column },
        }
        const report = (message: string): void => context.report({ ...whole, message })
        for (const library of publishableLibraries(workspaceRoot)) {
          const projectName = readProjectFile(library.directory)?.name
          const name = typeof projectName === 'string' ? projectName : `lib-${basename(library.directory)}`
          const flag = coverageFlag(library.path)
          if (!existsSync(join(workflows, `ci-${name}.yml`))) {
            report(`Publishable library '${name}' (${library.path}) is missing status workflow. Create: .github/workflows/ci-${name}.yml`)
          }
          if (!context.file.text.includes(`"${flag}:${library.path}"`)) {
            report(
              `Publishable library '${name}' (${library.path}) is missing coverage entry in ci-main.yml. Add: "${flag}:${library.path}"`
            )
          }
        }
      },
    }
  },
})
