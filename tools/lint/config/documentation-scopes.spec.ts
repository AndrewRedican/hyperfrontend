import { join, resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { documentationScopes } from './documentation-scopes.ts'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

/**
 * The rules a project's blocks turn on, each with the files it reads.
 *
 * @param project - The project's directory, relative to the workspace root
 * @returns One `id files` line per rule
 */
const scopes = (project: string): string[] =>
  documentationScopes(join(ROOT, project)).flatMap((block) =>
    Object.keys(block.rules ?? {}).map((id) => `${id} ${(block.files ?? []).join(',')}`)
  )

describe('documentationScopes', () => {
  it('checks the workspace root Markdown and its README', () => {
    expect(scopes('')).toEqual(['require-codeblock-language *.md', 'readme-paragraph-length README.md'])
  })

  it('checks a publishable library under libs fully', () => {
    expect(scopes('libs/logging')).toEqual([
      'no-manual-table-of-contents **/*.md',
      'require-codeblock-language *.md',
      'readme-paragraph-length **/README.md',
    ])
  })

  it('checks only the table of contents in a library under libs that does not publish', () => {
    expect(scopes('libs/no-such-library')).toEqual(['no-manual-table-of-contents **/*.md'])
  })

  it('checks nothing in an application', () => {
    expect(scopes('apps/docs-site')).toEqual([])
  })
})
