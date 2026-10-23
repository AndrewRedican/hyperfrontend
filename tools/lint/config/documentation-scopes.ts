/**
 * Where the workspace holds its documentation to the standards of a published package: the
 * blocks that turn on three packaged Markdown rules for the project a lint process runs in. The
 * root's own Markdown and a publishable library's Markdown are checked; the docs site's content,
 * applications, tools and internal libraries are not. A lint process runs from its project's
 * root, the directory the configuration's globs are relative to, so the project is the working
 * directory.
 *
 * @module config/documentation-scopes
 */

import type { ConfigBlock } from '@hyperfrontend/linter'
import { relative, resolve, sep } from 'node:path'
import { isPublishableLibrary } from '../src/rules/workspace/shared/project-file.ts'

/** The workspace root, three directories above this file. */
const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..')

/**
 * The blocks for one project.
 *
 * @param project - The project's root, absolute
 * @returns The blocks that turn the rules on where the project's documentation is checked
 */
export function documentationScopes(project: string): ConfigBlock[] {
  const fromRoot = relative(WORKSPACE_ROOT, project)
  const blocks: ConfigBlock[] = []
  if (fromRoot === '') {
    blocks.push({ files: ['*.md'], rules: { 'require-codeblock-language': 'error' } })
    blocks.push({ files: ['README.md'], rules: { 'readme-paragraph-length': 'error' } })
  }
  if (fromRoot.split(sep)[0] === 'libs') blocks.push({ files: ['**/*.md'], rules: { 'no-manual-table-of-contents': 'error' } })
  if (fromRoot !== '' && isPublishableLibrary(project)) {
    blocks.push({ files: ['*.md'], rules: { 'require-codeblock-language': 'error' } })
    blocks.push({ files: ['**/README.md'], rules: { 'readme-paragraph-length': 'error' } })
  }
  return blocks
}
