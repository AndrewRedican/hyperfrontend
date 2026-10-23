import type { ExpectedError } from '@hyperfrontend/linter/testing'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { CONTENT, LISTING, createSiteWorkspaces } from './__fixtures__/site-workspace.ts'
import rule from './docs-site-secondary-entries.ts'

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

testRule(rule, {
  valid: [
    {
      name: 'a listing without readme paths',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: "export const LIBRARIES = [{ name: 'A', slug: 'a', category: 'core' }]",
    },
  ],
  invalid: [
    {
      name: 'a secondary entry missing its navigation link',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: LISTING,
      errors: [
        onEntry(
          2,
          "Library 'Alpha' secondary entrypoint './sub' is missing navigation entry 'href: '/docs/libraries/alpha/sub'' in navigation.ts"
        ),
        onEntry(
          2,
          "Library 'Alpha' secondary entrypoint './missing' is missing required page.tsx at apps/docs-site/src/app/docs/libraries/alpha/missing/page.tsx"
        ),
        onEntry(
          2,
          "Library 'Alpha' secondary entrypoint './missing' is missing navigation entry 'href: '/docs/libraries/alpha/missing'' in navigation.ts"
        ),
      ],
    },
    {
      name: 'a secondary entry missing its page in a workspace without navigation',
      path: join(workspaces.bare, CONTENT),
      root: workspaces.full,
      text: LISTING,
      errors: [],
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
