/**
 * The root README lists every publishable library in its package sections: each section named
 * in the options must exist, and every library under `libs/` and `plugins/` must be linked by
 * its repository path in one of them.
 *
 * @module rules/workspace/root-readme-packages
 */

import type { MarkdownNode, RuleContext } from '@hyperfrontend/linter'
import { basename, dirname, posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { publishableLibraries } from './shared/libraries.ts'
import { workspaceRootOf } from './shared/locate.ts'
import { readPackageFile, readProjectFile } from './shared/project-file.ts'

/** The rule's options. */
interface Options {
  /** The level-two headings the packages are listed under. */
  readonly sections?: readonly string[]
}

/** The sections looked for when the options name none. */
const DEFAULT_SECTIONS = ['Main Packages', 'Internal Packages']

/** The marker a repository link carries before the path. */
const BLOB_MAIN = '/blob/main/'

/**
 * The content under each level-two heading.
 *
 * @param lines - The document's lines
 * @returns The content by heading text
 */
function sectionsOf(lines: readonly string[]): Map<string, string> {
  const sections = createMap<string, string>()
  let title: string | null = null
  let collected: string[] = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (title !== null) sections.set(title, collected.join('\n'))
      title = line.slice(3).trim()
      collected = []
    } else if (title !== null) collected.push(line)
  }
  if (title !== null) sections.set(title, collected.join('\n'))
  return sections
}

/**
 * The library paths a section links to the repository.
 *
 * @param content - The section's content
 * @returns The paths under `libs/` or `plugins/`
 */
function mentionedPaths(content: string): string[] {
  const paths: string[] = []
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('|--') || line.startsWith('| --') || line.includes('Package') || line.includes('Description')) continue
    const at = line.indexOf(BLOB_MAIN)
    if (at === -1) continue
    const after = line.slice(at + BLOB_MAIN.length)
    const end = after.indexOf(')')
    if (end === -1) continue
    const path = after.slice(0, end)
    if (path.startsWith(`libs${posix.sep}`) || path.startsWith(`plugins${posix.sep}`)) paths.push(path)
  }
  return paths
}

export default defineRule<Options | undefined, MarkdownNode>({
  id: 'workspace/root-readme-packages',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<Options | undefined, MarkdownNode>) {
    const path = context.file.path
    const directory = dirname(path)
    if (basename(path) !== 'README.md' || workspaceRootOf(directory) !== directory) return {}
    const titles = context.options?.sections ?? DEFAULT_SECTIONS
    return {
      root(node) {
        const { start, end } = node.position
        const whole = {
          start: start.offset,
          end: end.offset,
          at: { line: start.line, column: start.column, endLine: end.line, endColumn: end.column },
        }
        const sections = sectionsOf(context.file.text.split(/\r?\n/))
        const present = titles.filter((title) => sections.has(title))
        for (const title of titles)
          if (!sections.has(title)) context.report({ ...whole, message: `Root README.md must have a '## ${title}' section` })
        if (present.length !== titles.length) return
        const mentioned = createSet(present.flatMap((title) => mentionedPaths(sections.get(title) as string)))
        for (const library of publishableLibraries(directory)) {
          if (mentioned.has(library.path)) continue
          const name = readPackageFile(library.directory)?.name ?? readProjectFile(library.directory)?.name
          context.report({
            ...whole,
            message: `Publishable library '${typeof name === 'string' ? name : basename(library.directory)}' (${library.path}) is not listed in any of these sections: ${titles.map((title) => `'${title}'`).join(', ')}`,
          })
        }
      },
    }
  },
})
