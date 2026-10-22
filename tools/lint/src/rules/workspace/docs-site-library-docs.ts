/**
 * Every markdown document of a listed library has its page on the documentation site: the
 * README at the library's main page, a nested README at the page of its directory, and any
 * other document at the page named after it.
 *
 * @module rules/workspace/docs-site-library-docs
 */

import type { Node } from '../../code/model.ts'
import { existsSync, readdirSync } from 'node:fs'
import { join, posix } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { pagesDirectory, siteListingListeners } from './shared/docs-site.ts'

/** The documents that never get a page. */
const SKIPPED_FILES = createSet(['CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md'])

/** The directories never searched. */
const SKIPPED_DIRECTORIES = createSet(['node_modules', 'dist', '.git', 'coverage', '.nx'])

/**
 * The markdown documents below a directory, library-relative and POSIX.
 *
 * @param directory - The absolute directory searched
 * @param relative - Its path below the library
 * @param found - Where the documents go
 */
function documents(directory: string, relative: string, found: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue
    const path = relative === '' ? entry.name : `${relative}/${entry.name}`
    if (entry.isDirectory()) documents(join(directory, entry.name), path, found)
    else if (entry.name.endsWith('.md') && !SKIPPED_FILES.has(entry.name)) found.push(path)
  }
}

/**
 * The page a document belongs to, below the library's main page.
 *
 * @param document - The document, library-relative
 * @returns The page's subpath, empty for the main page
 */
function pageOf(document: string): string {
  if (posix.basename(document) !== 'README.md') return posix.basename(document, '.md').toLowerCase()
  const directory = posix.dirname(document).toLowerCase()
  if (directory === '.' || directory === 'src' || directory === 'lib') return ''
  const withoutSource = directory.startsWith('src/') ? directory.slice(4) : directory
  return withoutSource === 'lib' ? '' : withoutSource.startsWith('lib/') ? withoutSource.slice(4) : withoutSource
}

export default defineRule<undefined, Node>({
  id: 'workspace/docs-site-library-docs',
  language: 'code',
  fixable: false,
  create(context) {
    return siteListingListeners(context, ({ root, entries }) => {
      for (const entry of entries) {
        if (entry.readmePath === null) continue
        const library = join(root, posix.dirname(entry.readmePath))
        if (!existsSync(library)) continue
        const found: string[] = []
        documents(library, '', found)
        for (const document of found) {
          const page = posix.join(pagesDirectory(entry), pageOf(document), 'page.tsx')
          if (existsSync(join(root, page))) continue
          context.report({
            start: entry.node.start,
            end: entry.node.end,
            message: `Library '${entry.name}' markdown file '${document}' is missing corresponding docs page at ${page}`,
          })
        }
      }
    })
  },
})
