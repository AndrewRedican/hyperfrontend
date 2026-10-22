import type { ExpectedError } from '../../testing/rule-tester.ts'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { CONTENT, LISTING, createSiteWorkspaces } from './__fixtures__/site-workspace.ts'
import rule from './docs-site-library-docs.ts'

const workspaces = createSiteWorkspaces()

/**
 * An error reported on one line of the listing.
 *
 * @param line - The 1-based line of the entry
 * @param message - What the rule must report
 * @returns The error, spanning the entry's object
 */
function onEntry(line: number, message: string): ExpectedError {
  const text = LISTING.split(/\r?\n/)[line - 1] as string
  return { message, line, column: text.indexOf('{') + 1, endLine: line, endColumn: text.lastIndexOf('}') + 2 }
}

const PAGES = 'apps/docs-site/src/app/docs/libraries'

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'documents missing their pages',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: LISTING,
      errors: [
        onEntry(2, `Library 'Alpha' markdown file 'lib/x/README.md' is missing corresponding docs page at ${PAGES}/alpha/x/page.tsx`),
        onEntry(
          2,
          `Library 'Alpha' markdown file 'src/lib/deep/README.md' is missing corresponding docs page at ${PAGES}/alpha/deep/page.tsx`
        ),
        onEntry(
          2,
          `Library 'Alpha' markdown file 'src/other/README.md' is missing corresponding docs page at ${PAGES}/alpha/other/page.tsx`
        ),
      ],
    },
  ],
})

describe('the disposable workspaces', () => {
  it('are removed at the end', () => {
    rmSync(workspaces.full, { recursive: true, force: true })
    rmSync(workspaces.bare, { recursive: true, force: true })
    expect(existsSync(workspaces.full) || existsSync(workspaces.bare)).toBe(false)
  })
})
